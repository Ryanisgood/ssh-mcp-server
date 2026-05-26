# Policy Questions

Do not ask policy questions until OS and effective memory are known. Ask only branch-specific questions in Chinese. 所有面向用户的问题都必须使用中文。

## Low-memory Alpine questions

Use only when OS is Alpine and `effective_memory_mb < 256`.

1. 检测到 Alpine 且实际可用内存 <256MB，是否执行小内存默认初始化流程（仅更新系统、安装必要工具、安装代理）？
2. 是否安装代理？选项：不安装、VLESS 默认配置、HY2 默认配置、VLESS 自定义端口、HY2 自定义端口、VLESS 详细配置。

Do not ask for `zheng`, backup, password change, fail2ban, firewall hardening, or BBRv3 in the low-memory Alpine branch.

## Standard flow questions

Use for standard Alpine, Debian, and Ubuntu flows.

1. 是否创建 `zheng` 用户并切换 MCP 到密钥登录，还是保持 `root + password` 登录？
2. 是否安装代理？选项：不安装、VLESS 默认配置、HY2 默认配置、VLESS 自定义端口、HY2 自定义端口、VLESS 详细配置。
3. 是否启用备份？

## zheng conditional question

Only ask the fixed-password question after `login_mode: zheng_key_lockdown`:

1. 是否修改 `zheng` 的固定 sudo 密码？固定密码是 `212243`。

If `login_mode: root_password`, record `change_password: false` without asking. Do not reset root password.

Do not ask the user whether to enable fail2ban, firewall hardening, or BBRv3. Standard flows default all three to enabled.

## Required policy decision record

For standard Alpine, Debian, and Ubuntu flows, record this exact block before selecting login policy or feature scripts:

```text
policy_decision_record:
  login_mode: zheng_key_lockdown | root_password
  proxy_choice: none | vless_default | hy2_default | vless_custom_port | hy2_custom_port | vless_detailed
  backup_enabled: true | false
  change_password: true | false
  fail2ban_enabled: true
  firewall_enabled: true
  bbr_enabled: true
```

Missing any user-answer field means BLOCKED. Stop with `POLICY_INCOMPLETE_STOP` and ask only the missing question(s) in Chinese.

Do not infer defaults from partial user instructions. If the user says only "no backup" and "VLESS", this is incomplete: `login_mode` is still missing. If the selected login mode is `zheng_key_lockdown`, `change_password` is also missing until the conditional fixed-password question is answered.

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

Firewall choice maps to feature scripts:

- `firewall_enabled: true`: run `scripts/features/firewall.sh` only after required tools are installed and after the exact SSH/proxy ports are known. It must allow the current SSH port, any selected final SSH port, and the selected proxy port before enabling deny rules.
