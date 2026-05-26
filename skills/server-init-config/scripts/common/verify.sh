#!/bin/sh
set -eu

echo "whoami=$(whoami)"
echo "uid=$(id -u)"

if command -v sshd >/dev/null 2>&1; then
  sshd -T 2>/dev/null | awk 'tolower($1) ~ /^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication)$/ {print "sshd_"$1"="$2}'
fi
