# BBR

Standard flows default to BBRv3 enabled. Do not ask the user whether to enable BBRv3.

Run `scripts/features/bbr.sh` only in standard flows.

Ordering rule: BBRv3 and network tuning must run before proxy installation. Do not run BBR in the low-memory Alpine default flow.

Support checks:

1. Confirm `sysctl` exists.
2. Write `net.core.default_qdisc=fq`.
3. Write `net.ipv4.tcp_congestion_control=bbr`.
4. If `modprobe` exists, try `modprobe tcp_bbr`.
5. Apply sysctl settings.
6. Check `sysctl -n net.ipv4.tcp_congestion_control`.

If the result is not `bbr`, report kernel/provider unsupported and continue without blocking proxy unless the user explicitly required BBR.
