# Fail2ban

Standard flows default to fail2ban enabled. Do not ask the user whether to enable fail2ban.

Run `scripts/features/fail2ban.sh` in standard flows and not in low-memory Alpine default flow.

Ordering rule: run fail2ban after required tools and any backup, but before final SSH lockdown.

If fail2ban cannot start, report inactive/unsupported and continue only if SSH recovery remains available. Do not treat fail2ban as a reason to close root/password access.
