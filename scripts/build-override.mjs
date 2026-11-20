import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

// 纯 Node.js 内置模块实现（零 npm 外部依赖，彻底避免 GitHub Actions npm install 报错）
const YAML_OVERRIDE_PATH = path.resolve('override/diversion.yaml');
const JS_OVERRIDE_PATH = path.resolve('override/clash-mi-override.js');
const REPORT_PATH = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'sync-report.md');
const PRIMARY_GROUP = "🚀 节点选择";
const ADS_GROUP = "🛡️ 广告拦截";

function readCustomRules(filePath, target) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const hasNoResolve = parts.some((p) => p.toLowerCase() === 'no-resolve');
        return hasNoResolve
          ? `${parts[0].toUpperCase()},${parts[1]},${target},no-resolve`
          : `${parts[0].toUpperCase()},${parts[1]},${target}`;
      }
      return `DOMAIN-SUFFIX,${line},${target}`;
    });
}

function unquoteYamlScalar(raw) {
  const s = raw.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function formatYamlListItem(val) {
  const needsQuotes =
    /^[*!&@%`|>?{}\[\]]/.test(val) || val.includes(': ') || val.includes(' #');
  return needsQuotes ? `  - '${val.replace(/'/g, "''")}'` : `  - ${val}`;
}

function syncYamlRulesSection(rawYaml, customMerged) {
  const normalized = rawYaml.replace(/\r\n/g, '\n');
  if (/^\t+/m.test(normalized)) {
    throw new Error('YAML 缩进包含 Tab 字符，请统一使用空格');
  }
  if (!/^proxy-groups!?:/m.test(normalized)) {
    throw new Error('YAML 缺少 proxy-groups 配置块');
  }
  const rulesHeaderMatch = normalized.match(/^rules!?:\s*$/m);
  if (!rulesHeaderMatch || typeof rulesHeaderMatch.index !== 'number') {
    throw new Error('YAML 缺少 rules / rules! 配置块');
  }

  const headerEnd = rulesHeaderMatch.index + rulesHeaderMatch[0].length;
  const beforeRules = normalized.slice(0, headerEnd);
  const afterHeader = normalized.slice(headerEnd);
  const nextTopKeyMatch = afterHeader.match(/\n[a-zA-Z0-9_-]+!?:\s*/);
  const rulesBlock = nextTopKeyMatch ? afterHeader.slice(0, nextTopKeyMatch.index) : afterHeader;
  const trailingSection = nextTopKeyMatch ? afterHeader.slice(nextTopKeyMatch.index) : '';

  const currentRules = rulesBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => unquoteYamlScalar(line.slice(2)));

  const staticRules = currentRules.filter(
    (r) =>
      r.startsWith('AND,') ||
      r.startsWith('RULE-SET,') ||
      r.startsWith('GEOIP,') ||
      r.startsWith('MATCH,')
  );
  const nextRules = [...customMerged, ...staticRules];

  // 校验所有 RULE-SET 引用的 provider 均已定义
  const declaredProviders = new Set();
  const rpMatch = beforeRules.match(/^rule-providers!?:\n([\s\S]*?)(?=^[a-zA-Z0-9_-]+!?:|(?![\s\S]))/m);
  if (rpMatch) {
    for (const line of rpMatch[1].split('\n')) {
      const m = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
      if (m) declaredProviders.add(m[1]);
    }
  }
  if (declaredProviders.size > 0) {
    for (const r of nextRules) {
      const m = r.match(/^RULE-SET,([^,]+),/);
      if (m && !declaredProviders.has(m[1])) {
        throw new Error(`RULE-SET 引用了未定义的 provider: ${m[1]}`);
      }
    }
  }

  const changed = JSON.stringify(currentRules) !== JSON.stringify(nextRules);
  const nextContent =
    beforeRules +
    '\n' +
    nextRules.map(formatYamlListItem).join('\n') +
    (trailingSection || '\n');

  return { changed, nextContent, count: nextRules.length };
}

function main() {
  const customReject = readCustomRules(path.resolve('rules/custom-reject.list'), ADS_GROUP);
  const customDirect = readCustomRules(path.resolve('rules/custom-direct.list'), 'DIRECT');
  const customProxy = readCustomRules(path.resolve('rules/custom-proxy.list'), PRIMARY_GROUP);
  const customMerged = [...customReject, ...customDirect, ...customProxy];

  // 1. 零依赖更新并校验 YAML 覆写模板
  let yamlRulesCount = 0;
  if (fs.existsSync(YAML_OVERRIDE_PATH)) {
    const rawYaml = fs.readFileSync(YAML_OVERRIDE_PATH, 'utf8');
    const result = syncYamlRulesSection(rawYaml, customMerged);
    yamlRulesCount = result.count;
    if (result.changed) {
      fs.writeFileSync(YAML_OVERRIDE_PATH, result.nextContent, 'utf8');
    }
  }

  // 2. 更新并双模式沙箱测试 JS 覆写脚本
  let jsStatus = '未启用';
  if (fs.existsSync(JS_OVERRIDE_PATH)) {
    let jsContent = fs.readFileSync(JS_OVERRIDE_PATH, 'utf8');
    const rulesRegex = /const RULES = (\[[\s\S]*?\]);/;
    const match = jsContent.match(rulesRegex);
    if (match) {
      const existingRules = JSON.parse(match[1]);
      const staticRules = existingRules.filter(
        (r) =>
          r.startsWith('AND,') ||
          r.startsWith('RULE-SET,') ||
          r.startsWith('GEOIP,') ||
          r.startsWith('MATCH,')
      );
      const nextRules = [...customMerged, ...staticRules];
      if (JSON.stringify(existingRules) !== JSON.stringify(nextRules)) {
        jsContent = jsContent.replace(rulesRegex, `const RULES = ${JSON.stringify(nextRules, null, 2)};`);
        fs.writeFileSync(JS_OVERRIDE_PATH, jsContent, 'utf8');
      }
    }

    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(jsContent, sandbox);

    // 干跑 A: inline proxies 订阅模式
    const dryRun = sandbox.main({
      proxies: [
        { name: '🇭🇰 香港 01 [10Gbps]', type: 'ss', server: '1.1.1.1', port: 443 },
        { name: '🇯🇵 日本 01', type: 'vmess', server: '2.2.2.2', port: 443 },
        { name: '🇺🇸 美国 01', type: 'trojan', server: '3.3.3.3', port: 443 },
        { name: '🇬🇧 英国 GB 01', type: 'ss', server: '4.4.4.4', port: 443 },
        { name: '剩余流量：500 GB', type: 'ss', server: '127.0.0.1', port: 80 },
      ],
    });
    // 干跑 B: proxy-providers 订阅模式
    const providerRun = sandbox.main({
      'proxy-providers': { sub1: { type: 'http', url: 'https://example.com' } },
    });

    const hasFailover = dryRun['proxy-groups'].some((g) => g.type === 'fallback');
    const hasUrlTest = dryRun['proxy-groups'].some((g) => g.type === 'url-test');
    const autoIsFirst = Boolean(dryRun['proxy-groups'][0] && dryRun['proxy-groups'][0].type === 'url-test');
    const selectGroup = dryRun['proxy-groups'].find((g) => g.name.includes('节点选择'));
    const hasDirectNodesInSelect = Boolean(
      selectGroup && selectGroup.proxies.some((p) => p.includes('10Gbps')) && selectGroup.proxies.some((p) => p.includes('GB'))
    );
    const providerSelect = providerRun['proxy-groups'].find((g) => g.name.includes('节点选择'));
    const providerOk = Boolean(providerSelect && providerSelect['include-all']);
    const hasDnsSinkhole = Boolean(
      dryRun.dns &&
      dryRun.dns['nameserver-policy'] &&
      Object.values(dryRun.dns['nameserver-policy']).some(
        (v) => Array.isArray(v) && v.includes('rcode://success')
      )
    );

    if (!hasUrlTest || !hasFailover || !hasDirectNodesInSelect || !providerOk) {
      throw new Error('JS 覆写脚本核心策略校验未通过');
    }

    jsStatus = `通过 (${dryRun['proxy-groups'].length} 组 / ${dryRun.rules.length} 规则 / 自动测速首位:${autoIsFirst} / 节点列表可见:${hasDirectNodesInSelect} / DNS广告黑洞:${hasDnsSinkhole})`;
  }

  const report = [
    '### Clash Mi 覆写模板同步报告',
    '',
    `- **同步时间**: ${new Date().toISOString()}`,
    `- **自定义规则合并**: 拦截 ${customReject.length} 条 / 直连 ${customDirect.length} 条 / 代理 ${customProxy.length} 条`,
    `- **YAML 覆写规则总数**: ${yamlRulesCount} 条`,
    `- **JS 覆写脚本双模式干跑校验**: ${jsStatus}`,
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, report + '\n', 'utf8');
  console.log(report);
}

main();
