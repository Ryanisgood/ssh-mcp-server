#!/bin/sh
set -eu

out="/root/server-init-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
paths=""

for p in /etc/ssh /etc/fail2ban /etc/xray /etc/hysteria /etc/iptables/rules.v4; do
  [ -e "$p" ] && paths="$paths $p"
done

if [ -z "$paths" ]; then
  echo "backup=skipped reason=no_paths"
  exit 0
fi

tar -czf "$out" $paths
echo "backup=$out"
