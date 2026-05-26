# Debian Standard Flow

Use when OS is Debian or Ubuntu.

Run `scripts/flows/debian-standard.sh` first. It handles `apt-get update`, non-interactive required tool installation, and Debian/Ubuntu service assumptions. Then run selected feature scripts.

Normal ordering:

1. update.
2. tools.
3. optional backup.
4. optional SSH prepare.
5. optional fail2ban.
6. optional BBR.
7. selected proxy.
8. verify.
9. MCP handoff.
10. optional SSH lockdown.
11. cleanup.

BBR and network tuning must run before proxy installation when both are selected.
