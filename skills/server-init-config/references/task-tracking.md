# Task Tracking

Create task tracking before remote changes. Keep exactly one task `in_progress`.

| Status | Task | Success Check | Stop Condition | Evidence to Record |
|---|---|---|---|---|
| pending | Confirm target MCP entry | Target server name, host, port, username known | Target missing or ambiguous | MCP entry name and connection fields |
| pending | Create bootstrap MCP entry | Provided name, host, port, username, password are written to ssh-mcp-server config | Required connection field missing | Config path, connection name, host, port, username |
| pending | Verify bootstrap MCP entry | `list-servers` shows the named entry | MCP needs restart or config malformed | `list-servers` entry |
| pending | Probe OS and effective memory | OS ID/family and `effective_memory_mb` known | Probe cannot run | `os_id`, `os_family`, package manager, service manager, `effective_memory_mb`, memory source |
| pending | Select flow | Exactly one flow selected | OS unsupported | Chosen flow reference and script |
| pending | Ask Chinese policy questions | `policy_decision_record` has `login_mode`, `proxy_choice`, `backup_enabled`, conditional `change_password`, `fail2ban_enabled=true`, `firewall_enabled=true`, and `bbr_enabled=true` | Any required standard-flow user-answer field missing: stop with `POLICY_INCOMPLETE_STOP` | Full `policy_decision_record` |
| pending | Resolve selected features | Feature script list is explicit | Feature choice incomplete | Exact feature scripts and env vars |
| pending | Upload required scripts only | Remote files exist | Upload fails | Remote deployment path |
| pending | Execute selected flow | Flow exits 0 | Timeout or package failure | Flow output summary |
| pending | Execute selected features | Selected features exit 0 or report skipped | Feature failure blocks SSH safety | Feature output summary |
| pending | Verify current MCP | `whoami` returns expected user | MCP cannot connect | `whoami` output |
| pending | Prove sudo if using zheng | `sudo -S whoami` returns `root` | sudo fails | sudo proof output |
| pending | Finalize SSH lockdown if selected | Lockdown exits 0 after MCP proof | MCP or sudo proof missing | `FINALIZE_SSH_LOCKDOWN=1` run output |
| pending | Cleanup remote scripts | Remote deployment directory removed | Final verification missing | Cleanup result |
| pending | Final report | User sees endpoint, policy, proxy, cleanup state | Previous task incomplete | Final state summary |

Status values must be exactly `pending`, `in_progress`, or `completed`. Move a task to `completed` only after its Success Check has concrete evidence.
