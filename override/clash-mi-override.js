/**
 * Clash Mi 全局分流与节点过滤覆写脚本 (JS Overwrite)
 * 仓库: your-github-username/clash-mi-override (main)
 * 特性: 自动测速(url-test) · 故障转移(fallback) · 负载均衡 · HTTPDNS+全网去广告 · 空地区组自动跳过
 * 用法: 在 Clash Mi「覆写」页添加此脚本 Raw URL，任意机场订阅均可自动套用。
 */

const GLOBAL_EXCLUDE = "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国";
const STRIP_EXCLUDED_PROXIES = true;
const SKIP_EMPTY_REGION_GROUPS = true;
const OVERWRITE_DNS = true;
const OVERWRITE_SNIFFER = true;

const GROUP_SPECS = [
  {
    "id": "grp-auto",
    "name": "♻️ 自动测速优选",
    "type": "url-test",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-select",
    "name": "🚀 节点选择",
    "type": "select",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": [
      "♻️ 自动测速优选",
      "🚨 故障转移",
      "⚖️ 负载均衡",
      "🎯 手动节点列表",
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
    "id": "grp-failover",
    "name": "🚨 故障转移",
    "type": "fallback",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "https://www.gstatic.com/generate_204",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-manual",
    "name": "🎯 手动节点列表",
    "type": "select",
    "filter": "",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
    "url": "",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": true,
    "proxies": []
  },
  {
    "id": "grp-youtube",
    "name": "📺 YouTube 专属",
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
      "🇭🇰 香港节点",
      "🇹🇼 台湾节点",
      "🇸🇬 狮城节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点",
      "🎯 手动节点列表",
      "🚀 节点选择"
    ]
  },
  {
    "id": "grp-ai",
    "name": "🤖 AI 服务专属",
    "type": "select",
    "filter": "美|新|日|台|US|SG|JP|TW|🇺🇸|🇸🇬|🇯🇵|🇹🇼",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国|港|HK|Hong|🇭🇰|俄|RU|CN",
    "url": "https://chat.openai.com",
    "interval": 300,
    "tolerance": 50,
    "strategy": "consistent-hashing",
    "includeAllProxies": false,
    "proxies": [
      "🇸🇬 狮城节点",
      "🇺🇸 美国节点",
      "🇯🇵 日本节点",
      "🇹🇼 台湾节点",
      "🎯 手动节点列表"
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
      "♻️ 自动测速优选",
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
      "♻️ 自动测速优选",
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
      "♻️ 自动测速优选",
      "🚀 节点选择",
      "🇭🇰 香港节点",
      "🇯🇵 日本节点",
      "🇺🇸 美国节点"
    ]
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
    "id": "grp-hk",
    "name": "🇭🇰 香港节点",
    "type": "url-test",
    "filter": "港|HK|Hong\\s?Kong|🇭🇰",
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
    "excludeFilter": "剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\\d+(?:\\.\\d+)?\\s?(?:GB|TB|MB)\\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国",
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
      "♻️ 自动测速优选",
      "🚀 节点选择",
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
  "awavenue-ads": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.mrs",
    "path": "./rule_providers/awavenue-ads.mrs",
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
  "adblock-ultra": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/217heidai/adblockfilters/main/rules/adblockmihomo.mrs",
    "path": "./rule_providers/adblock-ultra.mrs",
    "interval": 86400
  },
  "cats-adrules": {
    "type": "http",
    "behavior": "domain",
    "format": "text",
    "url": "https://raw.githubusercontent.com/Cats-Team/AdRules/main/adrules_domainset.txt",
    "path": "./rule_providers/cats-adrules.txt",
    "interval": 86400
  },
  "adguard-base": {
    "type": "http",
    "behavior": "domain",
    "format": "yaml",
    "url": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AdGuardSDNSFilter/AdGuardSDNSFilter_Domain.yaml",
    "path": "./rule_providers/adguard-base.yaml",
    "interval": 86400
  },
  "privacy-domain": {
    "type": "http",
    "behavior": "domain",
    "format": "yaml",
    "url": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Privacy/Privacy_Domain.yaml",
    "path": "./rule_providers/privacy-domain.yaml",
    "interval": 86400
  },
  "ai-non-cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs",
    "path": "./rule_providers/ai-non-cn.mrs",
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
  "geolocation-non-cn": {
    "type": "http",
    "behavior": "domain",
    "format": "mrs",
    "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs",
    "path": "./rule_providers/geolocation-non-cn.mrs",
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

const AD_DOMAIN_PROVIDERS = ["category-httpdns-cn","awavenue-ads","category-ads-all","adblock-ultra","cats-adrules","adguard-base","privacy-domain"];

const RULES = [
  "DOMAIN-SUFFIX,doubleclick.net,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,googlesyndication.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,googleadservices.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,adservice.google.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,google-analytics.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,fundingchoicesmessages.google.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,s0.2mdn.net,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ads.youtube.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,app-measurement.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,crashlytics.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,firebaseinappmessaging.googleapis.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ads.tiktok.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ads-sg.tiktok.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,analytics.tiktok.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pangolin-sdk-toutiao.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pangolin-sdk-toutiao-b.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pangolin.snssdk.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pglstatp-toutiao.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,toblog.ctobsnssdk.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,gdt.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,adsmind.gdtimg.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pgdt.gtimg.cn,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,tangram.e.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,sdk.e.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ad.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,btrace.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,tpns.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,tmead.y.qq.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,mobads.baidu.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,mobads-logs.baidu.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,pos.baidu.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,als.baidu.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,e.kuaishou.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,open.e.kuaishou.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,gdfp.gifshow.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,umeng.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,umengcloud.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,alog.umeng.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ad.xiaomi.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,sdkconfig.ad.xiaomi.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,data.mistat.xiaomi.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,tracking.miui.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,ads.heytapmobi.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,adx.ads.oppomobi.com,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,stsdk.vivo.com.cn,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,adreq.vivo.com.cn,🛡️ 广告拦截",
  "DOMAIN-SUFFIX,log-upload-os.hoyoverse.com,🛡️ 广告拦截",
  "DOMAIN-KEYWORD,adservice,🛡️ 广告拦截",
  "DOMAIN-KEYWORD,pangolin-sdk-toutiao,🛡️ 广告拦截",
  "IP-CIDR,203.107.1.0/24,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,119.29.29.98/32,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,119.29.29.99/32,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,180.76.76.200/32,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,101.226.103.106/32,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,101.226.212.27/32,🛡️ 广告拦截,no-resolve",
  "IP-CIDR,117.185.228.108/32,🛡️ 广告拦截,no-resolve",
  "DOMAIN-SUFFIX,pt.example.edu.cn,DIRECT",
  "DOMAIN-SUFFIX,local,DIRECT",
  "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
  "DOMAIN-SUFFIX,cursor.sh,🚀 节点选择",
  "DOMAIN-SUFFIX,perplexity.ai,🚀 节点选择",
  "DOMAIN-KEYWORD,vercel,🚀 节点选择",
  "AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,youtube)),REJECT-DROP",
  "AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,category-ads-all)),REJECT-DROP",
  "AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,awavenue-ads)),REJECT-DROP",
  "RULE-SET,private,DIRECT",
  "RULE-SET,category-httpdns-cn,🛡️ 广告拦截",
  "RULE-SET,awavenue-ads,🛡️ 广告拦截",
  "RULE-SET,category-ads-all,🛡️ 广告拦截",
  "RULE-SET,adblock-ultra,🛡️ 广告拦截",
  "RULE-SET,cats-adrules,🛡️ 广告拦截",
  "RULE-SET,adguard-base,🛡️ 广告拦截",
  "RULE-SET,privacy-domain,🛡️ 广告拦截",
  "RULE-SET,ai-non-cn,🤖 AI 服务专属",
  "RULE-SET,google-gemini,🤖 AI 服务专属",
  "RULE-SET,tiktok,🎵 TikTok 专属",
  "RULE-SET,youtube,📺 YouTube 专属",
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
  "RULE-SET,geolocation-non-cn,🚀 节点选择",
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
    if (true) {
      for (var ak = 0; ak < adDomainKeys.length; ak++) {
        fakeIpFilterList.push('RULE-SET:' + adDomainKeys[ak]);
      }
      if (adDomainKeys.length > 0) {
        dnsPolicy['RULE-SET:' + adDomainKeys.join(',')] = ['rcode://success'];
      }
      dnsPolicy['geosite:category-ads-all'] = ['rcode://success'];
    }
    dnsPolicy['geosite:cn,private'] = ["https://dns.alidns.com/dns-query"];
    dnsPolicy['geosite:geolocation-!cn'] = ["https://1.1.1.1/dns-query"];
    if (chinaPolicyProviders.length > 0) {
      dnsPolicy['RULE-SET:' + chinaPolicyProviders.join(',')] = ["https://dns.alidns.com/dns-query"];
    }

    config.dns = {
      enable: true,
      ipv6: false,
      'respect-rules': true,
      'enhanced-mode': "fake-ip",
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': fakeIpFilterList,
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'proxy-server-nameserver': ['223.5.5.5', '119.29.29.29', "https://dns.alidns.com/dns-query"],
      'direct-nameserver': ["https://dns.alidns.com/dns-query"],
      nameserver: ["https://1.1.1.1/dns-query"],
      'nameserver-policy': dnsPolicy,
    };
  }

  return config;
}
