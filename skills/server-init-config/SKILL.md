---
name: server-init-config
description: Use when an agent initializes or hardens a fresh VPS over ssh-mcp-server, especially Debian, Ubuntu, or Alpine hosts that need SSH policy, firewall, fail2ban, backups, or optional proxy bootstrap.
---

# server-init-config

## Purpose

This skill is for an AI agent operating through `ssh-mcp-server`. It is not a human wizard. Probe the VPS first, pick the OS and memory branch, ask only the branch-specific required policy questions in Chinese, then load only the reference and script files needed for that host.

## Quick Path

1. Run `list-servers` and identify the bootstrap MCP entry.
2. If the target is missing and the user already provided host, port, username, password, and name, create or update the bootstrap MCP entry yourself with `upsert-server` or `references/bootstrap-mcp-config.md`; 不要要求用户手工加入 MCP 配置.
3. Probe OS and actual usable memory with `scripts/common/probe.sh`; use `effective_memory_mb`, not MemTotal alone.
4. Pick exactly one OS flow reference, and only one:
   - Alpine with `effective_memory_mb < 256`: `references/flows/alpine-low-memory.md`
   - Alpine with `effective_memory_mb >= 256`: `references/flows/alpine-standard.md`
   - Debian/Ubuntu: `references/flows/debian-standard.md`
5. Ask branch-specific policy questions in Chinese; use `references/policy-questions.md`.
6. After policy selection, add exactly one login policy reference for standard Alpine, Debian, and Ubuntu flows if needed: `references/flows/root-password.md` or `references/flows/zheng-key-lockdown.md`.
7. Add feature references only for selected options: backup, fail2ban, BBR, VLESS + Reality, or HY2.
8. Upload and run only the scripts named by the selected flow, login policy, and features.
9. For `zheng` mode, add a parallel temporary MCP entry only after `ssh-prepare.sh`; do not replace, switch, or delete the bootstrap MCP entry until the temporary entry proves `whoami` and sudo.
10. Verify through MCP before SSH lockdown, final MCP config switch, or deleting remote scripts.
11. Delete remote deployment scripts only after final MCP verification works.

## Mandatory Rules

- 所有面向用户的询问必须使用中文。
- 当用户已经提供连接名称、host、port、username、password 时，agent 必须优先使用 `upsert-server` 自己创建或更新 bootstrap MCP 配置并验证 `list-servers`；不要要求用户手工加入 MCP 配置。
- 不要在 OS 和 `effective_memory_mb` 探测完成前询问策略问题；必须先选定低内存 Alpine、标准 Alpine、Debian/Ubuntu 之一。
- 低内存 Alpine 分支只询问是否执行小内存默认初始化流程，以及是否安装代理；不要询问 `zheng`、备份、修改密码、fail2ban 或 BBR。
- 标准 Alpine、Debian、Ubuntu 流程必须询问：是否创建 `zheng` 用户并切换 MCP 到密钥登录，还是保持 `root + password` 登录？
- 标准 Alpine、Debian、Ubuntu 流程必须询问：是否安装代理？选项包括不安装、VLESS 默认配置、HY2 默认配置、VLESS 自定义端口、HY2 自定义端口、VLESS 详细配置。
- 标准 Alpine、Debian、Ubuntu 流程必须询问：是否启用备份？
- 标准 Alpine、Debian、Ubuntu 流程必须询问：是否修改固定密码？固定密码为 `212243`。
- 标准 Alpine、Debian、Ubuntu 流程必须询问：是否启用 fail2ban？
- Every remote command must use the MCP/tool timeout. Also wrap remote shell commands with `timeout` when the remote host has it. If remote `timeout` is missing on minimal systems, keep the MCP/tool timeout active and install required tools before long-running commands.
- If any referenced `references/...` or `scripts/...` file is missing, stop and report that the `server-init-config` skill installation is incomplete; do not improvise missing guidance or scripts.
- Actual memory means `effective_memory_mb` from `scripts/common/probe.sh` or `scripts/common/memory.sh`; do not classify NAT or container hosts from `/proc/meminfo` alone.
- Alpine `effective_memory_mb <256MB` 时，必须用中文询问用户是否执行默认初始化流程；小内存 Alpine 默认流程仅且仅有三步：更新系统、安装必要工具、安装代理。
- Normal Debian/Ubuntu and standard Alpine flows 必须先更新系统并安装必要工具 before optional changes.
- Normal flows must run BBR 调优必须在代理安装之前完成 when BBR is selected; low-memory Alpine must not run BBR.
- Never disable root login, password login, or the bootstrap SSH port until a parallel temporary MCP entry has proven `whoami` and `sudo -S whoami`.
- SSH handoff safety gate: prepare must keep bootstrap root/password and the old port alive; then add a parallel temporary MCP entry for `zheng` on port `17223`; then `whoami` must return `zheng`; then `printf '212243\n' | sudo -S -p '' whoami` must return `root`; only then run `scripts/features/ssh-lockdown.sh` through sudo with `FINALIZE_SSH_LOCKDOWN=1`.
- If root password changes in root mode, update the MCP config before reconnecting.
- In `zheng` mode, adding a parallel temporary MCP entry is allowed only for verification. Replacing, switching default to, or removing the bootstrap MCP entry is forbidden until final post-lockdown MCP verification passes.
- Do not run `scripts/features/ssh-lockdown.sh` unless `FINALIZE_SSH_LOCKDOWN=1` and MCP proof has succeeded.
- Do not remove remote deployment scripts until final verification succeeds.

## References

- Start here: `references/quick-path.md`
- Bootstrap MCP config: `references/bootstrap-mcp-config.md`
- Policy questions: `references/policy-questions.md`
- Memory detection: `references/memory-detection.md`
- Task tracking: `references/task-tracking.md`
- MCP handoff and SSH lockout prevention: `references/mcp-handoff.md`
- Failure handling: `references/failure-handling.md`

Flow references:

- `references/flows/alpine-low-memory.md`
- `references/flows/alpine-standard.md`
- `references/flows/debian-standard.md`

Login policy references:

- `references/flows/root-password.md`
- `references/flows/zheng-key-lockdown.md`

Feature references:

- `references/features/backup.md`
- `references/features/bbr.md`
- `references/features/fail2ban.md`
- `references/features/proxy-vless-reality.md`
- `references/features/proxy-hy2.md`

## Script Map

- Common probes/helpers: `scripts/common/`; run `scripts/common/probe.sh` as the top-level probe entry.
- OS flows: `scripts/flows/`
- Optional capabilities: `scripts/features/`

Upload only the required scripts for the selected flow. Do not upload every script by default.
