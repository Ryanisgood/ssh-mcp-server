# Alpine Standard Flow

Use when OS is Alpine and `effective_memory_mb >= 256`.

Run `scripts/flows/alpine-standard.sh` first. It handles Alpine update and required tools through `apk` and OpenRC-compatible helpers.

After that baseline completes, run only selected feature scripts.

Normal Alpine ordering:

1. Run `scripts/flows/alpine-standard.sh` first.
2. update and required tools.
3. optional backup.
4. optional SSH prepare.
5. optional fail2ban after support checks.
6. optional BBR after support checks.
7. optional firewall after current SSH, final SSH, and selected proxy ports are known.
8. selected proxy.
9. verify, MCP handoff, optional SSH lockdown, cleanup.

Fail2ban support checks:

1. Install the fail2ban package with `apk`.
2. Use the detected service manager to start it.
3. If install or service start fails, report fail2ban inactive/unsupported.
4. Continue only if the SSH recovery path remains valid.

BBR support checks:

1. Confirm `sysctl` exists.
2. Write `net.core.default_qdisc=fq`.
3. Write `net.ipv4.tcp_congestion_control=bbr`.
4. If `modprobe` exists, try `modprobe tcp_bbr`.
5. Apply sysctl settings.
6. Check `sysctl -n net.ipv4.tcp_congestion_control`.
7. If the result is not `bbr`, report kernel/provider unsupported and continue without blocking proxy unless the user explicitly required BBR.

Do not use apt, ufw assumptions, or systemd-only service commands in this flow.
Firewall hardening must allow required ports before enabling deny rules and must tolerate Alpine hosts without persistent firewall tooling.
