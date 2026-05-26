# Root Password Flow

Use when the user chooses to keep `root + password`.

Do not create `zheng`. Do not disable root login. Do not disable password authentication.

If `CHANGE_PASSWORD=1`, reset root password to `212243` and update the root MCP config before reconnecting. This prevents reconnect attempts with stale MCP credentials before reconnect.

Continue using the bootstrap root account for verification and cleanup unless the user later chooses the zheng key lockdown flow.
