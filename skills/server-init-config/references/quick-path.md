# Quick Path

Use this sequence for every VPS initialization.

1. Confirm the target MCP entry with `list-servers`.
2. Create or update the bootstrap MCP entry yourself when the user already provided name, host, port, username, and password; prefer `upsert-server`, then see `references/bootstrap-mcp-config.md`.
3. Re-run `list-servers` and confirm the named bootstrap entry exists before any remote probe.
4. Probe OS and actual usable memory by uploading and running `scripts/common/probe.sh`.
5. Record OS ID, OS family, package manager, service manager, `effective_memory_mb`, and memory source.
6. Select one OS flow:
   - Alpine and `effective_memory_mb < 256`: low-memory Alpine flow.
   - Alpine and `effective_memory_mb >= 256`: standard Alpine flow.
   - Debian or Ubuntu: standard Debian flow.
7. Ask branch-specific policy questions in Chinese from `references/policy-questions.md`.
8. Add only the selected login policy and feature scripts.
9. Run with timeouts and stop on the first failed safety check.
10. Verify through MCP before MCP config migration, SSH lockdown, or cleanup.

Never classify low-memory NAT or container VPS hosts from `/proc/meminfo` alone. Always use `effective_memory_mb`.
