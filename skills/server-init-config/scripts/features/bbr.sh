#!/bin/sh
set -eu

# BBRv3 best-effort tuning. Kernel support is provider-dependent.
conf="/etc/sysctl.d/99-server-init-bbr.conf"
mkdir -p /etc/sysctl.d
{
  echo "net.core.default_qdisc=fq"
  echo "net.ipv4.tcp_congestion_control=bbr"
} > "$conf"

if command -v modprobe >/dev/null 2>&1; then
  modprobe tcp_bbr >/dev/null 2>&1 || true
fi

if command -v sysctl >/dev/null 2>&1; then
  sysctl -p "$conf" >/dev/null 2>&1 || true
fi

current="$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || true)"
echo "bbr_congestion_control=$current"
