/**
 * Clash Mi 全局分流与节点过滤覆写脚本 (JS Overwrite)
 * 仓库: your-github-username/clash-mi-override (main)
 * 特性: 自动测速(url-test) · 故障转移(fallback) · 负载均衡 · HTTPDNS+全网去广告 · 空地区组自动跳过
 * 用法: 在 Clash Mi「覆写」页添加此脚本 Raw URL，任意机场订阅均可自动套用。
 */

const GLOBAL_EXCLUDE = "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国";
const STRIP_EXCLUDED_PROXIES = true;
const SKIP_EMPTY_REGION_GROUPS = true;
const OVERWRITE_DNS = true;
const OVERWRITE_SNIFFER = true;

const GROUP_SPECS = [
  {
    "id": "grp-select",
    "name": "🚀 节点选择",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "♻️ 自动测速优选",
      "🚨 故障转移",
      "⚖️ 负载均衡",
      "🇭🇰 香港节点",
      "🇹🇼 台湾节点",
      "🇯🇵 日本节点",
      "🇸🇬 狮城节点",
      "🇺🇸 美国节点",
      "🇰🇷 韩国节点",
      "🇪🇺 欧洲节点",
      "DIRECT"
    ]
  },
  {
    "id": "grp-auto",
    "name": "♻️ 自动测速优选",
    "type": "url-test",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-failover",
    "name": "🚨 故障转移",
    "type": "fallback",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 180,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-balance",
    "name": "⚖️ 负载均衡",
    "type": "load-balance",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-ads",
    "name": "🛡️ 广告拦截",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "REJECT",
      "REJECT-DROP",
      "DIRECT"
    ]
  },
  {
    "id": "grp-ai",
    "name": "🤖 AI 服务专属",
    "type": "select",
    "filter": "美|新|日|台|US|SG|JP|TW|🇺🇸|🇸🇬|🇯🇵|🇹🇼",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国|港|HK|Hong|🇭🇰|俄|RU|CN",
    "url": "https://chat.openai.com",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🇸🇬 狮城节点",
      "🇺🇸 美国节点",
      "🇯🇵 日本节点",
      "🇹🇼 台湾节点"
    ]
  },
  {
    "id": "grp-tiktok",
    "name": "🎵 TikTok 专属",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🇸🇬 狮城节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点",
      "🇹🇼 台湾节点",
      "🚀 节点选择"
    ]
  },
  {
    "id": "grp-streaming",
    "name": "🎬 流媒体解锁",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🚀 节点选择",
      "🚨 故障转移",
      "🇭🇰 香港节点",
      "🇹🇼 台湾节点",
      "🇸🇬 狮城节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点"
    ]
  },
  {
    "id": "grp-social",
    "name": "📲 电报与社交",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🚀 节点选择",
      "🚨 故障转移",
      "🇸🇬 狮城节点",
      "🇭🇰 香港节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点"
    ]
  },
  {
    "id": "grp-games",
    "name": "🎮 游戏与平台",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "DIRECT",
      "🚀 节点选择",
      "🇭🇰 香港节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点"
    ]
  },
  {
    "id": "grp-hk",
    "name": "🇭🇰 香港节点",
    "type": "url-test",
    "filter": "港|HK|Hong\\s?Kong|🇭🇰",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-tw",
    "name": "🇹🇼 台湾节点",
    "type": "url-test",
    "filter": "台|TW|TaiWan|新北|彰化|🇹🇼",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-jp",
    "name": "🇯🇵 日本节点",
    "type": "url-test",
    "filter": "日|JP|Japan|东京|大阪|🇯🇵",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-sg",
    "name": "🇸🇬 狮城节点",
    "type": "url-test",
    "filter": "新|SG|Singapore|狮城|🇸🇬",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-us",
    "name": "🇺🇸 美国节点",
    "type": "url-test",
    "filter": "美|US|United\\s?States|洛杉矶|硅谷|圣何塞|🇺🇸",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-kr",
    "name": "🇰🇷 韩国节点",
    "type": "url-test",
    "filter": "韩|KR|Korea|首尔|春川|🇰🇷",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-eu",
    "name": "🇪🇺 欧洲节点",
    "type": "url-test",
    "filter": "英|德|法|荷|瑞|意|UK|DE|FR|NL|CH|GB|伦敦|法兰克福|阿姆斯特丹|🇬🇧|🇩🇪|🇫🇷",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|重置|Traffic|Expire|GB|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 80,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-fallback",
    "name": "🐟 漏网之鱼",
    "type": "select",
    "filter": "",
    "excludeFilter": "",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🚀 节点选择",
      "♻️ 自动测速优选",
      "🚨 故障转移",
      "DIRECT"
    ]
  }
];

const RULE_PROVIDERS = {
  "private": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs",
    "path": "./rule_providers/private.mrs",
    "interval": 86400
  },
  "category-httpdns-cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-httpdns-cn.mrs",
    "path": "./rule_providers/category-httpdns-cn.mrs",
    "interval": 86400
  },
  "category-ads-all": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.mrs",
    "path": "./rule_providers/category-ads-all.mrs",
    "interval": 86400
  },
  "category-ai-!cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs",
    "path": "./rule_providers/category-ai-!cn.mrs",
    "interval": 86400
  },
  "google-gemini": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google-gemini.mrs",
    "path": "./rule_providers/google-gemini.mrs",
    "interval": 86400
  },
  "tiktok": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs",
    "path": "./rule_providers/tiktok.mrs",
    "interval": 86400
  },
  "youtube": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs",
    "path": "./rule_providers/youtube.mrs",
    "interval": 86400
  },
  "netflix": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs",
    "path": "./rule_providers/netflix.mrs",
    "interval": 86400
  },
  "disney": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.mrs",
    "path": "./rule_providers/disney.mrs",
    "interval": 86400
  },
  "spotify": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs",
    "path": "./rule_providers/spotify.mrs",
    "interval": 86400
  },
  "telegram": {
    "type": "http",
    "behavior": "ipcidr",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs",
    "path": "./rule_providers/telegram.mrs",
    "interval": 86400
  },
  "github": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs",
    "path": "./rule_providers/github.mrs",
    "interval": 86400
  },
  "google": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs",
    "path": "./rule_providers/google.mrs",
    "interval": 86400
  },
  "steam": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.mrs",
    "path": "./rule_providers/steam.mrs",
    "interval": 86400
  },
  "apple-cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs",
    "path": "./rule_providers/apple-cn.mrs",
    "interval": 86400
  },
  "microsoft-cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft@cn.mrs",
    "path": "./rule_providers/microsoft-cn.mrs",
    "interval": 86400
  },
  "cn-domain": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs",
    "path": "./rule_providers/cn-domain.mrs",
    "interval": 86400
  },
  "geolocation-!cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs",
    "path": "./rule_providers/geolocation-!cn.mrs",
    "interval": 86400
  },
  "cn-ip": {
    "type": "http",
    "behavior": "ipcidr",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs",
    "path": "./rule_providers/cn-ip.mrs",
    "interval": 86400
  }
};

const RULES = [
  "DOMAIN-SUFFIX,app-measurement.com,🛡️ 广告拦截",
  "DOMAIN-KEYWORD,adservice,🛡️ 广告拦截",
  "DOMAIN-KEYWORD,pangolin-sdk-toutiao,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pt.example.edu.cn,DIRECT",
  "DOMAIN-SUFFIX,local,DIRECT",
  "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
  "DOMAIN-SUFFIX,cursor.sh,🚀 节点选择",
  "DOMAIN-SUFFIX,perplexity.ai,🚀 节点选择",
  "DOMAIN-KEYWORD,vercel,🚀 节点选择",
  "RULE-SET,private,DIRECT",
  "RULE-SET,category-httpdns-cn,🛡️ 广告拦截",
  "RULE-SET,category-ads-all,🛡️ 广告拦截",
  "RULE-SET,category-ai-!cn,🤖 AI 服务专属",
  "RULE-SET,google-gemini,🤖 AI 服务专属",
  "RULE-SET,tiktok,🎵 TikTok 专属",
  "RULE-SET,youtube,🎬 流媒体解锁",
  "RULE-SET,netflix,🎬 流媒体解锁",
  "RULE-SET,disney,🎬 流媒体解锁",
  "RULE-SET,spotify,🎬 流媒体解锁",
  "RULE-SET,telegram,📲 电报与社交,no-resolve",
  "RULE-SET,github,🚀 节点选择",
  "RULE-SET,google,🚀 节点选择",
  "RULE-SET,steam,🎮 游戏与平台",
  "RULE-SET,apple-cn,DIRECT",
  "RULE-SET,microsoft-cn,DIRECT",
  "RULE-SET,cn-domain,DIRECT",
  "RULE-SET,geolocation-!cn,🚀 节点选择",
  "RULE-SET,cn-ip,DIRECT,no-resolve",
  "GEOIP,LAN,DIRECT,no-resolve",
  "MATCH,🐟 漏网之鱼"
];

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
      ipv6: false,
      'respect-rules': true,
      'enhanced-mode': "fake-ip",
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
      'proxy-server-nameserver': ["https://dns.alidns.com/dns-query"],
      'direct-nameserver': ["https://dns.alidns.com/dns-query"],
      nameserver: ["https://1.1.1.1/dns-query"],
      'nameserver-policy': {
        'RULE-SET:private,cn-domain,apple-cn,microsoft-cn': ["https://dns.alidns.com/dns-query"],
        'geosite:cn,private': ["https://dns.alidns.com/dns-query"],
        'geosite:geolocation-!cn': ["https://1.1.1.1/dns-query"],
      },
    };
  }

  return config;
}
