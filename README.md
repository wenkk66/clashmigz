# clash-mi-override

专为 **Clash Mi** 设计的 GitHub 全局分流**覆写模板**仓库（支持 YAML 覆写 + JS 覆写脚本）。
无需在仓库中存放任何机场订阅链接，添加到 Clash Mi「**覆写**」后，客户端内的**所有订阅**均可直接套用同一套分流、自动选择、故障转移、节点过滤与去广告逻辑。

## 内置核心能力

- **自动测速优先 (`url-test`)**：`♻️ 自动测速优选` 置于策略组与主选择组第一位置，全节点与各地区组支持 50ms 容差自动切最优节点。
- **完整节点列表可见**：主组 `🚀 节点选择` 同时保留地区分组与全部清洗后单节点，另附独立 `🎯 手动节点列表`，兼容 `proxies` 与 `proxy-providers` 订阅。
- **自动故障转移 (`fallback`)**：每 180 秒探测可用性，当前节点失联时自动无缝切换至下一个可用节点。
- **负载均衡 (`load-balance`)**：基于 `consistent-hashing` 会话保持的并发分流。
- **分级多引擎去广告、隐私保护与 YouTube 优化**（当前等级：`balanced`）：支持按设备性能一键切换轻量 / 均衡 / 极客满血去广告（最高 11 大引擎），集成 **HaGeZi Multi PRO++**、**AdGuard 基础 (SDNS)**、**blackmatrix7 Privacy 隐私追踪 / Hijacking 反劫持 / 移动端广告增强**、**AWAvenue-Ads（秋风 .mrs）**、**217heidai AdGuard+EasyList 全量**、**Cats-Team AdRules**、**anti-AD** 与 **HTTPDNS 拦截**，开启 TLS/QUIC `override-destination` 深度嗅探并全链路阻断 YouTube 与广告 SDK 的 QUIC UDP 443。
- **智能空组跳过（JS 模式）**：自动清洗无效/高倍率提示节点（保留 `10Gbps`、`GB` 节点），并在订阅缺少某地区节点时自动跳过对应分组。

## 导入 Clash Mi 的覆写订阅链接

### 1. YAML 分流覆写模板 (`override/diversion.yaml`)
- **GitHub Raw URL**:
  `https://raw.githubusercontent.com/your-github-username/clash-mi-override/main/override/diversion.yaml`
- **jsDelivr CDN 加速**:
  `https://cdn.jsdelivr.net/gh/your-github-username/clash-mi-override@main/override/diversion.yaml`

### 2. JS 智能覆写脚本 (`override/clash-mi-override.js`) — 推荐
- **GitHub Raw URL**:
  `https://raw.githubusercontent.com/your-github-username/clash-mi-override/main/override/clash-mi-override.js`
- **jsDelivr CDN 加速**:
  `https://cdn.jsdelivr.net/gh/your-github-username/clash-mi-override@main/override/clash-mi-override.js`

### 3. 每日自动提取节点订阅 (`subscriptions/`)
- **Clash Mi YAML 节点订阅**:
  `https://raw.githubusercontent.com/your-github-username/clash-mi-override/main/subscriptions/clash-mi-nodes.yaml`
- **通用 Base64 节点订阅**:
  `https://raw.githubusercontent.com/your-github-username/clash-mi-override/main/subscriptions/nodes-base64.txt`
- **纯文本分享链接**:
  `https://raw.githubusercontent.com/your-github-username/clash-mi-override/main/subscriptions/nodes-raw.txt`


## 使用步骤（Clash Mi 客户端）

1. 打开 Clash Mi → 进入 **覆写** 页面。
2. 点击右上角 **云朵图标**（从 URL 导入），粘贴上面的 **JS** 或 **YAML** 链接（或下载文件后点击 `+` 从本地导入）。
3. 选中该覆写项启用后，切换任意机场订阅都会自动套用全部策略与过滤规则。

## 仓库自定义规则自动同步

直接编辑仓库中的以下文件并提交，GitHub Actions（或定时 `0 */12 * * *`）会自动合并规则并更新覆写模板：
- `rules/custom-proxy.list`：自定义强制走代理规则
- `rules/custom-direct.list`：自定义强制直连规则
- `rules/custom-reject.list`：自定义去广告/屏蔽拦截规则
- 规则集引擎：MetaCubeX `.mrs` 二进制规则集
- 节点全局排除正则：`剩余流量|套餐到期|过期时间|官网|距离下次重置|Traffic|Expire|\d+(?:\.\d+)?\s?(?:GB|TB|MB)\b|Test|测试|通知|订阅|群组|邀请|倍率.*[3-9]|10x|回国`
