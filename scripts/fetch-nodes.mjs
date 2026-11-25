import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 纯 Node.js 内置模块实现（零 npm 外部依赖）
// 自动从 rules/node-sources.txt 拉取 Clash.Meta YAML / Hysteria2 JSON / URI 订阅源，
// 去重并生成 Clash Mi 兼容订阅 (subscriptions/clash-mi-nodes.yaml) 与 Base64/Raw 订阅。

const SOURCES_PATH = path.resolve('rules/node-sources.txt');
const OUT_DIR = path.resolve('subscriptions');
const YAML_SUB_PATH = path.join(OUT_DIR, 'clash-mi-nodes.yaml');
const RAW_SUB_PATH = path.join(OUT_DIR, 'nodes-raw.txt');
const BASE64_SUB_PATH = path.join(OUT_DIR, 'nodes-base64.txt');
const REPORT_PATH = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'node-fetch-report.md');

function readSourceUrls() {
  if (!fs.existsSync(SOURCES_PATH)) {
    throw new Error(`未找到节点源列表文件: ${SOURCES_PATH}`);
  }
  return fs
    .readFileSync(SOURCES_PATH, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ClashMi-NodeFetcher/1.0 (+https://github.com)',
        Accept: '*/*',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function splitHostPort(rawServer) {
  const val = String(rawServer || '').trim();
  if (!val) return { host: '', port: 443 };
  if (val.startsWith('[')) {
    const endBracket = val.indexOf(']');
    if (endBracket !== -1) {
      const host = val.slice(1, endBracket).trim();
      const rest = val.slice(endBracket + 1).trim();
      const portMatch = rest.match(/^:(\d+)/);
      return { host, port: portMatch ? Number(portMatch[1]) : 443 };
    }
  }
  const colonCount = (val.match(/:/g) || []).length;
  if (colonCount === 1) {
    const idx = val.lastIndexOf(':');
    const host = val.slice(0, idx).trim();
    const portMatch = val.slice(idx + 1).match(/^(\d+)/);
    return { host, port: portMatch ? Number(portMatch[1]) : 443 };
  }
  return { host: val, port: 443 };
}

function unquoteScalar(raw) {
  const s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (!s) return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => unquoteScalar(item)).filter(Boolean);
  }
  return unquoteScalar(s);
}

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseInlineObject(rawObj) {
  const inner = rawObj.trim().slice(1, -1).trim();
  const obj = {};
  const parts = inner.split(/,(?![^\[]*\])/);
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = unquoteScalar(part.slice(0, colonIdx));
    const val = parseScalar(part.slice(colonIdx + 1));
    if (key) obj[key] = val;
  }
  return obj;
}

function parseClashYamlProxies(rawText) {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let inProxies = false;
  const items = [];
  let current = null;
  let activeListKey = null;
  let itemIndent = -1;

  for (const rawLine of lines) {
    const cleanLine = stripInlineComment(rawLine);
    const trimmed = cleanLine.trim();
    if (!trimmed) continue;

    if (!inProxies) {
      if (/^proxies:\s*$/.test(trimmed)) {
        inProxies = true;
      }
      continue;
    }

    const indent = cleanLine.search(/\S/);
    if (indent === 0 && !trimmed.startsWith('-')) {
      break;
    }

    if (trimmed.startsWith('- ') && (itemIndent === -1 || indent <= itemIndent)) {
      itemIndent = indent;
      activeListKey = null;
      const rest = trimmed.slice(2).trim();
      if (rest.startsWith('{') && rest.endsWith('}')) {
        items.push(parseInlineObject(rest));
        current = null;
        continue;
      }
      current = {};
      items.push(current);
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1) {
        const key = unquoteScalar(rest.slice(0, colonIdx));
        const valRaw = rest.slice(colonIdx + 1).trim();
        if (valRaw === '') {
          current[key] = [];
          activeListKey = key;
        } else {
          current[key] = parseScalar(valRaw);
        }
      }
      continue;
    }

    if (!current) continue;

    if (trimmed.startsWith('- ') && activeListKey) {
      if (!Array.isArray(current[activeListKey])) current[activeListKey] = [];
      current[activeListKey].push(parseScalar(trimmed.slice(2)));
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      activeListKey = null;
      const key = unquoteScalar(trimmed.slice(0, colonIdx));
      const valRaw = trimmed.slice(colonIdx + 1).trim();
      if (valRaw === '') {
        current[key] = [];
        activeListKey = key;
      } else {
        current[key] = parseScalar(valRaw);
      }
    }
  }

  return items.filter((p) => p && p.type && p.server);
}

function parseJsonNodes(rawText, sourceUrl) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return [];
  }
  if (!data || typeof data !== 'object') return [];

  // Mieru 客户端 JSON 格式 (profiles[].servers[].portBindings[])
  if (Array.isArray(data.profiles)) {
    const out = [];
    for (const profile of data.profiles) {
      if (!profile || !Array.isArray(profile.servers)) continue;
      const username = String(profile.user?.name || '').trim();
      const password = String(profile.user?.password || '').trim();
      const multiplexing = String(profile.multiplexing?.level || 'MULTIPLEXING_LOW').trim();
      for (const srv of profile.servers) {
        const host = String(srv.domainName || srv.ipAddress || '').trim();
        if (!host) continue;
        const bindings = Array.isArray(srv.portBindings) ? srv.portBindings : [];
        for (const binding of bindings) {
          const transport = String(binding.protocol || 'TCP').trim().toUpperCase();
          const proxy = {
            name: profile.profileName || sourceUrl,
            type: 'mieru',
            server: host,
            transport,
            username,
            password,
            multiplexing,
            udp: true,
          };
          if (binding.portRange) {
            proxy['port-range'] = String(binding.portRange).trim();
          } else if (binding.port) {
            proxy.port = Number(binding.port);
          } else {
            continue;
          }
          out.push(proxy);
        }
      }
    }
    return out;
  }

  if (!data.server) return [];
  const { host, port } = splitHostPort(data.server);
  if (!host) return [];

  const isHy1 =
    Boolean(data.protocol) ||
    'auth_str' in data ||
    'up_mbps' in data ||
    'down_mbps' in data ||
    'server_name' in data;

  if (isHy1) {
    const proxy = {
      name: data.remarks || data.name || sourceUrl,
      type: 'hysteria',
      server: host,
      port,
      'auth-str': String(data.auth_str || data.auth || '').trim(),
      protocol: String(data.protocol || 'udp').trim(),
    };
    if (data.up_mbps) proxy.up = `${data.up_mbps} Mbps`;
    else if (data.up) proxy.up = String(data.up).trim();
    if (data.down_mbps) proxy.down = `${data.down_mbps} Mbps`;
    else if (data.down) proxy.down = String(data.down).trim();
    const sni = data.server_name || data.tls?.sni;
    if (sni) proxy.sni = String(sni).trim();
    const insecure = typeof data.insecure === 'boolean' ? data.insecure : data.tls?.insecure;
    if (typeof insecure === 'boolean') proxy['skip-cert-verify'] = insecure;
    if (Array.isArray(data.alpn) && data.alpn.length > 0) {
      proxy.alpn = data.alpn.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof data.alpn === 'string' && data.alpn.trim()) {
      proxy.alpn = data.alpn.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (typeof data.obfs === 'string' && data.obfs.trim()) {
      proxy.obfs = data.obfs.trim();
    }
    return [proxy];
  }

  const proxy = {
    name: data.remarks || data.name || sourceUrl,
    type: 'hysteria2',
    server: host,
    port,
    password: String(data.auth || data.password || '').trim(),
    udp: true,
  };
  if (data.tls?.sni) proxy.sni = String(data.tls.sni).trim();
  if (typeof data.tls?.insecure === 'boolean') proxy['skip-cert-verify'] = data.tls.insecure;
  if (data.bandwidth?.up) proxy.up = String(data.bandwidth.up).trim();
  if (data.bandwidth?.down) proxy.down = String(data.bandwidth.down).trim();
  if (data.obfs?.type) {
    proxy.obfs = String(data.obfs.type).trim();
    const obfsPwd = data.obfs[data.obfs.type]?.password || data.obfs.password;
    if (obfsPwd) proxy['obfs-password'] = String(obfsPwd).trim();
  }
  return [proxy];
}

function parseUriLine(line) {
  try {
    const url = new URL(line);
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();
    const name = decodeURIComponent(url.hash ? url.hash.slice(1) : '').trim();
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const port = Number(url.port || 443);
    if (!host) return null;

    if (scheme === 'hy2' || scheme === 'hysteria2') {
      const proxy = {
        name: name || host,
        type: 'hysteria2',
        server: host,
        port,
        password: decodeURIComponent(url.username || ''),
        udp: true,
      };
      const sni = url.searchParams.get('sni');
      const insecure = url.searchParams.get('insecure');
      const alpn = url.searchParams.get('alpn');
      const obfs = url.searchParams.get('obfs');
      const obfsPwd = url.searchParams.get('obfs-password');
      if (sni) proxy.sni = sni;
      if (insecure === '1' || insecure === 'true') proxy['skip-cert-verify'] = true;
      if (alpn) proxy.alpn = alpn.split(',').map((s) => s.trim()).filter(Boolean);
      if (obfs) proxy.obfs = obfs;
      if (obfsPwd) proxy['obfs-password'] = obfsPwd;
      return proxy;
    }

    if (scheme === 'hysteria') {
      const proxy = {
        name: name || host,
        type: 'hysteria',
        server: host,
        port,
        'auth-str': url.searchParams.get('auth') || '',
        protocol: url.searchParams.get('protocol') || 'udp',
      };
      const peer = url.searchParams.get('peer') || url.searchParams.get('sni');
      const insecure = url.searchParams.get('insecure');
      const alpn = url.searchParams.get('alpn');
      const upmbps = url.searchParams.get('upmbps');
      const downmbps = url.searchParams.get('downmbps');
      if (peer) proxy.sni = peer;
      if (insecure === '1' || insecure === 'true') proxy['skip-cert-verify'] = true;
      if (alpn) proxy.alpn = alpn.split(',').map((s) => s.trim()).filter(Boolean);
      if (upmbps) proxy.up = `${upmbps} Mbps`;
      if (downmbps) proxy.down = `${downmbps} Mbps`;
      return proxy;
    }
  } catch {
    return null;
  }
  return null;
}

function parseSourcePayload(rawText, sourceUrl) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{')) {
    return parseJsonNodes(trimmed, sourceUrl);
  }
  if (/^proxies:\s*$/m.test(trimmed.replace(/\r\n/g, '\n'))) {
    return parseClashYamlProxies(trimmed);
  }

  let text = trimmed;
  if (!/^(hy2|hysteria2|hysteria):\/\//m.test(text) && /^[A-Za-z0-9+/=\r\n]+$/.test(text)) {
    try {
      const decoded = Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
      if (/^(hy2|hysteria2|hysteria):\/\//m.test(decoded)) {
        text = decoded;
      }
    } catch {
      // ignore non-base64
    }
  }

  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(hy2|hysteria2|hysteria):\/\//.test(l))
    .map(parseUriLine)
    .filter(Boolean);
}

function getProxySecret(p) {
  const user = p.username ? `${p.username}:` : '';
  return user + String(p.password ?? p['auth-str'] ?? p.auth_str ?? p.uuid ?? '').trim();
}

function inferRegionLabel(proxy) {
  const host = String(proxy.server || '');
  const rawName = String(proxy.name || '');
  if (/港|HK|Hong/i.test(rawName)) return '🇭🇰 香港';
  if (/台|TW|TaiWan/i.test(rawName)) return '🇹🇼 台湾';
  if (/日|JP|Japan/i.test(rawName)) return '🇯🇵 日本';
  if (/新|SG|Singapore/i.test(rawName)) return '🇸🇬 狮城';
  if (/美|US|United\s?States/i.test(rawName)) return '🇺🇸 美国';
  if (/韩|KR|Korea/i.test(rawName)) return '🇰🇷 韩国';
  if (/^(62\.210\.|2001:bc8:)/i.test(host)) return '🇫🇷 法国';
  return '🌐 自动节点';
}

function shortHostTag(host) {
  if (host.includes(':')) {
    const parts = host.split(':');
    const tail = parts[parts.length - 1] || parts[parts.length - 2] || host;
    return `::${tail}`;
  }
  return host;
}

function extractMbpsNumber(rawVal) {
  const m = String(rawVal || '').match(/(\d+)/);
  return m ? m[1] : '';
}

function toShareUri(proxy) {
  const host = String(proxy.server);
  const hostUri = host.includes(':') ? `[${host}]` : host;
  const port = Number(proxy.port || 443);
  const nameTag = encodeURIComponent(proxy.name);

  if (proxy.type === 'hysteria2') {
    const params = new URLSearchParams();
    if (proxy.sni) params.set('sni', String(proxy.sni));
    if (proxy['skip-cert-verify']) params.set('insecure', '1');
    if (Array.isArray(proxy.alpn) && proxy.alpn.length > 0) params.set('alpn', proxy.alpn.join(','));
    if (proxy.obfs) params.set('obfs', String(proxy.obfs));
    if (proxy['obfs-password']) params.set('obfs-password', String(proxy['obfs-password']));
    const auth = encodeURIComponent(String(proxy.password || ''));
    return `hy2://${auth}@${hostUri}:${port}?${params.toString()}#${nameTag}`;
  }

  if (proxy.type === 'hysteria') {
    const params = new URLSearchParams();
    params.set('protocol', String(proxy.protocol || 'udp'));
    const authStr = String(proxy['auth-str'] || proxy.auth_str || '');
    if (authStr) params.set('auth', authStr);
    if (proxy.sni) params.set('peer', String(proxy.sni));
    if (proxy['skip-cert-verify']) params.set('insecure', '1');
    const up = extractMbpsNumber(proxy.up);
    const down = extractMbpsNumber(proxy.down);
    if (up) params.set('upmbps', up);
    if (down) params.set('downmbps', down);
    if (Array.isArray(proxy.alpn) && proxy.alpn.length > 0) params.set('alpn', proxy.alpn.join(','));
    return `hysteria://${hostUri}:${port}?${params.toString()}#${nameTag}`;
  }

  return null;
}

function yamlScalar(val) {
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  const s = String(val);
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function serializeProxyYaml(proxy) {
  const orderedKeys = [
    'name',
    'type',
    'server',
    'port',
    'port-range',
    'transport',
    'username',
    'password',
    'multiplexing',
    'auth-str',
    'protocol',
    'up',
    'down',
    'sni',
    'skip-cert-verify',
    'alpn',
    'obfs',
    'obfs-password',
    'udp',
  ];
  const keys = [
    ...orderedKeys.filter((k) => proxy[k] !== undefined && proxy[k] !== ''),
    ...Object.keys(proxy).filter(
      (k) => !orderedKeys.includes(k) && proxy[k] !== undefined && proxy[k] !== ''
    ),
  ];

  const lines = [];
  keys.forEach((key, idx) => {
    const prefix = idx === 0 ? '  - ' : '    ';
    const val = proxy[key];
    if (Array.isArray(val)) {
      lines.push(`${prefix}${key}: [${val.map(yamlScalar).join(', ')}]`);
    } else {
      lines.push(`${prefix}${key}: ${yamlScalar(val)}`);
    }
  });
  return lines.join('\n');
}

function buildClashYamlSubscription(proxies, sourceOkCount, sourceTotal) {
  const names = proxies.map((p) => p.name);
  const yamlNamesList = names.map((n) => `      - ${yamlScalar(n)}`).join('\n');

  return [
    '# ============================================================================',
    '# Clash Mi 每日自动提取节点订阅 (clash-mi-nodes.yaml)',
    `# 更新时间 (UTC): ${new Date().toISOString()}`,
    `# 提取结果: ${proxies.length} 个去重节点 (来自 ${sourceOkCount}/${sourceTotal} 个可用源)`,
    '# 说明: 可直接作为独立订阅导入 Clash Mi，也可叠加本仓库 override/clash-mi-override.js 覆写使用',
    '# ============================================================================',
    'mixed-port: 7890',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'ipv6: true',
    '',
    'proxies:',
    proxies.map(serializeProxyYaml).join('\n'),
    '',
    'proxy-groups:',
    '  - name: "♻️ 自动测速优选"',
    '    type: url-test',
    '    url: "https://www.gstatic.com/generate_204"',
    '    interval: 300',
    '    tolerance: 50',
    '    proxies:',
    yamlNamesList,
    '  - name: "🚀 节点选择"',
    '    type: select',
    '    proxies:',
    '      - "♻️ 自动测速优选"',
    '      - "🚨 故障转移"',
    yamlNamesList,
    '      - DIRECT',
    '  - name: "🚨 故障转移"',
    '    type: fallback',
    '    url: "https://www.gstatic.com/generate_204"',
    '    interval: 180',
    '    proxies:',
    yamlNamesList,
    '',
    'rules:',
    '  - GEOIP,LAN,DIRECT,no-resolve',
    '  - MATCH,🚀 节点选择',
    '',
  ].join('\n');
}

async function main() {
  const urls = readSourceUrls();
  if (urls.length === 0) {
    throw new Error('rules/node-sources.txt 中没有配置任何有效 URL');
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const text = await fetchText(url);
        const nodes = parseSourcePayload(text, url);
        return { url, ok: true, nodes, error: null };
      } catch (err) {
        return {
          url,
          ok: false,
          nodes: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const dedupMap = new Map();
  for (const r of results) {
    for (const node of r.nodes) {
      const portKey = node['port-range'] || Number(node.port || 443);
      const key = `${node.type}|${String(node.server).toLowerCase()}|${portKey}|${getProxySecret(node)}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, node);
      }
    }
  }

  // IPv4 优先，其次 IPv6，按端口与地址稳定排序
  const uniqueNodes = Array.from(dedupMap.values()).sort((a, b) => {
    const aV6 = String(a.server).includes(':') ? 1 : 0;
    const bV6 = String(b.server).includes(':') ? 1 : 0;
    if (aV6 !== bV6) return aV6 - bV6;
    return String(a.server).localeCompare(String(b.server));
  });

  if (uniqueNodes.length === 0) {
    throw new Error('所有上游节点源均未解析出可用节点，已中止更新以避免覆盖现有订阅');
  }

  const renamedNodes = uniqueNodes.map((node, idx) => {
    const seq = String(idx + 1).padStart(2, '0');
    const region = inferRegionLabel(node);
    const ipVer = String(node.server).includes(':') ? 'IPv6' : 'IPv4';
    const protoTag =
      node.type === 'hysteria'
        ? 'Hy1'
        : node.type === 'hysteria2'
          ? 'Hy2'
          : node.type === 'mieru'
            ? 'Mieru'
            : String(node.type).toUpperCase();
    return {
      ...node,
      name: `${region} ${ipVer} ${protoTag}-${seq} (${shortHostTag(String(node.server))})`,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceOkCount = results.filter((r) => r.ok && r.nodes.length > 0).length;

  const yamlContent = buildClashYamlSubscription(renamedNodes, sourceOkCount, urls.length);
  fs.writeFileSync(YAML_SUB_PATH, yamlContent, 'utf8');

  const rawUris = renamedNodes.map(toShareUri).filter(Boolean);
  const rawContent = rawUris.join('\n') + (rawUris.length > 0 ? '\n' : '');
  fs.writeFileSync(RAW_SUB_PATH, rawContent, 'utf8');
  fs.writeFileSync(
    BASE64_SUB_PATH,
    Buffer.from(rawContent, 'utf8').toString('base64') + '\n',
    'utf8'
  );

  const tableRows = renamedNodes
    .map((n) => {
      const ipVer = String(n.server).includes(':') ? 'IPv6' : 'IPv4';
      const endpoint = n['port-range'] ? `${n.server}:${n['port-range']}` : `${n.server}:${n.port}`;
      return `| ${n.name} | ${n.type} | ${ipVer} | \`${endpoint}\` |`;
    })
    .join('\n');

  const failedSources = results.filter((r) => !r.ok || r.nodes.length === 0);
  const report = [
    '### 每日节点提取与订阅生成报告',
    '',
    `- **更新时间 (UTC)**: ${new Date().toISOString()}`,
    `- **源抓取统计**: ${sourceOkCount} / ${urls.length} 个 URL 有效`,
    `- **去重节点总数**: ${renamedNodes.length} 个`,
    `- **输出文件**: \`subscriptions/clash-mi-nodes.yaml\` / \`subscriptions/nodes-base64.txt\` / \`subscriptions/nodes-raw.txt\``,
    '',
    '| 节点名称 | 协议 | IP 栈 | 服务器地址 |',
    '| :--- | :--- | :--- | :--- |',
    tableRows,
    failedSources.length > 0
      ? `\n#### 未提取到节点的源 (${failedSources.length})\n` +
        failedSources.map((f) => `- ${f.url}: ${f.error || '0 nodes'}`).join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(REPORT_PATH, report + '\n', 'utf8');
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
