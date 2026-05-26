# Alpine Low Memory Flow

Use when OS is Alpine and `effective_memory_mb < 256`.

小内存 Alpine 默认流程仅且仅有三步：更新系统、安装必要工具、安装代理。

Allowed scripts:

1. `scripts/flows/alpine-low-memory.sh`
2. One selected proxy script if the user chose proxy:
   - `scripts/features/proxy-vless-reality.sh`
   - `scripts/features/proxy-hy2.sh`
3. `scripts/features/cleanup.sh` only after verification.

Forbidden by default: backup, `zheng` creation, password changes, fail2ban, BBR, SSH prepare, SSH lockdown, MCP migration, and extra firewall hardening.

Ask in Chinese before using this flow, because it intentionally avoids hardening features that can exhaust memory or lock out weak NAT/container hosts.
