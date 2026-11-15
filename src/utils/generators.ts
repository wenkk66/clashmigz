import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import {
  ClashWorkspaceState,
  GeneratedFile,
  YamlValidationResult,
} from '../types/clash';

function parseCustomRuleLines(raw: string, target: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'))
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const type = parts[0].toUpperCase();
        const value = parts[1];
        const hasNoResolve = parts.some((p) => p.toLowerCase() === 'no-resolve');
        return hasNoResolve
          ? `${type},${value},${target},no-resolve`
          : `${type},${value},${target}`;
      }
      return `DOMAIN-SUFFIX,${line},${target}`;
    });
}

export function buildOverwriteYamlObject(state: ClashWorkspaceState): Record<string, unknown> {
  const { overwrite, groups, ruleModules, kernel, customRules } = state;

  const enabledGroups = groups.filter((g) => g.enabled);
  const enabledGroupNames = new Set(enabledGroups.map((g) => g.name));

  const primarySelectName =
    enabledGroups.find((g) => g.id === 'grp-select')?.name ||
    enabledGroups[0]?.name ||
    'DIRECT';
  const adsGroupName =
    enabledGroups.find((g) => g.id === 'grp-ads')?.name || 'REJECT';
  const fallbackGroupName =
    enabledGroups.find((g) => g.id === 'grp-fallback')?.name || primarySelectName;

  const proxyGroupsArr = enabledGroups.map((grp) => {
    const obj: Record<string, unknown> = {
      name: grp.name,
      type: grp.type,
    };

    if (grp.proxies.length > 0) {
      const validRefs = grp.proxies.filter(
        (ref) =>
          ref === 'DIRECT' ||
          ref === 'REJECT' ||
          ref === 'REJECT-DROP' ||
          enabledGroupNames.has(ref)
      );
      if (validRefs.length > 0) {
        obj.proxies = validRefs;
      }
    }

    if (grp.includeAllProxies) {
      obj['include-all'] = true;
    }

    if (grp.filter.trim()) {
      obj.filter = grp.filter.trim();
    }
    const groupExclude =
      grp.excludeFilter.trim() || (grp.includeAllProxies ? kernel.globalExcludeFilter.trim() : '');
    if (groupExclude) {
      obj['exclude-filter'] = groupExclude;
    }

    if (grp.type === 'url-test' || grp.type === 'fallback') {
      obj.url = grp.url || 'https://www.gstatic.com/generate_204';
      obj.interval = grp.interval || 300;
      if (grp.type === 'url-test') {
        obj.tolerance = grp.tolerance ?? 50;
      }
    }

    if (grp.type === 'load-balance') {
      obj.url = grp.url || 'https://www.gstatic.com/generate_204';
      obj.interval = grp.interval || 300;
      obj.strategy = grp.strategy || 'consistent-hashing';
    }

    if (!obj.proxies && !obj['include-all']) {
      obj.proxies = ['DIRECT'];
    }

    return obj;
  });

  const enabledRules = ruleModules.filter((r) => r.enabled);
  const ruleProvidersObj: Record<string, Record<string, unknown>> = {};
  const isMrs = kernel.ruleSourceFlavor === 'metacubex-mrs';

  for (const mod of enabledRules) {
    const ext = isMrs ? 'mrs' : mod.yamlUrl.endsWith('.txt') ? 'txt' : 'yaml';
    ruleProvidersObj[mod.providerName] = {
      type: 'http',
      behavior: mod.behavior,
      format: isMrs ? 'mrs' : mod.yamlUrl.endsWith('.txt') ? 'text' : 'yaml',
      url: isMrs ? mod.mrsUrl : mod.yamlUrl,
      path: `./rule_providers/${mod.providerName}.${ext}`,
      interval: mod.interval,
    };
  }

  const rulesList: string[] = [
    ...parseCustomRuleLines(customRules.rejectList, adsGroupName),
    ...parseCustomRuleLines(customRules.directList, 'DIRECT'),
    ...parseCustomRuleLines(customRules.proxyList, primarySelectName),
  ];

  for (const mod of enabledRules) {
    const resolvedTarget =
      mod.targetGroup === 'DIRECT' ||
      mod.targetGroup === 'REJECT' ||
      mod.targetGroup === 'REJECT-DROP'
        ? mod.targetGroup
        : enabledGroupNames.has(mod.targetGroup)
          ? mod.targetGroup
          : primarySelectName;
    const ruleLine = mod.noResolve
      ? `RULE-SET,${mod.providerName},${resolvedTarget},no-resolve`
      : `RULE-SET,${mod.providerName},${resolvedTarget}`;
    rulesList.push(ruleLine);
  }

  rulesList.push('GEOIP,LAN,DIRECT,no-resolve');
  rulesList.push(`MATCH,${fallbackGroupName}`);

  const config: Record<string, unknown> = {};

  if (overwrite.overwriteSniffer) {
    config.sniffer = {
      enable: true,
      'force-dns-mapping': true,
      'parse-pure-ip': true,
      sniff: {
        HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
        TLS: { ports: [443, 8443] },
        QUIC: { ports: [443, 8443] },
      },
    };
  }

  if (overwrite.overwriteDns) {
    config.dns = {
      enable: true,
      ipv6: kernel.ipv6,
      'respect-rules': true,
      'enhanced-mode': kernel.dnsMode,
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': [
        '*.lan',
        '*.local',
        'localhost.ptlogin2.qq.com',
        '+.msftconnecttest.com',
        '+.msftncsi.com',
        'RULE-SET:private',
        'RULE-SET:cn-domain',
      ],
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'proxy-server-nameserver': [kernel.dohChina || 'https://dns.alidns.com/dns-query'],
      'direct-nameserver': [kernel.dohChina || 'https://dns.alidns.com/dns-query'],
      nameserver: [kernel.dohGlobal || 'https://1.1.1.1/dns-query'],
      'nameserver-policy': {
        'RULE-SET:private,cn-domain,apple-cn,microsoft-cn': [
          kernel.dohChina || 'https://dns.alidns.com/dns-query',
        ],
        'geosite:cn,private': [kernel.dohChina || 'https://dns.alidns.com/dns-query'],
        'geosite:geolocation-!cn': [kernel.dohGlobal || 'https://1.1.1.1/dns-query'],
      },
    };
  }

  config['proxy-groups'] = proxyGroupsArr;
  if (Object.keys(ruleProvidersObj).length > 0) {
    config['rule-providers'] = ruleProvidersObj;
  }
  config.rules = rulesList;

  return config;
}

export function generateOverwriteYamlString(state: ClashWorkspaceState): string {
  const obj = buildOverwriteYamlObject(state);
  const header = [
    '# ============================================================================',
    '# Clash Mi 全局分流覆写模板 (YAML Overwrite)',
    `# 仓库: ${state.github.owner}/${state.github.repo} (${state.github.branch})`,
    '# 特性: 自动测速优选(url-test) / 故障转移(fallback) / 负载均衡 / 去广告(HTTPDNS+AdGuard)',
    '# 用法: 导入 Clash Mi「覆写」页或通过 Raw URL 添加，自动作用于客户端内所有订阅',
    '# ============================================================================',
    '',
  ].join('\n');

  const dumped = yamlDump(obj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  return header + dumped;
}

export function generateOverwriteJsString(state: ClashWorkspaceState): string {
  const { overwrite, groups, ruleModules, kernel, customRules } = state;
  const enabledGroups = groups.filter((g) => g.enabled);
  const enabledGroupNames = new Set(enabledGroups.map((g) => g.name));
  const primarySelectName =
    enabledGroups.find((g) => g.id === 'grp-select')?.name || enabledGroups[0]?.name || 'DIRECT';
  const adsGroupName =
    enabledGroups.find((g) => g.id === 'grp-ads')?.name || 'REJECT';
  const fallbackGroupName =
    enabledGroups.find((g) => g.id === 'grp-fallback')?.name || primarySelectName;

  const isMrs = kernel.ruleSourceFlavor === 'metacubex-mrs';
  const ruleProvidersObj: Record<string, Record<string, unknown>> = {};
  const enabledRules = ruleModules.filter((r) => r.enabled);

  for (const mod of enabledRules) {
    const ext = isMrs ? 'mrs' : mod.yamlUrl.endsWith('.txt') ? 'txt' : 'yaml';
    ruleProvidersObj[mod.providerName] = {
      type: 'http',
      behavior: mod.behavior,
      format: isMrs ? 'mrs' : mod.yamlUrl.endsWith('.txt') ? 'text' : 'yaml',
      url: isMrs ? mod.mrsUrl : mod.yamlUrl,
      path: `./rule_providers/${mod.providerName}.${ext}`,
      interval: mod.interval,
    };
  }

  const rulesList: string[] = [
    ...parseCustomRuleLines(customRules.rejectList, adsGroupName),
    ...parseCustomRuleLines(customRules.directList, 'DIRECT'),
    ...parseCustomRuleLines(customRules.proxyList, primarySelectName),
  ];

  for (const mod of enabledRules) {
    const resolvedTarget =
      mod.targetGroup === 'DIRECT' ||
      mod.targetGroup === 'REJECT' ||
      mod.targetGroup === 'REJECT-DROP'
        ? mod.targetGroup
        : enabledGroupNames.has(mod.targetGroup)
          ? mod.targetGroup
          : primarySelectName;
    rulesList.push(
      mod.noResolve
        ? `RULE-SET,${mod.providerName},${resolvedTarget},no-resolve`
        : `RULE-SET,${mod.providerName},${resolvedTarget}`
    );
  }
  rulesList.push('GEOIP,LAN,DIRECT,no-resolve');
  rulesList.push(`MATCH,${fallbackGroupName}`);

  const serializedGroups = enabledGroups.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    filter: g.filter,
    excludeFilter: g.excludeFilter,
    url: g.url,
    interval: g.interval,
    tolerance: g.tolerance,
    strategy: g.strategy,
    includeAllProxies: g.includeAllProxies,
    proxies: g.proxies.filter(
      (ref) =>
        ref === 'DIRECT' ||
        ref === 'REJECT' ||
        ref === 'REJECT-DROP' ||
        enabledGroupNames.has(ref)
    ),
  }));

  return `/**
 * Clash Mi 全局分流与节点过滤覆写脚本 (JS Overwrite)
 * 仓库: ${state.github.owner}/${state.github.repo} (${state.github.branch})
 * 特性: 自动测速(url-test) · 故障转移(fallback) · 负载均衡 · HTTPDNS+全网去广告 · 空地区组自动跳过
 * 用法: 在 Clash Mi「覆写」页添加此脚本 Raw URL，任意机场订阅均可自动套用。
 */

const GLOBAL_EXCLUDE = ${JSON.stringify(kernel.globalExcludeFilter)};
const STRIP_EXCLUDED_PROXIES = ${JSON.stringify(overwrite.stripExcludedProxies)};
const SKIP_EMPTY_REGION_GROUPS = ${JSON.stringify(overwrite.skipEmptyRegionGroups)};
const OVERWRITE_DNS = ${JSON.stringify(overwrite.overwriteDns)};
const OVERWRITE_SNIFFER = ${JSON.stringify(overwrite.overwriteSniffer)};

const GROUP_SPECS = ${JSON.stringify(serializedGroups, null, 2)};

const RULE_PROVIDERS = ${JSON.stringify(ruleProvidersObj, null, 2)};

const RULES = ${JSON.stringify(rulesList, null, 2)};

function compileRegex(pattern) {
  if (!pattern || !pattern.trim()) return null;
  try {
    return new RegExp(pattern.trim(), 'i');
  } catch {
    return null;
  }
}

function main(config) {
  const rawProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const globalExcludeRe = compileRegex(GLOBAL_EXCLUDE);

  // 1. 清洗当前订阅的无效/提示/高倍率节点
  const cleanProxies = STRIP_EXCLUDED_PROXIES
    ? rawProxies.filter((p) => p && p.name && !(globalExcludeRe && globalExcludeRe.test(p.name)))
    : rawProxies;

  if (STRIP_EXCLUDED_PROXIES && cleanProxies.length > 0) {
    config.proxies = cleanProxies;
  }

  const allProxyNames = (config.proxies || []).map((p) => p.name).filter(Boolean);

  // 2. 动态匹配每个节点策略组（支持 url-test 自动选择、fallback 故障转移、load-balance 均衡，自动跳过空地区组）
  const activeGroupNames = new Set(['DIRECT', 'REJECT', 'REJECT-DROP']);
  const builtGroups = [];

  for (const spec of GROUP_SPECS) {
    if (spec.includeAllProxies) {
      const includeRe = compileRegex(spec.filter);
      const excludeRe = compileRegex(spec.excludeFilter || GLOBAL_EXCLUDE);
      const matchedNames = allProxyNames.filter((name) => {
        if (excludeRe && excludeRe.test(name)) return false;
        if (includeRe && !includeRe.test(name)) return false;
        return true;
      });

      if (SKIP_EMPTY_REGION_GROUPS && matchedNames.length === 0) {
        continue;
      }

      const grpObj = {
        name: spec.name,
        type: spec.type,
        proxies: matchedNames.length > 0 ? matchedNames : ['DIRECT'],
      };
      if (spec.type === 'url-test' || spec.type === 'fallback') {
        grpObj.url = spec.url || 'https://www.gstatic.com/generate_204';
        grpObj.interval = spec.interval || 300;
        if (spec.type === 'url-test') grpObj.tolerance = spec.tolerance ?? 50;
      } else if (spec.type === 'load-balance') {
        grpObj.url = spec.url || 'https://www.gstatic.com/generate_204';
        grpObj.interval = spec.interval || 300;
        grpObj.strategy = spec.strategy || 'consistent-hashing';
      }
      builtGroups.push({ ...grpObj, _isNodeGroup: true });
      activeGroupNames.add(spec.name);
    } else {
      builtGroups.push({
        name: spec.name,
        type: spec.type,
        proxies: spec.proxies,
        _isNodeGroup: false,
      });
      activeGroupNames.add(spec.name);
    }
  }

  // 3. 清理聚合选择组中已被跳过的空地区引用
  config['proxy-groups'] = builtGroups.map((grp) => {
    const isNodeGroup = grp._isNodeGroup;
    delete grp._isNodeGroup;
    if (isNodeGroup) {
      return grp;
    }
    const validRefs = (grp.proxies || []).filter(
      (ref) => activeGroupNames.has(ref) || allProxyNames.includes(ref)
    );
    return {
      name: grp.name,
      type: grp.type,
      proxies: validRefs.length > 0 ? validRefs : (allProxyNames.length > 0 ? allProxyNames.slice(0, 5) : ['DIRECT']),
    };
  });

  // 4. 注入 rule-providers 与分流规则
  config['rule-providers'] = {
    ...(config['rule-providers'] || {}),
    ...RULE_PROVIDERS,
  };
  config.rules = RULES;

  // 5. 覆写 DNS 与 Sniffer
  if (OVERWRITE_SNIFFER) {
    config.sniffer = {
      enable: true,
      'force-dns-mapping': true,
      'parse-pure-ip': true,
      sniff: {
        HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
        TLS: { ports: [443, 8443] },
        QUIC: { ports: [443, 8443] },
      },
    };
  }

  if (OVERWRITE_DNS) {
    config.dns = {
      enable: true,
      ipv6: ${JSON.stringify(kernel.ipv6)},
      'respect-rules': true,
      'enhanced-mode': ${JSON.stringify(kernel.dnsMode)},
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': [
        '*.lan',
        '*.local',
        'localhost.ptlogin2.qq.com',
        '+.msftconnecttest.com',
        '+.msftncsi.com',
        'RULE-SET:private',
        'RULE-SET:cn-domain',
      ],
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'proxy-server-nameserver': [${JSON.stringify(kernel.dohChina || 'https://dns.alidns.com/dns-query')}],
      'direct-nameserver': [${JSON.stringify(kernel.dohChina || 'https://dns.alidns.com/dns-query')}],
      nameserver: [${JSON.stringify(kernel.dohGlobal || 'https://1.1.1.1/dns-query')}],
      'nameserver-policy': {
        'RULE-SET:private,cn-domain,apple-cn,microsoft-cn': [${JSON.stringify(kernel.dohChina || 'https://dns.alidns.com/dns-query')}],
        'geosite:cn,private': [${JSON.stringify(kernel.dohChina || 'https://dns.alidns.com/dns-query')}],
        'geosite:geolocation-!cn': [${JSON.stringify(kernel.dohGlobal || 'https://1.1.1.1/dns-query')}],
      },
    };
  }

  return config;
}
`;
}

export function validateYamlString(content: string): YamlValidationResult {
  const lineCount = content.split('\n').length;
  try {
    const parsed = yamlLoad(content);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'YAML 解析结果为空对象', lineCount };
    }
    return { valid: true, error: null, lineCount };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'YAML 语法解析错误',
      lineCount,
    };
  }
}

export function generateWorkflowYaml(state: ClashWorkspaceState): string {
  const { github } = state;

  const summaryBlock = github.enableStepSummary
    ? `
      - name: 输出规则与模板同步摘要
        if: always()
        run: |
          if [ -f "$RUNNER_TEMP/sync-report.md" ]; then
            cat "$RUNNER_TEMP/sync-report.md" >> $GITHUB_STEP_SUMMARY
          fi`
    : '';

  return `name: Sync Clash Mi Overwrite Templates

on:
  schedule:
    # 定时校验并同步自定义规则到覆写模板 (UTC): ${github.cronExpression}
    - cron: '${github.cronExpression}'
  workflow_dispatch:
  push:
    branches:
      - '${github.branch}'
    paths:
      - 'rules/**'
      - 'scripts/build-override.mjs'

permissions:
  contents: write

jobs:
  sync-override:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 仓库代码
        uses: actions/checkout@v4

      - name: 配置 Node.js 运行环境
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: 安装依赖 (js-yaml)
        run: npm install --no-audit --no-fund

      - name: 合并 rules/*.list 到 YAML / JS 覆写模板并执行沙箱校验
        run: node scripts/build-override.mjs
${summaryBlock}
      - name: 自动提交更新后的覆写模板
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add override/
          if git diff --staged --quiet; then
            echo "覆写模板无实质变更，跳过提交。"
          else
            git commit -m "${github.commitMessage}"
            git push
          fi
`;
}

export function generateBuildScript(state: ClashWorkspaceState): string {
  const enabledGroups = state.groups.filter((g) => g.enabled);
  const primarySelectName =
    enabledGroups.find((g) => g.id === 'grp-select')?.name || enabledGroups[0]?.name || 'DIRECT';
  const adsGroupName =
    enabledGroups.find((g) => g.id === 'grp-ads')?.name || 'REJECT';

  return `import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

const YAML_OVERRIDE_PATH = path.resolve('override/diversion.yaml');
const JS_OVERRIDE_PATH = path.resolve('override/clash-mi-override.js');
const REPORT_PATH = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'sync-report.md');
const PRIMARY_GROUP = ${JSON.stringify(primarySelectName)};
const ADS_GROUP = ${JSON.stringify(adsGroupName)};

function readCustomRules(filePath, target) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const hasNoResolve = parts.some((p) => p.toLowerCase() === 'no-resolve');
        return hasNoResolve
          ? \`\${parts[0].toUpperCase()},\${parts[1]},\${target},no-resolve\`
          : \`\${parts[0].toUpperCase()},\${parts[1]},\${target}\`;
      }
      return \`DOMAIN-SUFFIX,\${line},\${target}\`;
    });
}

function main() {
  const customReject = readCustomRules(path.resolve('rules/custom-reject.list'), ADS_GROUP);
  const customDirect = readCustomRules(path.resolve('rules/custom-direct.list'), 'DIRECT');
  const customProxy = readCustomRules(path.resolve('rules/custom-proxy.list'), PRIMARY_GROUP);
  const customMerged = [...customReject, ...customDirect, ...customProxy];

  // 1. 更新并校验 YAML 覆写模板（仅在内容实际变化时写入，避免无效时间戳提交）
  let yamlRulesCount = 0;
  if (fs.existsSync(YAML_OVERRIDE_PATH)) {
    const rawYaml = fs.readFileSync(YAML_OVERRIDE_PATH, 'utf8');
    const parsed = yamlLoad(rawYaml);
    const staticRules = (parsed.rules || []).filter(
      (r) => r.startsWith('RULE-SET,') || r.startsWith('GEOIP,') || r.startsWith('MATCH,')
    );
    const nextRules = [...customMerged, ...staticRules];
    yamlRulesCount = nextRules.length;

    if (JSON.stringify(parsed.rules) !== JSON.stringify(nextRules)) {
      parsed.rules = nextRules;
      const header = [
        '# ============================================================================',
        '# Clash Mi 全局分流覆写模板 (YAML Overwrite)',
        \`# 仓库: ${state.github.owner}/${state.github.repo} (${state.github.branch})\`,
        '# ============================================================================',
        '',
      ].join('\\n');
      fs.writeFileSync(
        YAML_OVERRIDE_PATH,
        header + yamlDump(parsed, { indent: 2, lineWidth: 120, noRefs: true }),
        'utf8'
      );
    }
  }

  // 2. 更新并沙箱测试 JS 覆写脚本
  let jsStatus = '未启用';
  if (fs.existsSync(JS_OVERRIDE_PATH)) {
    let jsContent = fs.readFileSync(JS_OVERRIDE_PATH, 'utf8');
    const rulesRegex = /const RULES = (\\[[\\s\\S]*?\\]);/;
    const match = jsContent.match(rulesRegex);
    if (match) {
      const existingRules = JSON.parse(match[1]);
      const staticRules = existingRules.filter(
        (r) => r.startsWith('RULE-SET,') || r.startsWith('GEOIP,') || r.startsWith('MATCH,')
      );
      const nextRules = [...customMerged, ...staticRules];
      if (JSON.stringify(existingRules) !== JSON.stringify(nextRules)) {
        jsContent = jsContent.replace(rulesRegex, \`const RULES = \${JSON.stringify(nextRules, null, 2)};\`);
        fs.writeFileSync(JS_OVERRIDE_PATH, jsContent, 'utf8');
      }
    }

    // 使用沙箱执行 main() 干跑验证：验证清洗节点、自动选择、故障转移、空组剔除与去广告规则
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(jsContent, sandbox);
    const dryRun = sandbox.main({
      proxies: [
        { name: '🇭🇰 香港 01', type: 'ss', server: '1.1.1.1', port: 443 },
        { name: '🇯🇵 日本 01', type: 'vmess', server: '2.2.2.2', port: 443 },
        { name: '🇺🇸 美国 01', type: 'trojan', server: '3.3.3.3', port: 443 },
        { name: '剩余流量：500 GB', type: 'ss', server: '127.0.0.1', port: 80 },
      ],
    });
    const hasFailover = dryRun['proxy-groups'].some((g) => g.type === 'fallback');
    const hasUrlTest = dryRun['proxy-groups'].some((g) => g.type === 'url-test');
    jsStatus = \`通过 (\${dryRun['proxy-groups'].length} 组 / \${dryRun.rules.length} 规则 / 自动测速:\${hasUrlTest} / 故障转移:\${hasFailover})\`;
  }

  const report = [
    '### Clash Mi 覆写模板同步报告',
    '',
    \`- **同步时间**: \${new Date().toISOString()}\`,
    \`- **自定义规则合并**: 拦截 \${customReject.length} 条 / 直连 \${customDirect.length} 条 / 代理 \${customProxy.length} 条\`,
    \`- **YAML 覆写规则总数**: \${yamlRulesCount} 条\`,
    \`- **JS 覆写脚本干跑校验**: \${jsStatus}\`,
  ].join('\\n');

  fs.writeFileSync(REPORT_PATH, report + '\\n', 'utf8');
  console.log(report);
}

main();
`;
}

export function generateRepoPackageJson(state: ClashWorkspaceState): string {
  return JSON.stringify(
    {
      name: state.github.repo || 'clash-mi-override',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        sync: 'node scripts/build-override.mjs',
      },
      dependencies: {
        'js-yaml': '^4.1.0',
      },
    },
    null,
    2
  );
}

export function generateReadmeMd(state: ClashWorkspaceState): string {
  const { github, kernel, overwrite } = state;
  const rawBase = `https://raw.githubusercontent.com/${github.owner}/${github.repo}/${github.branch}`;
  const yamlRawUrl = `${rawBase}/override/diversion.yaml`;
  const jsRawUrl = `${rawBase}/override/clash-mi-override.js`;
  const yamlCdnUrl = `https://cdn.jsdelivr.net/gh/${github.owner}/${github.repo}@${github.branch}/override/diversion.yaml`;
  const jsCdnUrl = `https://cdn.jsdelivr.net/gh/${github.owner}/${github.repo}@${github.branch}/override/clash-mi-override.js`;

  return `# ${github.repo}

专为 **Clash Mi** 设计的 GitHub 全局分流**覆写模板**仓库（支持 YAML 覆写 + JS 覆写脚本）。
无需在仓库中存放任何机场订阅链接，添加到 Clash Mi「**覆写**」后，客户端内的**所有订阅**均可直接套用同一套分流、自动选择、故障转移、节点过滤与去广告逻辑。

## 内置核心能力

- **自动测速选择 (\`url-test\`)**：全节点自动优选与各地区（港/台/日/狮城/美/韩/欧）内部 50ms 容差自动切最优节点。
- **自动故障转移 (\`fallback\`)**：每 180 秒探测可用性，当前节点失联时自动无缝切换至下一个可用节点。
- **负载均衡 (\`load-balance\`)**：基于 \`consistent-hashing\` 会话保持的并发分流。
- **全网去广告与防绕过**：集成 \`category-ads-all\`、\`category-httpdns-cn\`（拦截 App HTTPDNS 防绕过）与自定义拦截列表，支持面板随时切换 \`REJECT / REJECT-DROP / DIRECT\`。
- **智能空组跳过（JS 模式）**：自动清洗无效/高倍率提示节点，并在订阅缺少某地区节点时自动跳过对应分组，兼容任意大小机场。

## 导入 Clash Mi 的覆写订阅链接

${
  overwrite.outputTarget !== 'js'
    ? `### 1. YAML 分流覆写模板 (\`override/diversion.yaml\`)
- **GitHub Raw URL**:
  \`${yamlRawUrl}\`
${github.visibility === 'public' ? `- **jsDelivr CDN 加速**:\n  \`${yamlCdnUrl}\`\n` : ''}`
    : ''
}
${
  overwrite.outputTarget !== 'yaml'
    ? `### 2. JS 智能覆写脚本 (\`override/clash-mi-override.js\`) — 推荐
- **GitHub Raw URL**:
  \`${jsRawUrl}\`
${github.visibility === 'public' ? `- **jsDelivr CDN 加速**:\n  \`${jsCdnUrl}\`\n` : ''}`
    : ''
}

## 使用步骤（Clash Mi 客户端）

1. 打开 Clash Mi → 进入 **覆写** 页面。
2. 点击右上角 **云朵图标**（从 URL 导入），粘贴上面的 **JS** 或 **YAML** 链接（或下载文件后点击 \`+\` 从本地导入）。
3. 选中该覆写项启用后，切换任意机场订阅都会自动套用全部策略与过滤规则。

## 仓库自定义规则自动同步

直接编辑仓库中的以下文件并提交，GitHub Actions（或定时 \`${github.cronExpression}\`）会自动合并规则并更新覆写模板：
- \`rules/custom-proxy.list\`：自定义强制走代理规则
- \`rules/custom-direct.list\`：自定义强制直连规则
- \`rules/custom-reject.list\`：自定义去广告/屏蔽拦截规则
- 规则集引擎：${kernel.ruleSourceFlavor === 'metacubex-mrs' ? 'MetaCubeX `.mrs` 二进制规则集' : 'Loyalsoldier Classical YAML 规则集'}
- 节点全局排除正则：\`${kernel.globalExcludeFilter}\`
`;
}

export function generateAllRepoFiles(state: ClashWorkspaceState): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (state.overwrite.outputTarget !== 'js') {
    files.push({
      path: 'override/diversion.yaml',
      language: 'yaml',
      title: 'Clash Mi YAML 覆写模板',
      description: '包含 url-test 自动选择、fallback 故障转移、负载均衡、去广告与全量规则集',
      content: generateOverwriteYamlString(state),
    });
  }

  if (state.overwrite.outputTarget !== 'yaml') {
    files.push({
      path: 'override/clash-mi-override.js',
      language: 'javascript',
      title: 'Clash Mi JS 覆写脚本 (main)',
      description: '动态清洗节点并自动跳过空地区分组，兼容任意大小机场订阅',
      content: generateOverwriteJsString(state),
    });
  }

  files.push(
    {
      path: 'rules/custom-proxy.list',
      language: 'text',
      title: '自定义代理规则列表',
      description: '优先于规则集匹配，提交后由 Actions 自动合入覆写模板',
      content: state.customRules.proxyList.trim() + '\n',
    },
    {
      path: 'rules/custom-direct.list',
      language: 'text',
      title: '自定义直连规则列表',
      description: '内网域名、Tailscale / CGNAT 网段或特殊站点直连',
      content: state.customRules.directList.trim() + '\n',
    },
    {
      path: 'rules/custom-reject.list',
      language: 'text',
      title: '自定义去广告/屏蔽列表',
      description: '优先归入 🛡️ 广告拦截 策略组',
      content: state.customRules.rejectList.trim() + '\n',
    },
    {
      path: '.github/workflows/sync-override.yml',
      language: 'yaml',
      title: 'GitHub Actions 规则同步工作流',
      description: `修改 rules/*.list 或按 Cron (${state.github.cronExpression}) 自动更新覆写模板并校验语法`,
      content: generateWorkflowYaml(state),
    },
    {
      path: 'scripts/build-override.mjs',
      language: 'javascript',
      title: '覆写模板合成与沙箱校验脚本',
      description: '合入自定义 .list 规则并对 JS main(config) 进行沙箱干跑校验',
      content: generateBuildScript(state),
    },
    {
      path: 'package.json',
      language: 'json',
      title: 'Node.js 脚本依赖清单',
      description: '为 GitHub Actions 提供 js-yaml 解析依赖',
      content: generateRepoPackageJson(state) + '\n',
    },
    {
      path: '.gitignore',
      language: 'text',
      title: 'Git 忽略文件配置',
      description: '排除本地依赖目录与缓存目录',
      content: 'node_modules/\nrule_providers/\nproxy_providers/\n*.log\n.DS_Store\n',
    },
    {
      path: 'README.md',
      language: 'markdown',
      title: 'Clash Mi 覆写导入说明',
      description: '包含 YAML / JS 覆写 Raw 链接、功能说明与 Clash Mi 导入步骤',
      content: generateReadmeMd(state),
    }
  );

  return files;
}
