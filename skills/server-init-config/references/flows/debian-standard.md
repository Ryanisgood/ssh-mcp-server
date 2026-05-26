# Debian Standard Flow

Use when OS is Debian or Ubuntu.

Run `scripts/flows/debian-standard.sh` first. It handles `apt-get update`, non-interactive required tool installation, and Debian/Ubuntu service assumptions. Then run selected feature scripts.

Do not run `apt-get upgrade` by default during initialization. Use `APT_RUN_UPGRADE=1` only when the user explicitly asks for package upgrades and the task can tolerate longer package-manager work.

Normal ordering:

1. update.
2. tools.
3. optional backup.
4. optional SSH prepare.
5. optional fail2ban.
6. optional BBR.
7. optional firewall after current SSH, final SSH, and selected proxy ports are known.
8. selected proxy.
9. verify.
10. MCP handoff.
11. optional SSH lockdown.
12. cleanup.

BBR and network tuning must run before proxy installation when both are selected.
Firewall hardening must allow the current SSH port, prepared final SSH port, and selected proxy port before enabling deny rules.
