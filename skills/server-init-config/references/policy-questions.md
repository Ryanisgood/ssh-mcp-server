# Policy Questions

Do not ask policy questions until OS and effective memory are known. Ask only branch-specific questions in Chinese. 所有面向用户的问题都必须使用中文。

## Low-memory Alpine questions

Use only when OS is Alpine and `effective_memory_mb < 256`.

1. 检测到 Alpine 且实际可用内存 <256MB，是否执行小内存默认初始化流程（仅更新系统、安装必要工具、安装代理）？
2. 是否安装代理？选项：不安装、VLESS 默认配置、HY2 默认配置、VLESS 自定义端口、HY2 自定义端口、VLESS 详细配置。

Do not ask for `zheng`, backup, password change, fail2ban, or BBR in the low-memory Alpine branch.

## Standard flow questions

Use for standard Alpine, Debian, and Ubuntu flows.

1. 是否创建 `zheng` 用户并切换 MCP 到密钥登录，还是保持 `root + password` 登录？
2. 是否安装代理？选项：不安装、VLESS 默认配置、HY2 默认配置、VLESS 自定义端口、HY2 自定义端口、VLESS 详细配置。
3. 是否启用备份？
4. 是否修改固定密码？固定密码是 `212243`。
5. 是否启用 fail2ban？

Do not ask for SSH port, default password, or public key path unless the user overrides them. Defaults are fixed:

- user: `zheng`
- SSH port: `17223`
- password: `212243`
- public key source: local `~/.ssh/id_ed25519.pub`

Proxy choices map to environment:

- 不安装: no proxy feature script.
- VLESS 默认配置: `INSTALL_VLESS_REALITY=1 VLESS_PORT=443 REALITY_SERVER_NAME=www.cloudflare.com REALITY_DEST_PORT=443`
- HY2 默认配置: `INSTALL_HY2=1 HY2_PORT=443`
- VLESS 自定义端口: ask for `VLESS_PORT`, keep default Reality details.
- HY2 自定义端口: ask for `HY2_PORT`.
- VLESS 详细配置: ask for `VLESS_PORT`, `REALITY_SERVER_NAME`, and `REALITY_DEST_PORT`.

When a custom proxy port is requested, ask only for the specific port value and keep the other defaults unchanged unless the user chooses the detailed VLESS configuration.
