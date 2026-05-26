#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/services.sh"

run_with_timeout() {
  seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
    return $?
  fi

  marker="${TMPDIR:-/tmp}/server-init-timeout.$$"
  rm -f "$marker"
  "$@" &
  pid="$!"
  (
    sleep "$seconds"
    if kill "$pid" 2>/dev/null; then
      : > "$marker"
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
  ) &
  watcher="$!"

  set +e
  wait "$pid"
  status="$?"
  set -e
  kill "$watcher" 2>/dev/null || true
  wait "$watcher" 2>/dev/null || true
  if [ -f "$marker" ]; then
    rm -f "$marker"
    echo "error=command_timeout seconds=$seconds command=$1"
    return 124
  fi
  return "$status"
}

if [ -r /etc/os-release ] && grep -Eq '^ID=(debian|ubuntu)' /etc/os-release; then
  export DEBIAN_FRONTEND=noninteractive
  run_with_timeout 300 apt-get update -qq
  run_with_timeout 300 apt-get install -y -qq rsyslog fail2ban
  logpath=/var/log/auth.log
else
  run_with_timeout 300 apk add --no-cache fail2ban || {
    echo "fail2ban=skipped reason=package_unavailable_or_timeout"
    exit 0
  }
  logpath=/var/log/messages
fi

mkdir -p /etc/fail2ban
touch "$logpath" 2>/dev/null || true
ssh_port="${SSH_PORT:-22}"
case "$ssh_port" in
  ''|*[!0-9]*)
    echo "error=invalid_ssh_port:$ssh_port"
    exit 1
    ;;
esac
[ "$ssh_port" -ge 1 ] && [ "$ssh_port" -le 65535 ] || {
  echo "error=invalid_ssh_port:$ssh_port"
  exit 1
}

if [ -f /etc/fail2ban/jail.local ]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  cp /etc/fail2ban/jail.local "/etc/fail2ban/jail.local.server-init.bak.$ts"
fi

cat >/etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = $ssh_port
logpath = $logpath
EOF

service_enable_now fail2ban || {
  echo "fail2ban=inactive"
  exit 0
}

echo "fail2ban=active"
