export const INITIAL_CLASH_MI_NODES_YAML = `# ============================================================================
# Clash Mi 每日自动提取节点订阅 (clash-mi-nodes.yaml)
# 提取结果: 17 个去重节点 (来自 32/32 个可用源，GitHub Actions 每日自动更新)
# 说明: 可直接作为独立订阅导入 Clash Mi，也可叠加本仓库 override/clash-mi-override.js 覆写使用
# ============================================================================
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: true

proxies:
  - name: "🌐 自动节点 IPv4 Hy1-01 (137.175.82.41)"
    type: "hysteria"
    server: "137.175.82.41"
    port: 20022
    auth-str: "dongtaiwang.com"
    protocol: "udp"
    up: "11 Mbps"
    down: "55 Mbps"
    sni: "bing.com"
    skip-cert-verify: true
    alpn: ["h3"]
  - name: "🌐 自动节点 IPv4 Hy1-02 (137.175.82.42)"
    type: "hysteria"
    server: "137.175.82.42"
    port: 20022
    auth-str: "dongtaiwang.com"
    protocol: "udp"
    up: "11 Mbps"
    down: "55 Mbps"
    sni: "bing.com"
    skip-cert-verify: true
    alpn: ["h3"]
  - name: "🌐 自动节点 IPv4 Hy1-03 (137.175.82.44)"
    type: "hysteria"
    server: "137.175.82.44"
    port: 443
    auth-str: "dongtaiwang.com"
    protocol: "udp"
    up: "11 Mbps"
    down: "55 Mbps"
    sni: "bing.com"
    skip-cert-verify: true
    alpn: ["h3"]
  - name: "🌐 自动节点 IPv4 Mieru-04 (198.200.57.141)"
    type: "mieru"
    server: "198.200.57.141"
    port: 55334
    transport: "TCP"
    username: "alvin9999.com"
    password: "alvin9999.com"
    multiplexing: "MULTIPLEXING_LOW"
    udp: true
  - name: "🌐 自动节点 IPv4 Hy1-05 (5.83.129.90)"
    type: "hysteria"
    server: "5.83.129.90"
    port: 54177
    auth-str: "dongtaiwang.com"
    protocol: "udp"
    up: "11 Mbps"
    down: "55 Mbps"
    sni: "apple.com"
    skip-cert-verify: true
    alpn: ["h3"]
  - name: "🇫🇷 法国 IPv4 Hy1-06 (62.210.124.132)"
    type: "hysteria"
    server: "62.210.124.132"
    port: 24667
    auth-str: "dongtaiwang.com"
    protocol: "udp"
    up: "11 Mbps"
    down: "55 Mbps"
    sni: "bing.com"
    skip-cert-verify: true
    alpn: ["h3"]
  - name: "🇫🇷 法国 IPv6 Hy2-07 (::10)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::10"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-08 (::11)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::11"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-09 (::13)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::13"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-10 (::15)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::15"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-11 (::16)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::16"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-12 (::17)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::17"
    port: 22000
    password: "dongtaiwang.com"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    alpn: ["h3"]
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-13 (::3)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::3"
    port: 22000
    password: "dongtaiwang.com"
    up: "11 mbps"
    down: "55 mbps"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-14 (::4)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::4"
    port: 22000
    password: "dongtaiwang.com"
    up: "11 mbps"
    down: "55 mbps"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-15 (::6)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::6"
    port: 22000
    password: "dongtaiwang.com"
    up: "11 mbps"
    down: "55 mbps"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-16 (::7)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::7"
    port: 22000
    password: "dongtaiwang.com"
    up: "11 mbps"
    down: "55 mbps"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    udp: true
  - name: "🇫🇷 法国 IPv6 Hy2-17 (::8)"
    type: "hysteria2"
    server: "2001:bc8:32d7:17b::8"
    port: 22000
    password: "dongtaiwang.com"
    up: "11 mbps"
    down: "55 mbps"
    sni: "www.microsoft.com"
    skip-cert-verify: true
    udp: true

proxy-groups:
  - name: "♻️ 自动测速优选"
    type: url-test
    url: "https://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:
      - "🌐 自动节点 IPv4 Hy1-01 (137.175.82.41)"
      - "🌐 自动节点 IPv4 Hy1-02 (137.175.82.42)"
      - "🌐 自动节点 IPv4 Hy1-03 (137.175.82.44)"
      - "🌐 自动节点 IPv4 Mieru-04 (198.200.57.141)"
      - "🌐 自动节点 IPv4 Hy1-05 (5.83.129.90)"
      - "🇫🇷 法国 IPv4 Hy1-06 (62.210.124.132)"
      - "🇫🇷 法国 IPv6 Hy2-07 (::10)"
      - "🇫🇷 法国 IPv6 Hy2-08 (::11)"
      - "🇫🇷 法国 IPv6 Hy2-09 (::13)"
      - "🇫🇷 法国 IPv6 Hy2-10 (::15)"
      - "🇫🇷 法国 IPv6 Hy2-11 (::16)"
      - "🇫🇷 法国 IPv6 Hy2-12 (::17)"
      - "🇫🇷 法国 IPv6 Hy2-13 (::3)"
      - "🇫🇷 法国 IPv6 Hy2-14 (::4)"
      - "🇫🇷 法国 IPv6 Hy2-15 (::6)"
      - "🇫🇷 法国 IPv6 Hy2-16 (::7)"
      - "🇫🇷 法国 IPv6 Hy2-17 (::8)"
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "♻️ 自动测速优选"
      - "🚨 故障转移"
      - "🌐 自动节点 IPv4 Hy1-01 (137.175.82.41)"
      - "🌐 自动节点 IPv4 Hy1-02 (137.175.82.42)"
      - "🌐 自动节点 IPv4 Hy1-03 (137.175.82.44)"
      - "🌐 自动节点 IPv4 Mieru-04 (198.200.57.141)"
      - "🌐 自动节点 IPv4 Hy1-05 (5.83.129.90)"
      - "🇫🇷 法国 IPv4 Hy1-06 (62.210.124.132)"
      - "🇫🇷 法国 IPv6 Hy2-07 (::10)"
      - "🇫🇷 法国 IPv6 Hy2-08 (::11)"
      - "🇫🇷 法国 IPv6 Hy2-09 (::13)"
      - "🇫🇷 法国 IPv6 Hy2-10 (::15)"
      - "🇫🇷 法国 IPv6 Hy2-11 (::16)"
      - "🇫🇷 法国 IPv6 Hy2-12 (::17)"
      - "🇫🇷 法国 IPv6 Hy2-13 (::3)"
      - "🇫🇷 法国 IPv6 Hy2-14 (::4)"
      - "🇫🇷 法国 IPv6 Hy2-15 (::6)"
      - "🇫🇷 法国 IPv6 Hy2-16 (::7)"
      - "🇫🇷 法国 IPv6 Hy2-17 (::8)"
      - DIRECT
  - name: "🚨 故障转移"
    type: fallback
    url: "https://www.gstatic.com/generate_204"
    interval: 180
    proxies:
      - "🌐 自动节点 IPv4 Hy1-01 (137.175.82.41)"
      - "🌐 自动节点 IPv4 Hy1-02 (137.175.82.42)"
      - "🌐 自动节点 IPv4 Hy1-03 (137.175.82.44)"
      - "🌐 自动节点 IPv4 Mieru-04 (198.200.57.141)"
      - "🌐 自动节点 IPv4 Hy1-05 (5.83.129.90)"
      - "🇫🇷 法国 IPv4 Hy1-06 (62.210.124.132)"
      - "🇫🇷 法国 IPv6 Hy2-07 (::10)"
      - "🇫🇷 法国 IPv6 Hy2-08 (::11)"
      - "🇫🇷 法国 IPv6 Hy2-09 (::13)"
      - "🇫🇷 法国 IPv6 Hy2-10 (::15)"
      - "🇫🇷 法国 IPv6 Hy2-11 (::16)"
      - "🇫🇷 法国 IPv6 Hy2-12 (::17)"
      - "🇫🇷 法国 IPv6 Hy2-13 (::3)"
      - "🇫🇷 法国 IPv6 Hy2-14 (::4)"
      - "🇫🇷 法国 IPv6 Hy2-15 (::6)"
      - "🇫🇷 法国 IPv6 Hy2-16 (::7)"
      - "🇫🇷 法国 IPv6 Hy2-17 (::8)"

rules:
  - GEOIP,LAN,DIRECT,no-resolve
  - MATCH,🚀 节点选择
`;

export const INITIAL_NODES_RAW_TXT = `hysteria://137.175.82.41:20022?protocol=udp&auth=dongtaiwang.com&peer=bing.com&insecure=1&upmbps=11&downmbps=55&alpn=h3#%F0%9F%8C%90%20%E8%87%AA%E5%8A%A8%E8%8A%82%E7%82%B9%20IPv4%20Hy1-01%20(137.175.82.41)
hysteria://137.175.82.42:20022?protocol=udp&auth=dongtaiwang.com&peer=bing.com&insecure=1&upmbps=11&downmbps=55&alpn=h3#%F0%9F%8C%90%20%E8%87%AA%E5%8A%A8%E8%8A%82%E7%82%B9%20IPv4%20Hy1-02%20(137.175.82.42)
hysteria://137.175.82.44:443?protocol=udp&auth=dongtaiwang.com&peer=bing.com&insecure=1&upmbps=11&downmbps=55&alpn=h3#%F0%9F%8C%90%20%E8%87%AA%E5%8A%A8%E8%8A%82%E7%82%B9%20IPv4%20Hy1-03%20(137.175.82.44)
hysteria://5.83.129.90:54177?protocol=udp&auth=dongtaiwang.com&peer=apple.com&insecure=1&upmbps=11&downmbps=55&alpn=h3#%F0%9F%8C%90%20%E8%87%AA%E5%8A%A8%E8%8A%82%E7%82%B9%20IPv4%20Hy1-05%20(5.83.129.90)
hysteria://62.210.124.132:24667?protocol=udp&auth=dongtaiwang.com&peer=bing.com&insecure=1&upmbps=11&downmbps=55&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv4%20Hy1-06%20(62.210.124.132)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::10]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-07%20(%3A%3A10)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::11]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-08%20(%3A%3A11)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::13]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-09%20(%3A%3A13)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::15]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-10%20(%3A%3A15)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::16]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-11%20(%3A%3A16)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::17]:22000?sni=www.microsoft.com&insecure=1&alpn=h3#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-12%20(%3A%3A17)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::3]:22000?sni=www.microsoft.com&insecure=1#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-13%20(%3A%3A3)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::4]:22000?sni=www.microsoft.com&insecure=1#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-14%20(%3A%3A4)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::6]:22000?sni=www.microsoft.com&insecure=1#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-15%20(%3A%3A6)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::7]:22000?sni=www.microsoft.com&insecure=1#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-16%20(%3A%3A7)
hy2://dongtaiwang.com@[2001:bc8:32d7:17b::8]:22000?sni=www.microsoft.com&insecure=1#%F0%9F%87%AB%F0%9F%87%B7%20%E6%B3%95%E5%9B%BD%20IPv6%20Hy2-17%20(%3A%3A8)
`;

export const INITIAL_NODES_BASE64_TXT = `aHlzdGVyaWE6Ly8xMzcuMTc1LjgyLjQxOjIwMDIyP3Byb3RvY29sPXVkcCZhdXRoPWRvbmd0YWl3YW5nLmNvbSZwZWVyPWJpbmcuY29tJmluc2VjdXJlPTEmdXBtYnBzPTExJmRvd25tYnBzPTU1JmFscG49aDMjJUYwJTlGJThDJTkwJTIwJUU4JTg3JUFBJUU1JThBJUE4JUU4JThBJTgyJUU3JTgyJUI5JTIwSVB2NCUyMEh5MS0wMSUyMCgxMzcuMTc1LjgyLjQxKQpoeXN0ZXJpYTovLzEzNy4xNzUuODIuNDI6MjAwMjI/cHJvdG9jb2w9dWRwJmF1dGg9ZG9uZ3RhaXdhbmcuY29tJnBlZXI9YmluZy5jb20maW5zZWN1cmU9MSZ1cG1icHM9MTEmZG93bm1icHM9NTUmYWxwbj1oMyMlRjAlOUYlOEMlOTAlMjAlRTglODclQUElRTUlOEElQTglRTglOEElODIlRTclODIlQjklMjBJUHY0JTIwSHkxLTAyJTIwKDEzNy4xNzUuODIuNDIpCmh5c3RlcmlhOi8vMTM3LjE3NS44Mi40NDo0NDM/cHJvdG9jb2w9dWRwJmF1dGg9ZG9uZ3RhaXdhbmcuY29tJnBlZXI9YmluZy5jb20maW5zZWN1cmU9MSZ1cG1icHM9MTEmZG93bm1icHM9NTUmYWxwbj1oMyMlRjAlOUYlOEMlOTAlMjAlRTglODclQUElRTUlOEElQTglRTglOEElODIlRTclODIlQjklMjBJUHY0JTIwSHkxLTAzJTIwKDEzNy4xNzUuODIuNDQpCmh5c3RlcmlhOi8vNS44My4xMjkuOTA6NTQxNzc/cHJvdG9jb2w9dWRwJmF1dGg9ZG9uZ3RhaXdhbmcuY29tJnBlZXI9YXBwbGUuY29tJmluc2VjdXJlPTEmdXBtYnBzPTExJmRvd25tYnBzPTU1JmFscG49aDMjJUYwJTlGJThDJTkwJTIwJUU4JTg3JUFBJUU1JThBJUE4JUU4JThBJTgyJUU3JTgyJUI5JTIwSVB2NCUyMEh5MS0wNSUyMCg1LjgzLjEyOS45MCkKaHlzdGVyaWE6Ly82Mi4yMTAuMTI0LjEzMjoyNDY2Nz9wcm90b2NvbD11ZHAmYXV0aD1kb25ndGFpd2FuZy5jb20mcGVlcj1iaW5nLmNvbSZpbnNlY3VyZT0xJnVwbWJwcz0xMSZkb3dubWJwcz01NSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjQlMjBIeTEtMDYlMjAoNjIuMjEwLjEyNC4xMzIpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjEwXToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMDclMjAoJTNBJTNBMTApCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjExXToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMDglMjAoJTNBJTNBMTEpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjEzXToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMDklMjAoJTNBJTNBMTMpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjE1XToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMTAlMjAoJTNBJTNBMTUpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjE2XToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMTElMjAoJTNBJTNBMTYpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjE3XToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSZhbHBuPWgzIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMTIlMjAoJTNBJTNBMTcpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjNdOjIyMDAwP3NuaT13d3cubWljcm9zb2Z0LmNvbSZpbnNlY3VyZT0xIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMTMlMjAoJTNBJTNBMykKaHkyOi8vZG9uZ3RhaXdhbmcuY29tQFsyMDAxOmJjODozMmQ3OjE3Yjo6NF06MjIwMDA/c25pPXd3dy5taWNyb3NvZnQuY29tJmluc2VjdXJlPTEjJUYwJTlGJTg3JUFCJUYwJTlGJTg3JUI3JTIwJUU2JUIzJTk1JUU1JTlCJUJEJTIwSVB2NiUyMEh5Mi0xNCUyMCglM0ElM0E0KQpoeTI6Ly9kb25ndGFpd2FuZy5jb21AWzIwMDE6YmM4OjMyZDc6MTdiOjo2XToyMjAwMD9zbmk9d3d3Lm1pY3Jvc29mdC5jb20maW5zZWN1cmU9MSMlRjAlOUYlODclQUIlRjAlOUYlODclQjclMjAlRTYlQjMlOTUlRTUlOUIlQkQlMjBJUHY2JTIwSHkyLTE1JTIwKCUzQSUzQTYpCmh5MjovL2Rvbmd0YWl3YW5nLmNvbUBbMjAwMTpiYzg6MzJkNzoxN2I6OjddOjIyMDAwP3NuaT13d3cubWljcm9zb2Z0LmNvbSZpbnNlY3VyZT0xIyVGMCU5RiU4NyVBQiVGMCU5RiU4NyVCNyUyMCVFNiVCMyU5NSVFNSU5QiVCRCUyMElQdjYlMjBIeTItMTYlMjAoJTNBJTNBNykKaHkyOi8vZG9uZ3RhaXdhbmcuY29tQFsyMDAxOmJjODozMmQ3OjE3Yjo6OF06MjIwMDA/c25pPXd3dy5taWNyb3NvZnQuY29tJmluc2VjdXJlPTEjJUYwJTlGJTg3JUFCJUYwJTlGJTg3JUI3JTIwJUU2JUIzJTk1JUU1JTlCJUJEJTIwSVB2NiUyMEh5Mi0xNyUyMCglM0ElM0E4KQo=
`;
