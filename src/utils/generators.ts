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

function parseDnsServers(raw: string, fallback: string[]): string[] {
  const list = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : fallback;
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
    const chosenUrl = isMrs ? mod.mrsUrl : mod.yamlUrl;
    const fmt = chosenUrl.endsWith('.mrs')
      ? 'mrs'
      : chosenUrl.endsWith('.txt')
        ? 'text'
        : 'yaml';
    const ext = fmt === 'text' ? 'txt' : fmt;
    const resolvedBehavior = isMrs
      ? mod.mrsBehavior || (fmt === 'mrs' && mod.behavior === 'classical' ? 'domain' : mod.behavior)
      : mod.behavior;
    ruleProvidersObj[mod.providerName] = {
      type: 'http',
      behavior: resolvedBehavior,
      format: fmt,
      url: chosenUrl,
      path: `./rule_providers/${mod.providerName}.${ext}`,
      interval: mod.interval,
    };
  }

  const rulesList: string[] = [
    ...parseCustomRuleLines(customRules.rejectList, adsGroupName),
    ...parseCustomRuleLines(customRules.directList, 'DIRECT'),
    ...parseCustomRuleLines(customRules.proxyList, primarySelectName),
  ];

  const youtubeEnabled = enabledRules.some((r) => r.providerName === 'youtube');
  if (youtubeEnabled) {
    // 拦截 YouTube QUIC (UDP 443)，强制走 TCP 提升稳定性与分流/广告域名嗅探命中率
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,youtube)),REJECT-DROP');
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,googlevideo.com)),REJECT-DROP');
  }
  const adsAllEnabled = enabledRules.some((r) => r.providerName === 'category-ads-all');
  if (adsAllEnabled) {
    // 阻断广告 SDK 通过 QUIC (UDP 443) 绕过规则拦截
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,category-ads-all)),REJECT-DROP');
  }
  const awavenueEnabled =
    enabledRules.some((r) => r.providerName === 'awavenue-ads') &&
    ruleProvidersObj['awavenue-ads']?.behavior === 'domain';
  if (awavenueEnabled) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,awavenue-ads)),REJECT-DROP');
  }
  if (enabledRules.some((r) => r.providerName === 'adblock-ultra')) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,adblock-ultra)),REJECT-DROP');
  }
  if (enabledRules.some((r) => r.providerName === 'hagezi-pro-plus')) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,hagezi-pro-plus)),REJECT-DROP');
  }

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
    config['sniffer!'] = {
      enable: true,
      'force-dns-mapping': true,
      'parse-pure-ip': true,
      'override-destination': true,
      sniff: {
        HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
        TLS: { ports: [443, 8443] },
        QUIC: { ports: [443, 8443] },
      },
    };
  }

  if (overwrite.overwriteDns) {
    const enabledProviderSet = new Set(enabledRules.map((r) => r.providerName));
    const fakeIpRuleSets = ['private', 'cn-domain']
      .filter((name) => enabledProviderSet.has(name))
      .map((name) => `RULE-SET:${name}`);
    const adDomainProviders = enabledRules
      .filter(
        (r) =>
          r.category === 'reject' &&
          ruleProvidersObj[r.providerName]?.behavior === 'domain'
      )
      .map((r) => r.providerName);
    const adFakeIpRuleSets =
      overwrite.dnsAdSinkhole !== false
        ? adDomainProviders.map((name) => `RULE-SET:${name}`)
        : [];
    const chinaPolicyRuleSets = ['private', 'cn-domain', 'apple-cn', 'microsoft-cn'].filter((name) =>
      enabledProviderSet.has(name)
    );
    const chinaDnsList = parseDnsServers(kernel.dohChina || '', [
      'https://dns.alidns.com/dns-query',
      'https://doh.pub/dns-query',
    ]);
    const globalDnsList = parseDnsServers(kernel.dohGlobal || '', [
      'https://dns.google/dns-query',
      'https://1.1.1.1/dns-query',
      'tls://8.8.8.8:853',
    ]);
    const nameserverPolicy: Record<string, string[]> = {};
    if (overwrite.dnsAdSinkhole !== false) {
      if (adDomainProviders.length > 0) {
        nameserverPolicy[`RULE-SET:${adDomainProviders.join(',')}`] = ['rcode://success'];
      }
      nameserverPolicy['geosite:category-ads-all'] = ['rcode://success'];
    }
    nameserverPolicy['geosite:cn,private'] = chinaDnsList;
    nameserverPolicy['geosite:geolocation-!cn'] = globalDnsList;
    if (chinaPolicyRuleSets.length > 0) {
      nameserverPolicy[`RULE-SET:${chinaPolicyRuleSets.join(',')}`] = chinaDnsList;
    }

    config['dns!'] = {
      enable: true,
      ipv6: kernel.ipv6,
      'respect-rules': true,
      'enhanced-mode': kernel.dnsMode,
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': [
        '+.lan',
        '+.local',
        'localhost.ptlogin2.qq.com',
        '+.msftconnecttest.com',
        '+.msftncsi.com',
        ...fakeIpRuleSets,
        ...adFakeIpRuleSets,
      ],
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'proxy-server-nameserver': ['223.5.5.5', '119.29.29.29', ...chinaDnsList],
      'direct-nameserver': chinaDnsList,
      nameserver: globalDnsList,
      'nameserver-policy': nameserverPolicy,
    };
  }

  config['proxy-groups!'] = proxyGroupsArr;
  if (Object.keys(ruleProvidersObj).length > 0) {
    config['rule-providers!'] = ruleProvidersObj;
  }
  config['rules!'] = rulesList;

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
  const chinaDnsList = parseDnsServers(kernel.dohChina || '', [
    'https://dns.alidns.com/dns-query',
    'https://doh.pub/dns-query',
  ]);
  const globalDnsList = parseDnsServers(kernel.dohGlobal || '', [
    'https://dns.google/dns-query',
    'https://1.1.1.1/dns-query',
    'tls://8.8.8.8:853',
  ]);
  const ruleProvidersObj: Record<string, Record<string, unknown>> = {};
  const enabledRules = ruleModules.filter((r) => r.enabled);

  for (const mod of enabledRules) {
    const chosenUrl = isMrs ? mod.mrsUrl : mod.yamlUrl;
    const fmt = chosenUrl.endsWith('.mrs')
      ? 'mrs'
      : chosenUrl.endsWith('.txt')
        ? 'text'
        : 'yaml';
    const ext = fmt === 'text' ? 'txt' : fmt;
    const resolvedBehavior = isMrs
      ? mod.mrsBehavior || (fmt === 'mrs' && mod.behavior === 'classical' ? 'domain' : mod.behavior)
      : mod.behavior;
    ruleProvidersObj[mod.providerName] = {
      type: 'http',
      behavior: resolvedBehavior,
      format: fmt,
      url: chosenUrl,
      path: `./rule_providers/${mod.providerName}.${ext}`,
      interval: mod.interval,
    };
  }

  const rulesList: string[] = [
    ...parseCustomRuleLines(customRules.rejectList, adsGroupName),
    ...parseCustomRuleLines(customRules.directList, 'DIRECT'),
    ...parseCustomRuleLines(customRules.proxyList, primarySelectName),
  ];

  const youtubeEnabled = enabledRules.some((r) => r.providerName === 'youtube');
  if (youtubeEnabled) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,youtube)),REJECT-DROP');
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,googlevideo.com)),REJECT-DROP');
  }
  const adsAllEnabled = enabledRules.some((r) => r.providerName === 'category-ads-all');
  if (adsAllEnabled) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,category-ads-all)),REJECT-DROP');
  }
  const awavenueEnabled =
    enabledRules.some((r) => r.providerName === 'awavenue-ads') &&
    ruleProvidersObj['awavenue-ads']?.behavior === 'domain';
  if (awavenueEnabled) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,awavenue-ads)),REJECT-DROP');
  }
  if (enabledRules.some((r) => r.providerName === 'adblock-ultra')) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,adblock-ultra)),REJECT-DROP');
  }
  if (enabledRules.some((r) => r.providerName === 'hagezi-pro-plus')) {
    rulesList.push('AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,hagezi-pro-plus)),REJECT-DROP');
  }

  const adDomainProviders = enabledRules
    .filter(
      (r) =>
        r.category === 'reject' &&
        ruleProvidersObj[r.providerName]?.behavior === 'domain'
    )
    .map((r) => r.providerName);

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

const AD_DOMAIN_PROVIDERS = ${JSON.stringify(adDomainProviders)};

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
  if (!config || typeof config !== 'object') {
    config = {};
  }
  var rawProxies = Array.isArray(config.proxies) ? config.proxies : [];
  var globalExcludeRe = compileRegex(GLOBAL_EXCLUDE);

  // 1. 清洗当前订阅的无效/提示/高倍率节点
  var cleanProxies = STRIP_EXCLUDED_PROXIES
    ? rawProxies.filter(function (p) {
        return p && p.name && !(globalExcludeRe && globalExcludeRe.test(p.name));
      })
    : rawProxies;

  if (STRIP_EXCLUDED_PROXIES && cleanProxies.length > 0) {
    config.proxies = cleanProxies;
  }

  var allProxyNames = (config.proxies || [])
    .map(function (p) {
      return p.name;
    })
    .filter(Boolean);

  // 2. 动态匹配每个节点策略组（支持 inline proxies 与 proxy-providers，确保节点列表完整可见）
  var hasProviders = Boolean(
    config['proxy-providers'] && Object.keys(config['proxy-providers']).length > 0
  );
  var activeGroupNames = { DIRECT: true, REJECT: true, 'REJECT-DROP': true };
  var builtGroups = [];

  for (var i = 0; i < GROUP_SPECS.length; i++) {
    var spec = GROUP_SPECS[i];
    if (spec.includeAllProxies) {
      var includeRe = compileRegex(spec.filter);
      var excludeRe = compileRegex(spec.excludeFilter || GLOBAL_EXCLUDE);
      var matchedNames = allProxyNames.filter(function (name) {
        if (excludeRe && excludeRe.test(name)) return false;
        if (includeRe && !includeRe.test(name)) return false;
        return true;
      });

      // 若使用 inline proxies 且当前地区无节点，自动跳过该地区组（保留含子策略组的主选择组）
      var hasSubProxies = Array.isArray(spec.proxies) && spec.proxies.length > 0;
      if (!hasProviders && SKIP_EMPTY_REGION_GROUPS && matchedNames.length === 0 && !hasSubProxies) {
        continue;
      }

      var grpObj = {
        name: spec.name,
        type: spec.type,
        _isNodeGroup: !hasSubProxies,
        _subRefs: hasSubProxies ? spec.proxies : [],
        _matchedNodes: matchedNames,
      };
      if (allProxyNames.length === 0 && hasProviders) {
        grpObj['include-all'] = true;
        if (spec.filter) grpObj.filter = spec.filter;
        if (spec.excludeFilter || GLOBAL_EXCLUDE) {
          grpObj['exclude-filter'] = spec.excludeFilter || GLOBAL_EXCLUDE;
        }
      } else {
        grpObj.proxies = matchedNames.length > 0 ? matchedNames : ['DIRECT'];
      }
      if (spec.type === 'url-test' || spec.type === 'fallback') {
        grpObj.url = spec.url || 'https://www.gstatic.com/generate_204';
        grpObj.interval = spec.interval || 300;
        if (spec.type === 'url-test') {
          grpObj.tolerance = typeof spec.tolerance === 'number' ? spec.tolerance : 50;
        }
      } else if (spec.type === 'load-balance') {
        grpObj.url = spec.url || 'https://www.gstatic.com/generate_204';
        grpObj.interval = spec.interval || 300;
        grpObj.strategy = spec.strategy || 'consistent-hashing';
      }
      builtGroups.push(grpObj);
      activeGroupNames[spec.name] = true;
    } else {
      builtGroups.push({
        name: spec.name,
        type: spec.type,
        proxies: spec.proxies,
        _isNodeGroup: false,
        _subRefs: spec.proxies || [],
        _matchedNodes: [],
      });
      activeGroupNames[spec.name] = true;
    }
  }

  // 3. 清理聚合选择组中已被跳过的空地区引用，并把节点列表合并到 🚀 节点选择 底部
  config['proxy-groups'] = builtGroups.map(function (grp) {
    var isNodeGroup = grp._isNodeGroup;
    var subRefs = grp._subRefs || [];
    var matchedNodes = grp._matchedNodes || [];
    delete grp._isNodeGroup;
    delete grp._subRefs;
    delete grp._matchedNodes;

    if (isNodeGroup) {
      return grp;
    }
    var validRefs = subRefs.filter(function (ref) {
      return Boolean(activeGroupNames[ref]) || allProxyNames.indexOf(ref) !== -1;
    });
    var merged = validRefs.concat(matchedNodes);
    var out = {
      name: grp.name,
      type: grp.type,
    };
    if (grp['include-all']) {
      out['include-all'] = true;
      if (grp.filter) out.filter = grp.filter;
      if (grp['exclude-filter']) out['exclude-filter'] = grp['exclude-filter'];
    }
    out.proxies =
      merged.length > 0
        ? merged
        : allProxyNames.length > 0
          ? allProxyNames
          : ['DIRECT'];
    return out;
  });

  // 4. 注入 rule-providers 与分流规则
  config['rule-providers'] = Object.assign({}, config['rule-providers'] || {}, RULE_PROVIDERS);
  config.rules = RULES;

  // 5. 覆写 DNS 与 Sniffer（兼容 Clash Mi 1.0.32 Android 序列化与校验规则）
  if (OVERWRITE_SNIFFER) {
    config.sniffer = {
      enable: true,
      'force-dns-mapping': true,
      'parse-pure-ip': true,
      'override-destination': true,
      sniff: {
        HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
        TLS: { ports: [443, 8443] },
        QUIC: { ports: [443, 8443] },
      },
    };
  }

  if (OVERWRITE_DNS) {
    var fakeIpFilterList = [
      '+.lan',
      '+.local',
      'localhost.ptlogin2.qq.com',
      '+.msftconnecttest.com',
      '+.msftncsi.com',
    ];
    if (RULE_PROVIDERS['private']) fakeIpFilterList.push('RULE-SET:private');
    if (RULE_PROVIDERS['cn-domain']) fakeIpFilterList.push('RULE-SET:cn-domain');

    var adDomainKeys = AD_DOMAIN_PROVIDERS.filter(function (k) {
      var rp = RULE_PROVIDERS[k];
      return Boolean(rp && rp.behavior === 'domain');
    });

    var chinaPolicyProviders = ['private', 'cn-domain', 'apple-cn', 'microsoft-cn'].filter(function (k) {
      return Boolean(RULE_PROVIDERS[k]);
    });
    var dnsPolicy = {};
    if (${JSON.stringify(overwrite.dnsAdSinkhole !== false)}) {
      for (var ak = 0; ak < adDomainKeys.length; ak++) {
        fakeIpFilterList.push('RULE-SET:' + adDomainKeys[ak]);
      }
      if (adDomainKeys.length > 0) {
        dnsPolicy['RULE-SET:' + adDomainKeys.join(',')] = ['rcode://success'];
      }
      dnsPolicy['geosite:category-ads-all'] = ['rcode://success'];
    }
    dnsPolicy['geosite:cn,private'] = ${JSON.stringify(chinaDnsList)};
    dnsPolicy['geosite:geolocation-!cn'] = ${JSON.stringify(globalDnsList)};
    if (chinaPolicyProviders.length > 0) {
      dnsPolicy['RULE-SET:' + chinaPolicyProviders.join(',')] = ${JSON.stringify(chinaDnsList)};
    }

    config.dns = {
      enable: true,
      ipv6: ${JSON.stringify(kernel.ipv6)},
      'respect-rules': true,
      'enhanced-mode': ${JSON.stringify(kernel.dnsMode)},
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': fakeIpFilterList,
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'proxy-server-nameserver': ${JSON.stringify(['223.5.5.5', '119.29.29.29', ...chinaDnsList])},
      'direct-nameserver': ${JSON.stringify(chinaDnsList)},
      nameserver: ${JSON.stringify(globalDnsList)},
      'nameserver-policy': dnsPolicy,
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
  const triggerBranches = Array.from(new Set([github.branch || 'main', 'main', 'master']));

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
${triggerBranches.map((b) => `      - '${b}'`).join('\n')}
    paths:
      - 'rules/**'
      - 'scripts/build-override.mjs'

permissions:
  contents: write

jobs:
  sync-override:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout 仓库代码
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: 配置 Node.js 运行环境
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: 合并 rules/*.list 到 YAML / JS 覆写模板并执行双模式沙箱校验（零依赖）
        run: node scripts/build-override.mjs
${summaryBlock}
      - name: 自动提交更新后的覆写模板
        run: |
          if [ -n "$(git status --porcelain override/)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add override/
            git commit -m "${github.commitMessage}"
            git pull --rebase origin "\${{ github.ref_name }}" || true
            if ! git push; then
              echo "::error::git push 失败，请前往 GitHub 仓库 Settings -> Actions -> General -> Workflow permissions 选择 Read and write permissions。"
              exit 1
            fi
          else
            echo "覆写模板无实质变更，跳过提交。"
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

// 纯 Node.js 内置模块实现（零 npm 外部依赖，彻底避免 GitHub Actions npm install 报错）
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

function unquoteYamlScalar(raw) {
  const s = raw.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function formatYamlListItem(val) {
  const needsQuotes =
    /^[*!&@%\`|>?{}\\[\\]]/.test(val) || val.includes(': ') || val.includes(' #');
  return needsQuotes ? \`  - '\${val.replace(/'/g, "''")}'\` : \`  - \${val}\`;
}

function syncYamlRulesSection(rawYaml, customMerged) {
  const normalized = rawYaml.replace(/\\r\\n/g, '\\n');
  if (/^\\t+/m.test(normalized)) {
    throw new Error('YAML 缩进包含 Tab 字符，请统一使用空格');
  }
  if (!/^proxy-groups!?:/m.test(normalized)) {
    throw new Error('YAML 缺少 proxy-groups 配置块');
  }
  const rulesHeaderMatch = normalized.match(/^rules!?:\\s*$/m);
  if (!rulesHeaderMatch || typeof rulesHeaderMatch.index !== 'number') {
    throw new Error('YAML 缺少 rules / rules! 配置块');
  }

  const headerEnd = rulesHeaderMatch.index + rulesHeaderMatch[0].length;
  const beforeRules = normalized.slice(0, headerEnd);
  const afterHeader = normalized.slice(headerEnd);
  const nextTopKeyMatch = afterHeader.match(/\\n[a-zA-Z0-9_-]+!?:\\s*/);
  const rulesBlock = nextTopKeyMatch ? afterHeader.slice(0, nextTopKeyMatch.index) : afterHeader;
  const trailingSection = nextTopKeyMatch ? afterHeader.slice(nextTopKeyMatch.index) : '';

  const currentRules = rulesBlock
    .split('\\n')
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
  const rpMatch = beforeRules.match(/^rule-providers!?:\\n([\\s\\S]*?)(?=^[a-zA-Z0-9_-]+!?:|(?![\\s\\S]))/m);
  if (rpMatch) {
    for (const line of rpMatch[1].split('\\n')) {
      const m = line.match(/^  ([a-zA-Z0-9_-]+):\\s*$/);
      if (m) declaredProviders.add(m[1]);
    }
  }
  if (declaredProviders.size > 0) {
    for (const r of nextRules) {
      const m = r.match(/^RULE-SET,([^,]+),/);
      if (m && !declaredProviders.has(m[1])) {
        throw new Error(\`RULE-SET 引用了未定义的 provider: \${m[1]}\`);
      }
    }
  }

  const changed = JSON.stringify(currentRules) !== JSON.stringify(nextRules);
  const nextContent =
    beforeRules +
    '\\n' +
    nextRules.map(formatYamlListItem).join('\\n') +
    (trailingSection || '\\n');

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
    const rulesRegex = /const RULES = (\\[[\\s\\S]*?\\]);/;
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
        jsContent = jsContent.replace(rulesRegex, \`const RULES = \${JSON.stringify(nextRules, null, 2)};\`);
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

    jsStatus = \`通过 (\${dryRun['proxy-groups'].length} 组 / \${dryRun.rules.length} 规则 / 自动测速首位:\${autoIsFirst} / 节点列表可见:\${hasDirectNodesInSelect} / DNS广告黑洞:\${hasDnsSinkhole})\`;
  }

  const report = [
    '### Clash Mi 覆写模板同步报告',
    '',
    \`- **同步时间**: \${new Date().toISOString()}\`,
    \`- **自定义规则合并**: 拦截 \${customReject.length} 条 / 直连 \${customDirect.length} 条 / 代理 \${customProxy.length} 条\`,
    \`- **YAML 覆写规则总数**: \${yamlRulesCount} 条\`,
    \`- **JS 覆写脚本双模式干跑校验**: \${jsStatus}\`,
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
        'fetch-nodes': 'node scripts/fetch-nodes.mjs',
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

- **自动测速优先 (\`url-test\`)**：\`♻️ 自动测速优选\` 置于策略组与主选择组第一位置，全节点与各地区组支持 50ms 容差自动切最优节点。
- **完整节点列表可见**：主组 \`🚀 节点选择\` 同时保留地区分组与全部清洗后单节点，另附独立 \`🎯 手动节点列表\`，兼容 \`proxies\` 与 \`proxy-providers\` 订阅。
- **自动故障转移 (\`fallback\`)**：每 180 秒探测可用性，当前节点失联时自动无缝切换至下一个可用节点。
- **负载均衡 (\`load-balance\`)**：基于 \`consistent-hashing\` 会话保持的并发分流。
- **分级多引擎去广告、隐私保护与 YouTube 优化**（当前等级：\`${kernel.adBlockLevel || 'balanced'}\`）：支持按设备性能一键切换轻量 / 均衡 / 极客满血去广告（最高 11 大引擎），集成 **HaGeZi Multi PRO++**、**AdGuard 基础 (SDNS)**、**blackmatrix7 Privacy 隐私追踪 / Hijacking 反劫持 / 移动端广告增强**、**AWAvenue-Ads（秋风 .mrs）**、**217heidai AdGuard+EasyList 全量**、**Cats-Team AdRules**、**anti-AD** 与 **HTTPDNS 拦截**，开启 TLS/QUIC \`override-destination\` 深度嗅探并全链路阻断 YouTube 与广告 SDK 的 QUIC UDP 443。
- **智能空组跳过（JS 模式）**：自动清洗无效/高倍率提示节点（保留 \`10Gbps\`、\`GB\` 节点），并在订阅缺少某地区节点时自动跳过对应分组。

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
${
  state.nodeSubscription?.enabled
    ? `### 3. 每日自动提取节点订阅 (\`subscriptions/\`)
- **Clash Mi YAML 节点订阅**:
  \`${rawBase}/subscriptions/clash-mi-nodes.yaml\`
- **通用 Base64 节点订阅**:
  \`${rawBase}/subscriptions/nodes-base64.txt\`
- **纯文本分享链接**:
  \`${rawBase}/subscriptions/nodes-raw.txt\`
`
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

export function generateNodeSourcesTxt(state: ClashWorkspaceState): string {
  return (state.nodeSubscription?.sourcesList || '').trim() + '\n';
}

export function generateNodeFetchWorkflowYaml(state: ClashWorkspaceState): string {
  const { github, nodeSubscription } = state;
  const triggerBranches = Array.from(new Set([github.branch || 'main', 'main', 'master']));
  const cronExpr = (nodeSubscription?.cronExpression || '0 22 * * *').trim();

  const summaryBlock = github.enableStepSummary
    ? `
      - name: 输出每日节点提取摘要
        if: always()
        run: |
          if [ -f "$RUNNER_TEMP/node-fetch-report.md" ]; then
            cat "$RUNNER_TEMP/node-fetch-report.md" >> $GITHUB_STEP_SUMMARY
          fi`
    : '';

  return `name: Daily Fetch Nodes & Generate Subscription

on:
  schedule:
    # 每日定时提取上游节点并生成订阅 (UTC): ${cronExpr}
    - cron: '${cronExpr}'
  workflow_dispatch:
  push:
    branches:
${triggerBranches.map((b) => `      - '${b}'`).join('\n')}
    paths:
      - 'rules/node-sources.txt'
      - 'scripts/fetch-nodes.mjs'

permissions:
  contents: write

jobs:
  fetch-nodes:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout 仓库代码
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: 配置 Node.js 运行环境
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: 提取上游节点并生成 Clash Mi / Base64 订阅（零依赖）
        run: node scripts/fetch-nodes.mjs
${summaryBlock}
      - name: 自动提交更新后的节点订阅
        run: |
          if [ -n "$(git status --porcelain subscriptions/)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add subscriptions/
            git commit -m "chore(sub): daily update extracted nodes subscription"
            git pull --rebase origin "\${{ github.ref_name }}" || true
            if ! git push; then
              echo "::error::git push 失败，请前往 GitHub 仓库 Settings -> Actions -> General -> Workflow permissions 选择 Read and write permissions。"
              exit 1
            fi
          else
            echo "节点订阅无实质变更，跳过提交。"
          fi
`;
}

export function generateFetchNodesScript(): string {
  return `import fs from 'node:fs';
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
    throw new Error(\`未找到节点源列表文件: \${SOURCES_PATH}\`);
  }
  return fs
    .readFileSync(SOURCES_PATH, 'utf8')
    .replace(/\\r\\n/g, '\\n')
    .split('\\n')
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
      throw new Error(\`HTTP \${res.status}\`);
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
      const portMatch = rest.match(/^:(\\d+)/);
      return { host, port: portMatch ? Number(portMatch[1]) : 443 };
    }
  }
  const colonCount = (val.match(/:/g) || []).length;
  if (colonCount === 1) {
    const idx = val.lastIndexOf(':');
    const host = val.slice(0, idx).trim();
    const portMatch = val.slice(idx + 1).match(/^(\\d+)/);
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
  if (/^-?\\d+$/.test(s)) return Number(s);
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
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseInlineObject(rawObj) {
  const inner = rawObj.trim().slice(1, -1).trim();
  const obj = {};
  const parts = inner.split(/,(?![^\\[]*\\])/);
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
  const normalized = rawText.replace(/\\r\\n/g, '\\n');
  const lines = normalized.split('\\n');
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
      if (/^proxies:\\s*$/.test(trimmed)) {
        inProxies = true;
      }
      continue;
    }

    const indent = cleanLine.search(/\\S/);
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
    if (data.up_mbps) proxy.up = \`\${data.up_mbps} Mbps\`;
    else if (data.up) proxy.up = String(data.up).trim();
    if (data.down_mbps) proxy.down = \`\${data.down_mbps} Mbps\`;
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
    const host = url.hostname.replace(/^\\[|\\]$/g, '');
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
      if (upmbps) proxy.up = \`\${upmbps} Mbps\`;
      if (downmbps) proxy.down = \`\${downmbps} Mbps\`;
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
  if (/^proxies:\\s*$/m.test(trimmed.replace(/\\r\\n/g, '\\n'))) {
    return parseClashYamlProxies(trimmed);
  }

  let text = trimmed;
  if (!/^(hy2|hysteria2|hysteria):\\/\\//m.test(text) && /^[A-Za-z0-9+/=\\r\\n]+$/.test(text)) {
    try {
      const decoded = Buffer.from(text.replace(/\\s+/g, ''), 'base64').toString('utf8');
      if (/^(hy2|hysteria2|hysteria):\\/\\//m.test(decoded)) {
        text = decoded;
      }
    } catch {
      // ignore non-base64
    }
  }

  return text
    .replace(/\\r\\n/g, '\\n')
    .split('\\n')
    .map((l) => l.trim())
    .filter((l) => /^(hy2|hysteria2|hysteria):\\/\\//.test(l))
    .map(parseUriLine)
    .filter(Boolean);
}

function getProxySecret(p) {
  const user = p.username ? \`\${p.username}:\` : '';
  return user + String(p.password ?? p['auth-str'] ?? p.auth_str ?? p.uuid ?? '').trim();
}

function inferRegionLabel(proxy) {
  const host = String(proxy.server || '');
  const rawName = String(proxy.name || '');
  if (/港|HK|Hong/i.test(rawName)) return '🇭🇰 香港';
  if (/台|TW|TaiWan/i.test(rawName)) return '🇹🇼 台湾';
  if (/日|JP|Japan/i.test(rawName)) return '🇯🇵 日本';
  if (/新|SG|Singapore/i.test(rawName)) return '🇸🇬 狮城';
  if (/美|US|United\\s?States/i.test(rawName)) return '🇺🇸 美国';
  if (/韩|KR|Korea/i.test(rawName)) return '🇰🇷 韩国';
  if (/^(62\\.210\\.|2001:bc8:)/i.test(host)) return '🇫🇷 法国';
  return '🌐 自动节点';
}

function shortHostTag(host) {
  if (host.includes(':')) {
    const parts = host.split(':');
    const tail = parts[parts.length - 1] || parts[parts.length - 2] || host;
    return \`::\${tail}\`;
  }
  return host;
}

function extractMbpsNumber(rawVal) {
  const m = String(rawVal || '').match(/(\\d+)/);
  return m ? m[1] : '';
}

function toShareUri(proxy) {
  const host = String(proxy.server);
  const hostUri = host.includes(':') ? \`[\${host}]\` : host;
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
    return \`hy2://\${auth}@\${hostUri}:\${port}?\${params.toString()}#\${nameTag}\`;
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
    return \`hysteria://\${hostUri}:\${port}?\${params.toString()}#\${nameTag}\`;
  }

  return null;
}

function yamlScalar(val) {
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  const s = String(val);
  return \`"\${s.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"')}"\`;
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
      lines.push(\`\${prefix}\${key}: [\${val.map(yamlScalar).join(', ')}]\`);
    } else {
      lines.push(\`\${prefix}\${key}: \${yamlScalar(val)}\`);
    }
  });
  return lines.join('\\n');
}

function buildClashYamlSubscription(proxies, sourceOkCount, sourceTotal) {
  const names = proxies.map((p) => p.name);
  const yamlNamesList = names.map((n) => \`      - \${yamlScalar(n)}\`).join('\\n');

  return [
    '# ============================================================================',
    '# Clash Mi 每日自动提取节点订阅 (clash-mi-nodes.yaml)',
    \`# 更新时间 (UTC): \${new Date().toISOString()}\`,
    \`# 提取结果: \${proxies.length} 个去重节点 (来自 \${sourceOkCount}/\${sourceTotal} 个可用源)\`,
    '# 说明: 可直接作为独立订阅导入 Clash Mi，也可叠加本仓库 override/clash-mi-override.js 覆写使用',
    '# ============================================================================',
    'mixed-port: 7890',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'ipv6: true',
    '',
    'proxies:',
    proxies.map(serializeProxyYaml).join('\\n'),
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
  ].join('\\n');
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
      const key = \`\${node.type}|\${String(node.server).toLowerCase()}|\${portKey}|\${getProxySecret(node)}\`;
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
      name: \`\${region} \${ipVer} \${protoTag}-\${seq} (\${shortHostTag(String(node.server))})\`,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceOkCount = results.filter((r) => r.ok && r.nodes.length > 0).length;

  const yamlContent = buildClashYamlSubscription(renamedNodes, sourceOkCount, urls.length);
  fs.writeFileSync(YAML_SUB_PATH, yamlContent, 'utf8');

  const rawUris = renamedNodes.map(toShareUri).filter(Boolean);
  const rawContent = rawUris.join('\\n') + (rawUris.length > 0 ? '\\n' : '');
  fs.writeFileSync(RAW_SUB_PATH, rawContent, 'utf8');
  fs.writeFileSync(
    BASE64_SUB_PATH,
    Buffer.from(rawContent, 'utf8').toString('base64') + '\\n',
    'utf8'
  );

  const tableRows = renamedNodes
    .map((n) => {
      const ipVer = String(n.server).includes(':') ? 'IPv6' : 'IPv4';
      const endpoint = n['port-range'] ? \`\${n.server}:\${n['port-range']}\` : \`\${n.server}:\${n.port}\`;
      return \`| \${n.name} | \${n.type} | \${ipVer} | \\\`\${endpoint}\\\` |\`;
    })
    .join('\\n');

  const failedSources = results.filter((r) => !r.ok || r.nodes.length === 0);
  const report = [
    '### 每日节点提取与订阅生成报告',
    '',
    \`- **更新时间 (UTC)**: \${new Date().toISOString()}\`,
    \`- **源抓取统计**: \${sourceOkCount} / \${urls.length} 个 URL 有效\`,
    \`- **去重节点总数**: \${renamedNodes.length} 个\`,
    \`- **输出文件**: \\\`subscriptions/clash-mi-nodes.yaml\\\` / \\\`subscriptions/nodes-base64.txt\\\` / \\\`subscriptions/nodes-raw.txt\\\`\`,
    '',
    '| 节点名称 | 协议 | IP 栈 | 服务器地址 |',
    '| :--- | :--- | :--- | :--- |',
    tableRows,
    failedSources.length > 0
      ? \`\\n#### 未提取到节点的源 (\${failedSources.length})\\n\` +
        failedSources.map((f) => \`- \${f.url}: \${f.error || '0 nodes'}\`).join('\\n')
      : '',
  ]
    .filter(Boolean)
    .join('\\n');

  fs.writeFileSync(REPORT_PATH, report + '\\n', 'utf8');
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
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
    }
  );

  if (state.nodeSubscription?.enabled !== false) {
    files.push(
      {
        path: 'rules/node-sources.txt',
        language: 'text',
        title: '上游节点提取源 URL 列表',
        description: '配置每天自动抓取的 config.yaml / config.json / 订阅源地址',
        content: generateNodeSourcesTxt(state),
      },
      {
        path: '.github/workflows/fetch-nodes-sub.yml',
        language: 'yaml',
        title: 'GitHub Actions 每日节点提取订阅工作流',
        description: `按 Cron (${state.nodeSubscription?.cronExpression || '0 22 * * *'}) 自动提取节点并生成 subscriptions/ 订阅`,
        content: generateNodeFetchWorkflowYaml(state),
      },
      {
        path: 'scripts/fetch-nodes.mjs',
        language: 'javascript',
        title: '零依赖节点提取与订阅生成脚本',
        description: '抓取 YAML/JSON 节点源，去重并生成 clash-mi-nodes.yaml 与 Base64 订阅',
        content: generateFetchNodesScript(),
      }
    );
  }

  files.push(
    {
      path: 'package.json',
      language: 'json',
      title: 'Node.js 脚本依赖清单',
      description: '为 GitHub Actions 提供脚本入口说明',
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
      title: 'Clash Mi 覆写与订阅导入说明',
      description: '包含 YAML / JS 覆写、节点订阅 Raw 链接与 Clash Mi 导入步骤',
      content: generateReadmeMd(state),
    }
  );

  return files;
}
