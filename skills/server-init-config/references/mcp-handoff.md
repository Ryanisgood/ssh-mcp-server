# MCP Handoff

Do not replace, switch default to, or remove the bootstrap MCP entry until final proof succeeds.
After `ssh-prepare.sh`, adding a parallel temporary MCP entry is allowed only so the agent can verify `zheng@17223`.
Do not make the temporary entry authoritative based only on expected SSH settings or local file edits.

For `zheng` mode:

1. Prepare `zheng` and port `17223` while keeping bootstrap root/password and old SSH port alive.
2. Verify prepare through the bootstrap entry while root/password and the old SSH port still work.
3. Add a parallel temporary MCP entry with username `zheng`, port `17223`, and private key `/Users/zheng/.ssh/id_ed25519`; do not replace the bootstrap entry.
4. Connect through the `zheng` entry and run `whoami`; output must be `zheng`.
5. Run `printf '212243\n' | sudo -S -p '' whoami`; output must be `root`.
6. Keep the bootstrap root entry available until `zheng` proves `whoami == zheng` and `sudo -S whoami == root`.
7. Only then run `scripts/features/ssh-lockdown.sh` through sudo from `zheng`, for example `printf '212243\n' | sudo -S -p '' env FINALIZE_SSH_LOCKDOWN=1 LOCKDOWN_CONFIRMED_USER=zheng sh /root/server-init/scripts/features/ssh-lockdown.sh`.
8. Final verify through the `zheng` entry after lockdown.
9. Only after final verification, switch the intended MCP config to `zheng`, remove the bootstrap entry if desired, and run cleanup.

Required proof commands:

1. `whoami`; output must be `zheng`.
2. `printf '212243\n' | sudo -S -p '' whoami`; output must be `root`.

For root mode:

Keep the root MCP entry. Do not change root password in root mode.

Final verification rule: prove the intended MCP entry can connect after every SSH-affecting change and before cleanup.
