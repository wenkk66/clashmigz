import { AdBlockLevel, ClashWorkspaceState } from '../types/clash';

export const DEFAULT_GLOBAL_EXCLUDE =
  '剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国';

export const AD_BLOCK_LEVEL_PRESETS: Record<
  Exclude<AdBlockLevel, 'custom'>,
  {
    title: string;
    deviceHint: string;
    summary: string;
    enabledRuleIds: string[];
  }
> = {
  light: {
    title: '轻量省内存',
    deviceHint: '老旧安卓机 / 低内存路由器 (≤2GB RAM)',
    summary: '仅启用 3 个二进制 .mrs 规则（HTTPDNS + 秋风广告 + MetaCubeX），极低内存占用。',
    enabledRuleIds: ['rule-httpdns', 'rule-awavenue', 'rule-ads'],
  },
  balanced: {
    title: '均衡强效',
    deviceHint: '主流安卓手机 / 日常平板（默认推荐）',
    summary: '启用 7 大拦截源：叠加 217heidai AdGuard+EasyList 10万+ .mrs、Cats-Team 开屏/PCDN、AdGuard SDNS 与 Privacy 隐私追踪过滤。',
    enabledRuleIds: [
      'rule-httpdns',
      'rule-awavenue',
      'rule-ads',
      'rule-adblock-ultra',
      'rule-cats-adrules',
      'rule-adguard-base',
      'rule-privacy',
    ],
  },
  ultra: {
    title: '极客满血',
    deviceHint: '旗舰手机 / 电脑 / 软路由（11 引擎全开）',
    summary: '在均衡强效基础上再叠加 HaGeZi Multi PRO++ (25万+)、移动端广告行为库、反劫持/防监控上报与 anti-AD，实现最高级别全网广告与隐私拦截。',
    enabledRuleIds: [
      'rule-httpdns',
      'rule-awavenue',
      'rule-ads',
      'rule-adblock-ultra',
      'rule-cats-adrules',
      'rule-adguard-base',
      'rule-privacy',
      'rule-hagezi-pro-plus',
      'rule-mobile-ad-enhance',
      'rule-hijacking',
      'rule-antiad',
    ],
  },
};

export function inferAdBlockLevel(
  ruleModules: ClashWorkspaceState['ruleModules']
): AdBlockLevel {
  const activeRejectIds = ruleModules
    .filter((r) => r.category === 'reject' && r.enabled)
    .map((r) => r.id)
    .sort()
    .join(',');

  for (const level of ['light', 'balanced', 'ultra'] as const) {
    const targetIds = [...AD_BLOCK_LEVEL_PRESETS[level].enabledRuleIds].sort().join(',');
    if (activeRejectIds === targetIds) {
      return level;
    }
  }
  return 'custom';
}

export const INITIAL_WORKSPACE_STATE: ClashWorkspaceState = {
  overwrite: {
    outputTarget: 'both',
    skipEmptyRegionGroups: true,
    stripExcludedProxies: true,
    overwriteDns: true,
    dnsAdSinkhole: true,
    overwriteSniffer: true,
  },
  groups: [
    {
      id: 'grp-auto',
      name: '♻️ 自动测速优选',
      type: 'url-test',
      filter: '',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
      isSystem: true,
    },
    {
      id: 'grp-select',
      name: '🚀 节点选择',
      type: 'select',
      filter: '',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [
        '♻️ 自动测速优选',
        '🚨 故障转移',
        '⚖️ 负载均衡',
        '🎯 手动节点列表',
        '🇭🇰 香港节点',
        '🇹🇼 台湾节点',
        '🇯🇵 日本节点',
        '🇸🇬 狮城节点',
        '🇺🇸 美国节点',
        '🇰🇷 韩国节点',
        '🇪🇺 欧洲节点',
        'DIRECT',
      ],
      enabled: true,
      isSystem: true,
    },
    {
      id: 'grp-failover',
      name: '🚨 故障转移',
      type: 'fallback',
      filter: '',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 180,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-balance',
      name: '⚖️ 负载均衡',
      type: 'load-balance',
      filter: '',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-manual',
      name: '🎯 手动节点列表',
      type: 'select',
      filter: '',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-youtube',
      name: '📺 YouTube 专属',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: [
        '♻️ 自动测速优选',
        '🇭🇰 香港节点',
        '🇹🇼 台湾节点',
        '🇸🇬 狮城节点',
        '🇯🇵 日本节点',
        '🇺🇸 美国节点',
        '🎯 手动节点列表',
        '🚀 节点选择',
      ],
      enabled: true,
    },
    {
      id: 'grp-ai',
      name: '🤖 AI 服务专属',
      type: 'select',
      filter: '美|新|日|台|US|SG|JP|TW|🇺🇸|🇸🇬|🇯🇵|🇹🇼',
      excludeFilter: `${DEFAULT_GLOBAL_EXCLUDE}|港|HK|Hong|🇭🇰|俄|RU|CN`,
      url: 'https://chat.openai.com',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: ['🇸🇬 狮城节点', '🇺🇸 美国节点', '🇯🇵 日本节点', '🇹🇼 台湾节点', '🎯 手动节点列表'],
      enabled: true,
    },
    {
      id: 'grp-tiktok',
      name: '🎵 TikTok 专属',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: ['🇸🇬 狮城节点', '🇯🇵 日本节点', '🇺🇸 美国节点', '🇹🇼 台湾节点', '🚀 节点选择'],
      enabled: true,
    },
    {
      id: 'grp-streaming',
      name: '🎬 流媒体解锁',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: [
        '♻️ 自动测速优选',
        '🚀 节点选择',
        '🚨 故障转移',
        '🇭🇰 香港节点',
        '🇹🇼 台湾节点',
        '🇸🇬 狮城节点',
        '🇯🇵 日本节点',
        '🇺🇸 美国节点',
      ],
      enabled: true,
    },
    {
      id: 'grp-social',
      name: '📲 电报与社交',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: [
        '♻️ 自动测速优选',
        '🚀 节点选择',
        '🚨 故障转移',
        '🇸🇬 狮城节点',
        '🇭🇰 香港节点',
        '🇯🇵 日本节点',
        '🇺🇸 美国节点',
      ],
      enabled: true,
    },
    {
      id: 'grp-games',
      name: '🎮 游戏与平台',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: ['DIRECT', '♻️ 自动测速优选', '🚀 节点选择', '🇭🇰 香港节点', '🇯🇵 日本节点', '🇺🇸 美国节点'],
      enabled: true,
    },
    {
      id: 'grp-ads',
      name: '🛡️ 广告拦截',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: ['REJECT', 'REJECT-DROP', 'DIRECT'],
      enabled: true,
    },
    {
      id: 'grp-hk',
      name: '🇭🇰 香港节点',
      type: 'url-test',
      filter: '港|HK|Hong\\s?Kong|🇭🇰',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-tw',
      name: '🇹🇼 台湾节点',
      type: 'url-test',
      filter: '台|TW|TaiWan|新北|彰化|🇹🇼',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-jp',
      name: '🇯🇵 日本节点',
      type: 'url-test',
      filter: '日|JP|Japan|东京|大阪|🇯🇵',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-sg',
      name: '🇸🇬 狮城节点',
      type: 'url-test',
      filter: '新|SG|Singapore|狮城|🇸🇬',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-us',
      name: '🇺🇸 美国节点',
      type: 'url-test',
      filter: '美|US|United\\s?States|洛杉矶|硅谷|圣何塞|🇺🇸',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-kr',
      name: '🇰🇷 韩国节点',
      type: 'url-test',
      filter: '韩|KR|Korea|首尔|春川|🇰🇷',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-eu',
      name: '🇪🇺 欧洲节点',
      type: 'url-test',
      filter: '英|德|法|荷|瑞|意|UK|DE|FR|NL|CH|GB|伦敦|法兰克福|阿姆斯特丹|🇬🇧|🇩🇪|🇫🇷',
      excludeFilter: DEFAULT_GLOBAL_EXCLUDE,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 80,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    },
    {
      id: 'grp-fallback',
      name: '🐟 漏网之鱼',
      type: 'select',
      filter: '',
      excludeFilter: '',
      url: '',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: false,
      proxies: ['♻️ 自动测速优选', '🚀 节点选择', '🚨 故障转移', 'DIRECT'],
      enabled: true,
      isSystem: true,
    },
  ],
  ruleModules: [
    {
      id: 'rule-private',
      label: '局域网与私有地址直连',
      category: 'direct',
      providerName: 'private',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/private.txt',
      targetGroup: 'DIRECT',
      interval: 86400,
      enabled: true,
      sampleDomains: ['localhost', 'router.asus.com', 'nas.local'],
    },
    {
      id: 'rule-httpdns',
      label: 'HTTPDNS 劫持屏蔽（防国内 App 绕过广告过滤）',
      category: 'reject',
      tier: 'light',
      providerName: 'category-httpdns-cn',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-httpdns-cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-httpdns-cn.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['httpdns.alicdn.com', 'httpdns.n.netease.com', 'dns.weixin.qq.com'],
    },
    {
      id: 'rule-awavenue',
      label: '秋风广告规则（AWAvenue Ads 移动端原生 .mrs）',
      category: 'reject',
      tier: 'light',
      providerName: 'awavenue-ads',
      behavior: 'classical',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash-Classical.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['ad.doubleclick.net', 'ads.youtube.com', 'pangolin.snssdk.com'],
    },
    {
      id: 'rule-ads',
      label: 'MetaCubeX 全网广告与遥测聚合（EasyList 底座）',
      category: 'reject',
      tier: 'light',
      providerName: 'category-ads-all',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/reject.txt',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['doubleclick.net', 'googlesyndication.com', 'umeng.com'],
    },
    {
      id: 'rule-adblock-ultra',
      label: 'AdGuard + EasyList 10万+聚合库（217heidai 二进制 .mrs）',
      category: 'reject',
      tier: 'balanced',
      providerName: 'adblock-ultra',
      behavior: 'domain',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/217heidai/adblockfilters/main/rules/adblockmihomo.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/217heidai/adblockfilters/main/rules/adblockmihomo.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['pagead2.googlesyndication.com', 'tpc.googlesyndication.com'],
    },
    {
      id: 'rule-cats-adrules',
      label: 'Cats-Team AdRules（国内 App 开屏广告 / PCDN / 隐私追踪）',
      category: 'reject',
      tier: 'balanced',
      providerName: 'cats-adrules',
      behavior: 'domain',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/adrules_domainset.txt',
      yamlUrl: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/adrules_domainset.txt',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['pgdt.gtimg.cn', 'pglstatp-toutiao.com', 'adsmind.gdtimg.com'],
    },
    {
      id: 'rule-adguard-base',
      label: 'AdGuard 基础拦截规则（AdGuard SDNS Filter）',
      category: 'reject',
      tier: 'balanced',
      providerName: 'adguard-base',
      behavior: 'domain',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AdGuardSDNSFilter/AdGuardSDNSFilter_Domain.yaml',
      yamlUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AdGuardSDNSFilter/AdGuardSDNSFilter_Domain.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['adservice.google.com', 'analytics.google.com', 's0.2mdn.net'],
    },
    {
      id: 'rule-privacy',
      label: 'Privacy 隐私追踪与行为上报过滤 (blackmatrix7)',
      category: 'reject',
      tier: 'balanced',
      providerName: 'privacy-domain',
      behavior: 'classical',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Privacy/Privacy_Domain.yaml',
      yamlUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Privacy/Privacy.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: true,
      sampleDomains: ['analytics.tiktok.com', 'metrics.icloud.com', 'app-measurement.com', 'tracking.miui.com'],
    },
    {
      id: 'rule-hagezi-pro-plus',
      label: 'HaGeZi Multi PRO++ 国际广告与追踪全集 (25万+ .mrs)',
      category: 'reject',
      tier: 'ultra',
      providerName: 'hagezi-pro-plus',
      behavior: 'domain',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MiHomoer/MiHomo-Hagezi/release/HageziProPlus.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MiHomoer/MiHomo-Hagezi/release/HageziProPlus.txt',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: false,
      sampleDomains: ['imasdk.googleapis.com', 'pagead2.googlesyndication.com', 'metrics.icloud.com'],
    },
    {
      id: 'rule-mobile-ad-enhance',
      label: '移动端 App 广告行为增强（blackmatrix7 Advertising）',
      category: 'reject',
      tier: 'ultra',
      providerName: 'mobile-ad-enhance',
      behavior: 'classical',
      mrsBehavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Advertising/Advertising_Domain.yaml',
      yamlUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Advertising/Advertising.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: false,
      sampleDomains: ['adx.gdt.qq.com', 'mobads.baidu.com', 'ads-api.tiktok.com'],
    },
    {
      id: 'rule-hijacking',
      label: '反劫持与防运营商/系统监控上报 (blackmatrix7 Hijacking)',
      category: 'reject',
      tier: 'ultra',
      providerName: 'hijacking',
      behavior: 'classical',
      mrsBehavior: 'classical',
      mrsUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Hijacking/Hijacking.yaml',
      yamlUrl: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Hijacking/Hijacking.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: false,
      sampleDomains: ['adashbc.ut.taobao.com', 'adashx.m.taobao.com', 'log.tbs.qq.com'],
    },
    {
      id: 'rule-antiad',
      label: 'anti-AD 深度广告与隐私追踪库（极客满血）',
      category: 'reject',
      tier: 'ultra',
      providerName: 'anti-ad',
      behavior: 'domain',
      mrsUrl: 'https://anti-ad.net/clash.yaml',
      yamlUrl: 'https://anti-ad.net/clash.yaml',
      targetGroup: '🛡️ 广告拦截',
      interval: 86400,
      enabled: false,
      sampleDomains: ['googleads.g.doubleclick.net', 'log.mmstat.com'],
    },
    {
      id: 'rule-ai-all',
      label: '海外 AI 服务全集 (OpenAI / Claude / Cursor / xAI)',
      category: 'ai',
      providerName: 'ai-non-cn',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.yaml',
      targetGroup: '🤖 AI 服务专属',
      interval: 86400,
      enabled: true,
      sampleDomains: ['chatgpt.com', 'api.openai.com', 'claude.ai', 'api.anthropic.com', 'x.ai', 'grok.com', 'perplexity.ai'],
    },
    {
      id: 'rule-gemini',
      label: 'Google Gemini / AI Studio',
      category: 'ai',
      providerName: 'google-gemini',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google-gemini.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google-gemini.yaml',
      targetGroup: '🤖 AI 服务专属',
      interval: 86400,
      enabled: true,
      sampleDomains: ['gemini.google.com', 'aistudio.google.com', 'generativelanguage.googleapis.com'],
    },
    {
      id: 'rule-tiktok',
      label: 'TikTok 国际版',
      category: 'streaming',
      providerName: 'tiktok',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.yaml',
      targetGroup: '🎵 TikTok 专属',
      interval: 86400,
      enabled: true,
      sampleDomains: ['tiktok.com', 'tiktokv.com', 'byteoversea.com'],
    },
    {
      id: 'rule-youtube',
      label: 'YouTube 流媒体 (自动禁用 QUIC UDP 443)',
      category: 'streaming',
      providerName: 'youtube',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.yaml',
      targetGroup: '📺 YouTube 专属',
      interval: 86400,
      enabled: true,
      sampleDomains: ['youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com'],
    },
    {
      id: 'rule-netflix',
      label: 'Netflix 奈飞',
      category: 'streaming',
      providerName: 'netflix',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.yaml',
      targetGroup: '🎬 流媒体解锁',
      interval: 86400,
      enabled: true,
      sampleDomains: ['netflix.com', 'nflxvideo.net', 'fast.com'],
    },
    {
      id: 'rule-disney',
      label: 'Disney+ 迪士尼流媒体',
      category: 'streaming',
      providerName: 'disney',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.yaml',
      targetGroup: '🎬 流媒体解锁',
      interval: 86400,
      enabled: true,
      sampleDomains: ['disneyplus.com', 'dssott.com', 'bamgrid.com'],
    },
    {
      id: 'rule-spotify',
      label: 'Spotify 音乐流媒体',
      category: 'streaming',
      providerName: 'spotify',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.yaml',
      targetGroup: '🎬 流媒体解锁',
      interval: 86400,
      enabled: true,
      sampleDomains: ['spotify.com', 'scdn.co'],
    },
    {
      id: 'rule-telegram',
      label: 'Telegram 即时通讯 (IP + 域名)',
      category: 'social',
      providerName: 'telegram',
      behavior: 'ipcidr',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/telegramcidr.txt',
      targetGroup: '📲 电报与社交',
      interval: 86400,
      enabled: true,
      noResolve: true,
      sampleDomains: ['t.me', 'telegram.org', 'web.telegram.org', '149.154.167.50'],
    },
    {
      id: 'rule-github',
      label: 'GitHub & 开发生态',
      category: 'dev',
      providerName: 'github',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.yaml',
      targetGroup: '🚀 节点选择',
      interval: 86400,
      enabled: true,
      sampleDomains: ['github.com', 'raw.githubusercontent.com', 'ghcr.io', 'gist.github.com'],
    },
    {
      id: 'rule-google',
      label: 'Google 搜索与服务',
      category: 'dev',
      providerName: 'google',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.yaml',
      targetGroup: '🚀 节点选择',
      interval: 86400,
      enabled: true,
      sampleDomains: ['google.com', 'gmail.com', 'googleapis.com', 'gstatic.com'],
    },
    {
      id: 'rule-steam',
      label: 'Steam 游戏平台',
      category: 'service',
      providerName: 'steam',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.yaml',
      targetGroup: '🎮 游戏与平台',
      interval: 86400,
      enabled: true,
      sampleDomains: ['steampowered.com', 'steamcommunity.com', 'steamstatic.com'],
    },
    {
      id: 'rule-apple',
      label: 'Apple 国内服务直连优化',
      category: 'service',
      providerName: 'apple-cn',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/apple.txt',
      targetGroup: 'DIRECT',
      interval: 86400,
      enabled: true,
      sampleDomains: ['icloud.com', 'mzstatic.com', 'itunes.apple.com'],
    },
    {
      id: 'rule-microsoft',
      label: 'Microsoft 国内服务直连优化',
      category: 'service',
      providerName: 'microsoft-cn',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft@cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft@cn.yaml',
      targetGroup: 'DIRECT',
      interval: 86400,
      enabled: true,
      sampleDomains: ['live.com', 'microsoft.com', 'windowsupdate.com', 'office.com'],
    },
    {
      id: 'rule-cn-domain',
      label: '国内域名直连 (CN Geosite)',
      category: 'direct',
      providerName: 'cn-domain',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/direct.txt',
      targetGroup: 'DIRECT',
      interval: 86400,
      enabled: true,
      sampleDomains: ['bilibili.com', 'taobao.com', 'qq.com', 'zhihu.com', 'baidu.com'],
    },
    {
      id: 'rule-non-cn',
      label: '其余海外域名代理 (Geolocation !CN)',
      category: 'dev',
      providerName: 'geolocation-non-cn',
      behavior: 'domain',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/proxy.txt',
      targetGroup: '🚀 节点选择',
      interval: 86400,
      enabled: true,
      sampleDomains: ['wikipedia.org', 'stackoverflow.com', 'reddit.com', 'npmjs.com'],
    },
    {
      id: 'rule-cn-ip',
      label: '国内 IP 段直连 (CN GeoIP)',
      category: 'direct',
      providerName: 'cn-ip',
      behavior: 'ipcidr',
      mrsUrl: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs',
      yamlUrl: 'https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/cncidr.txt',
      targetGroup: 'DIRECT',
      interval: 86400,
      enabled: true,
      noResolve: true,
      sampleDomains: ['223.5.5.5', '114.114.114.114'],
    },
  ],
  kernel: {
    ipv6: false,
    dnsMode: 'fake-ip',
    dohChina: 'https://dns.alidns.com/dns-query, https://doh.pub/dns-query',
    dohGlobal: 'https://dns.google/dns-query, https://1.1.1.1/dns-query, tls://8.8.8.8:853',
    ruleSourceFlavor: 'metacubex-mrs',
    adBlockLevel: 'balanced',
    globalExcludeFilter: DEFAULT_GLOBAL_EXCLUDE,
  },
  github: {
    owner: 'your-github-username',
    repo: 'clash-mi-override',
    branch: 'main',
    visibility: 'public',
    cronExpression: '0 */12 * * *',
    cronPreset: '12h',
    commitMessage: 'chore(override): sync clash-mi diversion rules and templates',
    enableStepSummary: true,
  },
  customRules: {
    proxyList: `# 自定义强制走代理规则 (每行一条 Clash 规则)
DOMAIN-SUFFIX,cursor.sh
DOMAIN-SUFFIX,perplexity.ai
DOMAIN-KEYWORD,vercel`,
    directList: `# 自定义强制直连规则 (内网 / 私有服务 / 国内特殊域名)
DOMAIN-SUFFIX,pt.example.edu.cn
DOMAIN-SUFFIX,local
IP-CIDR,100.64.0.0/10,no-resolve`,
    rejectList: `# 自定义强力去广告、YouTube/Google IMA 广告 SDK、隐私遥测、国内 App 开屏与 HTTPDNS 封堵
# 1. YouTube / Google Ads / IMA SDK / TikTok 广告与遥测
DOMAIN-SUFFIX,doubleclick.net
DOMAIN-SUFFIX,doubleclick-cn.net
DOMAIN-SUFFIX,googleads.g.doubleclick.net
DOMAIN-SUFFIX,pubads.g.doubleclick.net
DOMAIN-SUFFIX,securepubads.g.doubleclick.net
DOMAIN-SUFFIX,adclick.g.doubleclick.net
DOMAIN-SUFFIX,cm.g.doubleclick.net
DOMAIN-SUFFIX,stats.g.doubleclick.net
DOMAIN-SUFFIX,googlesyndication.com
DOMAIN-SUFFIX,pagead2.googlesyndication.com
DOMAIN-SUFFIX,tpc.googlesyndication.com
DOMAIN-SUFFIX,ade.googlesyndication.com
DOMAIN-SUFFIX,googleadservices.com
DOMAIN-SUFFIX,adservice.google.com
DOMAIN-SUFFIX,partnerad.l.google.com
DOMAIN-SUFFIX,google-analytics.com
DOMAIN-SUFFIX,ssl.google-analytics.com
DOMAIN-SUFFIX,fundingchoicesmessages.google.com
DOMAIN-SUFFIX,imasdk.googleapis.com
DOMAIN-SUFFIX,2mdn.net
DOMAIN-SUFFIX,admob.com
DOMAIN-SUFFIX,ads.youtube.com
DOMAIN-SUFFIX,app-measurement.com
DOMAIN-SUFFIX,crashlytics.com
DOMAIN-SUFFIX,firebaseinappmessaging.googleapis.com
DOMAIN-SUFFIX,ads.tiktok.com
DOMAIN-SUFFIX,ads-sg.tiktok.com
DOMAIN-SUFFIX,analytics.tiktok.com
DOMAIN-KEYWORD,googleads
DOMAIN-KEYWORD,doubleclick
DOMAIN-KEYWORD,pagead
# 2. 国内 App 开屏广告联盟与埋点遥测 (穿山甲 / 广点通 / 百度 / 快手 / 小米 / OPPO / vivo / 友盟)
DOMAIN-SUFFIX,pangolin-sdk-toutiao.com
DOMAIN-SUFFIX,pangolin-sdk-toutiao-b.com
DOMAIN-SUFFIX,pangolin.snssdk.com
DOMAIN-SUFFIX,pglstatp-toutiao.com
DOMAIN-SUFFIX,toblog.ctobsnssdk.com
DOMAIN-SUFFIX,gdt.qq.com
DOMAIN-SUFFIX,adsmind.gdtimg.com
DOMAIN-SUFFIX,pgdt.gtimg.cn
DOMAIN-SUFFIX,tangram.e.qq.com
DOMAIN-SUFFIX,sdk.e.qq.com
DOMAIN-SUFFIX,ad.qq.com
DOMAIN-SUFFIX,btrace.qq.com
DOMAIN-SUFFIX,tpns.qq.com
DOMAIN-SUFFIX,tmead.y.qq.com
DOMAIN-SUFFIX,mobads.baidu.com
DOMAIN-SUFFIX,mobads-logs.baidu.com
DOMAIN-SUFFIX,pos.baidu.com
DOMAIN-SUFFIX,als.baidu.com
DOMAIN-SUFFIX,e.kuaishou.com
DOMAIN-SUFFIX,open.e.kuaishou.com
DOMAIN-SUFFIX,gdfp.gifshow.com
DOMAIN-SUFFIX,umeng.com
DOMAIN-SUFFIX,umengcloud.com
DOMAIN-SUFFIX,alog.umeng.com
DOMAIN-SUFFIX,ad.xiaomi.com
DOMAIN-SUFFIX,sdkconfig.ad.xiaomi.com
DOMAIN-SUFFIX,data.mistat.xiaomi.com
DOMAIN-SUFFIX,tracking.miui.com
DOMAIN-SUFFIX,ads.heytapmobi.com
DOMAIN-SUFFIX,adx.ads.oppomobi.com
DOMAIN-SUFFIX,stsdk.vivo.com.cn
DOMAIN-SUFFIX,adreq.vivo.com.cn
DOMAIN-SUFFIX,log-upload-os.hoyoverse.com
DOMAIN-KEYWORD,adservice
DOMAIN-KEYWORD,pangolin-sdk-toutiao
# 3. 封堵国内 App HTTPDNS 直连 IP (防止绕过域名去广告)
IP-CIDR,203.107.1.0/24,no-resolve
IP-CIDR,119.29.29.98/32,no-resolve
IP-CIDR,119.29.29.99/32,no-resolve
IP-CIDR,180.76.76.200/32,no-resolve
IP-CIDR,101.226.103.106/32,no-resolve
IP-CIDR,101.226.212.27/32,no-resolve
IP-CIDR,117.185.228.108/32,no-resolve`,
  },
};

export const SAMPLE_NODE_LIST = `剩余流量：842.19 GB
距离下次重置剩余：16 天
官网地址：https://example.com
🇭🇰 香港 IEPL 专线 01 [1x]
🇭🇰 香港 IEPL 专线 02 [10Gbps]
🇭🇰 香港原生流媒体 03 [2x]
🇭🇰 香港大带宽下载 04 [5x 倍率]
🇹🇼 台湾台北家宽 01
🇹🇼 台湾彰化 HiNet 02
🇯🇵 日本东京 BGP 01
🇯🇵 日本大阪软银 02
🇯🇵 日本冷门实验节点 [10x]
🇸🇬 新加坡 GIA 优化 01
🇸🇬 新加坡 AWS 02
🇺🇸 美国洛杉矶 CN2 GIA 01
🇺🇸 美国硅谷高防 02
🇺🇸 美国圣何塞住宅 IP
🇰🇷 韩国首尔原生 01
🇬🇧 英国伦敦 GB 节点 01
🇩🇪 德国法兰克福 01
⚠️ 如无法连接请更新订阅`;
