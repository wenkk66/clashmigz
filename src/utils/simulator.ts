import {
  ClashWorkspaceState,
  ProxyGroupConfig,
} from '../types/clash';

export interface NodeEvaluationItem {
  name: string;
  excluded: boolean;
  excludeReason: string | null;
  matchedGroups: string[];
}

export interface NodeSimulationResult {
  total: number;
  kept: number;
  excludedCount: number;
  unmatchedCount: number;
  items: NodeEvaluationItem[];
  groupCounts: Array<{ id: string; name: string; count: number; regexError: string | null }>;
  globalRegexError: string | null;
}

function safeCompileRegex(pattern: string): { regex: RegExp | null; error: string | null } {
  if (!pattern || !pattern.trim()) {
    return { regex: null, error: null };
  }
  try {
    return { regex: new RegExp(pattern.trim(), 'i'), error: null };
  } catch (err) {
    return {
      regex: null,
      error: err instanceof Error ? err.message : '无效正则表达式',
    };
  }
}

export function simulateNodeFilters(
  rawNodesText: string,
  globalExcludePattern: string,
  groups: ProxyGroupConfig[]
): NodeSimulationResult {
  const lines = rawNodesText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const globalCompiled = safeCompileRegex(globalExcludePattern);
  const filterGroups = groups.filter(
    (g) => g.enabled && (g.includeAllProxies || g.filter.trim().length > 0)
  );

  const compiledGroups = filterGroups.map((g) => ({
    group: g,
    include: safeCompileRegex(g.filter),
    exclude: safeCompileRegex(g.excludeFilter),
  }));

  const groupHitMap = new Map<string, number>();
  for (const g of filterGroups) {
    groupHitMap.set(g.id, 0);
  }

  const items: NodeEvaluationItem[] = [];
  let excludedCount = 0;
  let unmatchedCount = 0;

  for (const name of lines) {
    const globalMatch = globalCompiled.regex?.exec(name);
    if (globalMatch) {
      excludedCount++;
      items.push({
        name,
        excluded: true,
        excludeReason: `全局排除命中: "${globalMatch[0]}"`,
        matchedGroups: [],
      });
      continue;
    }

    const matchedGroups: string[] = [];
    for (const cg of compiledGroups) {
      if (cg.exclude.regex && cg.exclude.regex.test(name)) {
        continue;
      }
      if (cg.include.regex) {
        if (cg.include.regex.test(name)) {
          matchedGroups.push(cg.group.name);
          groupHitMap.set(cg.group.id, (groupHitMap.get(cg.group.id) || 0) + 1);
        }
      } else if (cg.group.includeAllProxies) {
        matchedGroups.push(cg.group.name);
        groupHitMap.set(cg.group.id, (groupHitMap.get(cg.group.id) || 0) + 1);
      }
    }

    // Check if only generic auto group matched vs specific region groups
    const specificMatches = matchedGroups.filter((n) => !n.includes('自动测速'));
    if (specificMatches.length === 0) {
      unmatchedCount++;
    }

    items.push({
      name,
      excluded: false,
      excludeReason: null,
      matchedGroups,
    });
  }

  return {
    total: lines.length,
    kept: lines.length - excludedCount,
    excludedCount,
    unmatchedCount,
    items,
    groupCounts: compiledGroups.map((cg) => ({
      id: cg.group.id,
      name: cg.group.name,
      count: groupHitMap.get(cg.group.id) || 0,
      regexError: cg.include.error || cg.exclude.error,
    })),
    globalRegexError: globalCompiled.error,
  };
}

export interface RuleTraceResult {
  query: string;
  matched: boolean;
  ruleLine: string;
  sourceLabel: string;
  targetGroup: string;
  dnsHint: string;
}

function matchCustomLines(
  query: string,
  rawList: string,
  target: string,
  sourceLabel: string
): RuleTraceResult | null {
  const lower = query.toLowerCase();
  const lines = rawList
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    const type = (parts[0] || '').toUpperCase();
    const val = (parts[1] || parts[0] || '').toLowerCase();

    if (type === 'DOMAIN' && lower === val) {
      return {
        query,
        matched: true,
        ruleLine: `${type},${parts[1]},${target}`,
        sourceLabel,
        targetGroup: target,
        dnsHint: target === 'DIRECT' ? '直连 DoH (AliDNS)' : '远程 DoH (Cloudflare)',
      };
    }
    if ((type === 'DOMAIN-SUFFIX' || parts.length === 1) && (lower === val || lower.endsWith('.' + val))) {
      return {
        query,
        matched: true,
        ruleLine: `DOMAIN-SUFFIX,${parts[1] || parts[0]},${target}`,
        sourceLabel,
        targetGroup: target,
        dnsHint: target === 'DIRECT' ? '直连 DoH (AliDNS)' : '远程 DoH (Cloudflare)',
      };
    }
    if (type === 'DOMAIN-KEYWORD' && lower.includes(val)) {
      return {
        query,
        matched: true,
        ruleLine: `DOMAIN-KEYWORD,${parts[1]},${target}`,
        sourceLabel,
        targetGroup: target,
        dnsHint: target === 'DIRECT' ? '直连 DoH (AliDNS)' : '远程 DoH (Cloudflare)',
      };
    }
    if (type === 'IP-CIDR' && isIpInSamplePrivateRange(query, val)) {
      return {
        query,
        matched: true,
        ruleLine: `IP-CIDR,${parts[1]},${target},no-resolve`,
        sourceLabel,
        targetGroup: target,
        dnsHint: '无需 DNS 解析 (no-resolve)',
      };
    }
  }
  return null;
}

function isIpInSamplePrivateRange(ip: string, cidr: string): boolean {
  const ipMatch = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  const cidrMatch = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(cidr);
  if (!ipMatch || !cidrMatch) return false;

  const toNum = (m: RegExpExecArray) =>
    ((Number(m[1]) << 24) | (Number(m[2]) << 16) | (Number(m[3]) << 8) | Number(m[4])) >>> 0;
  const maskBits = Number(cidrMatch[5]);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (toNum(ipMatch) & mask) === (toNum(cidrMatch) & mask);
}

export function traceRuleMatch(rawQuery: string, state: ClashWorkspaceState): RuleTraceResult {
  const query = rawQuery.trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  const primaryGroup =
    state.groups.find((g) => g.id === 'grp-select' && g.enabled)?.name ||
    state.groups.find((g) => g.enabled)?.name ||
    'DIRECT';
  const adsGroup =
    state.groups.find((g) => g.id === 'grp-ads' && g.enabled)?.name || 'REJECT';
  const fallbackGroup =
    state.groups.find((g) => g.id === 'grp-fallback' && g.enabled)?.name || primaryGroup;

  if (!query) {
    return {
      query: '',
      matched: false,
      ruleLine: '等待输入域名或 IP',
      sourceLabel: '-',
      targetGroup: '-',
      dnsHint: '-',
    };
  }

  // 1. Custom Reject -> Direct -> Proxy
  const rejectHit = matchCustomLines(query, state.customRules.rejectList, adsGroup, 'rules/custom-reject.list');
  if (rejectHit) return rejectHit;

  const directHit = matchCustomLines(query, state.customRules.directList, 'DIRECT', 'rules/custom-direct.list');
  if (directHit) return directHit;

  const proxyHit = matchCustomLines(query, state.customRules.proxyList, primaryGroup, 'rules/custom-proxy.list');
  if (proxyHit) return proxyHit;

  // 2. Private LAN IP
  if (
    isIpInSamplePrivateRange(query, '192.168.0.0/16') ||
    isIpInSamplePrivateRange(query, '10.0.0.0/8') ||
    isIpInSamplePrivateRange(query, '172.16.0.0/12') ||
    query.endsWith('.local') ||
    query.endsWith('.lan')
  ) {
    return {
      query,
      matched: true,
      ruleLine: 'GEOIP,LAN,DIRECT,no-resolve',
      sourceLabel: '内置 LAN 规则',
      targetGroup: 'DIRECT',
      dnsHint: '本地网络直连',
    };
  }

  // 3. Enabled Rule Modules
  const lower = query.toLowerCase();
  for (const mod of state.ruleModules.filter((m) => m.enabled)) {
    const hit = mod.sampleDomains.some(
      (sample) => lower === sample || lower.endsWith('.' + sample)
    );
    if (hit || (mod.providerName === 'cn-domain' && lower.endsWith('.cn'))) {
      const target =
        mod.targetGroup === 'DIRECT' || mod.targetGroup === 'REJECT'
          ? mod.targetGroup
          : state.groups.some((g) => g.enabled && g.name === mod.targetGroup)
            ? mod.targetGroup
            : primaryGroup;
      return {
        query,
        matched: true,
        ruleLine: `RULE-SET,${mod.providerName},${target}${mod.noResolve ? ',no-resolve' : ''}`,
        sourceLabel: `${mod.label} (${state.kernel.ruleSourceFlavor === 'metacubex-mrs' ? '.mrs' : '.yaml'})`,
        targetGroup: target,
        dnsHint:
          target === 'DIRECT'
            ? `国内 DoH (${state.kernel.dohChina})`
            : `海外 DoH (${state.kernel.dohGlobal})`,
      };
    }
  }

  // 4. Fallback MATCH
  return {
    query,
    matched: false,
    ruleLine: `MATCH,${fallbackGroup}`,
    sourceLabel: '兜底规则 (MATCH)',
    targetGroup: fallbackGroup,
    dnsHint: `海外 DoH (${state.kernel.dohGlobal})`,
  };
}
