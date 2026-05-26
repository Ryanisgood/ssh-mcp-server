# Backup

Run `scripts/features/backup.sh` only when the user enabled backup.

Ordering rule: run backup after the selected OS flow has installed required tools and before optional SSH prepare, fail2ban, BBR, or proxy changes.

Keep backup archives unless the user asks to remove them. The backup is intended to capture the pre-hardening state of SSH and service configuration.
