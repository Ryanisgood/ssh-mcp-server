# Firewall

Standard flows default to ufw firewall hardening enabled. Do not ask the user whether to enable firewall hardening.

Run `scripts/features/firewall.sh` only when `firewall_enabled: true` in `policy_decision_record`.

Ordering rule: run after required tools and after the current SSH port, prepared final SSH port, and selected proxy port are known. The script must allow current SSH port, any final SSH port, and the selected proxy port before enabling deny rules.

Environment:

- `FIREWALL_SSH_PORT`: current SSH port, usually the bootstrap MCP port; must be explicitly provided.
- `FIREWALL_FINAL_SSH_PORT`: final SSH port if `zheng` mode prepared port `17223`; omit or keep equal to current port in root mode.
- `PROXY_PORT`: selected proxy port when VLESS or HY2 is enabled; omit when no proxy is selected.

Safety:

- Never enable a deny-by-default firewall before allow rules for SSH recovery are installed.
- Use `ufw` only; do not implement other firewall backends here.
- If `ufw` is unavailable, report `firewall=inactive reason=ufw_unavailable` rather than risking a lockout.
