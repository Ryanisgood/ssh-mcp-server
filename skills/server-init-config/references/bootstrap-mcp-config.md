# Bootstrap MCP Config

Use this when the user already provided the bootstrap connection fields: name, host, port, username, and password. 用户已经提供连接名称、host、port、username、password 时，agent 必须自己写入 bootstrap MCP 配置。Do not ask the user to manually add the MCP config. 不要要求用户手工加入 MCP 配置。

## Required behavior

1. Read the active Codex MCP server config and identify how `ssh-mcp-server` is started.
2. If the active MCP exposes `upsert-server`, call it first; this writes the `--config-file` inventory and refreshes the running MCP process without restart.
3. If `upsert-server` returns `CONFIG_FILE_REQUIRED`, prefer converting to or creating a JSON config file, then update the MCP server args to use `--config-file`.
4. Preserve existing SSH entries and unrelated MCP config fields.
5. After `upsert-server`, re-run `list-servers`.
6. If manual JSON editing was unavoidable, call `reload-config`; only if that tool is unavailable or returns `CONFIG_FILE_REQUIRED`, tell the user to restart or reload Codex/MCP, then verify with `list-servers` before remote probing.
7. After the VPS initialization flow is complete and the final MCP connection has been verified, ask in Chinese whether to add optional VPS billing metadata to the same inventory entry: renewal price, expiration date, and billing cycle.

For this workspace the ssh-mcp-server entry uses:

```text
/Users/zheng/.ssh-mcp-config.json
```

## Upsert shape

Preferred MCP tool call:

```json
{
  "tool": "upsert-server",
  "params": {
    "name": "连接名称",
    "host": "203.0.113.10",
    "port": 22,
    "username": "root",
    "password": "用户提供的密码"
  }
}
```

Optional billing metadata can be included during the same upsert, or added after final verification:

```json
{
  "tool": "upsert-server",
  "params": {
    "name": "连接名称",
    "host": "203.0.113.10",
    "port": 22,
    "username": "root",
    "password": "用户提供的密码",
    "renewalPrice": "35 CNY",
    "expiresAt": "2026-12-31",
    "billingCycle": "yearly"
  }
}
```

Use object format unless the existing file is already an array. For object format, write the provided name as the object key:

```json
{
  "连接名称": {
    "host": "203.0.113.10",
    "port": 22,
    "username": "root",
    "password": "用户提供的密码"
  }
}
```

For array format, write the name inside the object:

```json
{
  "name": "连接名称",
  "host": "203.0.113.10",
  "port": 22,
  "username": "root",
  "password": "用户提供的密码"
}
```

## Safety rules

- Do not print the password in the final report.
- Do not delete existing entries.
- If the name already exists with a different host or username, ask in Chinese whether to overwrite or choose a new name.
- Do not run VPS initialization until `list-servers` shows the intended bootstrap entry.
- Prefer `upsert-server` and `reload-config` over manual file edits because they update the already-running MCP server.
- Record whether restart/reload was required.
- Do not invent billing metadata. Ask the user after configuration completes: “是否需要把这台 VPS 的续费价格、到期时间和付费周期写入 inventory？”
- When adding billing metadata after final verification, preserve the existing host, port, username, and authentication fields in the `upsert-server` call.
