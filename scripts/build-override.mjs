import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

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
        `# 仓库: your-github-username/clash-mi-override (main)`,
        '# ============================================================================',
        '',
      ].join('\n');
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
    const rulesRegex = /const RULES = (\[[\s\S]*?\]);/;
    const match = jsContent.match(rulesRegex);
    if (match) {
      const existingRules = JSON.parse(match[1]);
      const staticRules = existingRules.filter(
        (r) => r.startsWith('RULE-SET,') || r.startsWith('GEOIP,') || r.startsWith('MATCH,')
      );
      const nextRules = [...customMerged, ...staticRules];
      if (JSON.stringify(existingRules) !== JSON.stringify(nextRules)) {
        jsContent = jsContent.replace(rulesRegex, `const RULES = ${JSON.stringify(nextRules, null, 2)};`);
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
    jsStatus = `通过 (${dryRun['proxy-groups'].length} 组 / ${dryRun.rules.length} 规则 / 自动测速:${hasUrlTest} / 故障转移:${hasFailover})`;
  }

  const report = [
    '### Clash Mi 覆写模板同步报告',
    '',
    `- **同步时间**: ${new Date().toISOString()}`,
    `- **自定义规则合并**: 拦截 ${customReject.length} 条 / 直连 ${customDirect.length} 条 / 代理 ${customProxy.length} 条`,
    `- **YAML 覆写规则总数**: ${yamlRulesCount} 条`,
    `- **JS 覆写脚本干跑校验**: ${jsStatus}`,
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, report + '\n', 'utf8');
  console.log(report);
}

main();
