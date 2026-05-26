# zheng Key Lockdown Flow

Use when the user chooses to create `zheng` and switch MCP to key login.

Only in this branch, ask whether to set/reset the zheng sudo password to the fixed password `212243`. If the user answers yes, run `ssh-prepare.sh` with `CHANGE_PASSWORD=1`; otherwise leave the existing `zheng` password unchanged unless the user is newly created.

Run `scripts/features/ssh-prepare.sh` first. It must keep bootstrap root/password and old SSH port available while opening port `17223`.

Only after a parallel temporary MCP entry proves `zheng@17223` and `sudo -S whoami`, run `scripts/features/ssh-lockdown.sh` through sudo from `zheng` with `FINALIZE_SSH_LOCKDOWN=1` and `LOCKDOWN_CONFIRMED_USER=zheng`.

The order is mandatory: `ssh-prepare.sh` before temporary MCP proof, temporary MCP proof before `ssh-lockdown.sh`, final MCP proof before switching or removing the bootstrap MCP entry. Do not close the old port or disable root/password access until the temporary `zheng` MCP path and sudo proof are recorded.
