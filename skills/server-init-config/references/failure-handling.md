# Failure Handling

Stop at the first failed safety check.

- If OS or memory detection fails, do not upload flow scripts.
- If package update fails, do not continue into SSH changes.
- If proxy installation fails, report proxy failure and keep SSH recovery path unchanged.
- If SSH prepare fails, leave bootstrap root/password available and do not update MCP config.
- If new MCP entry cannot connect, do not run SSH lockdown.
- If `zheng` sudo proof fails, do not run SSH lockdown.
- If final verification fails, do not remove remote deployment scripts.
- If low-memory Alpine is detected, skipping `zheng`, fail2ban, backup, BBR, and SSH lockdown is expected unless the user explicitly overrides the flow.

The final verification rule is strict: before MCP migration, SSH lockdown, or cleanup, prove the current recovery path works through MCP and record the evidence.
