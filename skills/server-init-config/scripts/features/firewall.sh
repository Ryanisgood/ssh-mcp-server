#!/bin/sh
set -eu

# ufw firewall hardening: allow current SSH port and selected proxy port first.
# The selected proxy port is optional when no proxy is installed.

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

validate_port() {
  port="$1"
  label="$2"
  [ -n "$port" ] || return 0
  case "$port" in
    *[!0-9]*)
      echo "error=invalid_${label}:$port"
      exit 1
      ;;
  esac
  [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || {
    echo "error=invalid_${label}:$port"
    exit 1
  }
}

install_ufw_if_possible() {
  if command -v ufw >/dev/null 2>&1; then
    return 0
  fi

  if [ -r /etc/os-release ] && grep -Eq '^ID=(debian|ubuntu)' /etc/os-release; then
    export DEBIAN_FRONTEND=noninteractive
    run_with_timeout 300 apt-get update -qq
    run_with_timeout 300 apt-get install -y -qq ufw
  elif [ -r /etc/os-release ] && grep -q '^ID=alpine' /etc/os-release; then
    run_with_timeout 300 apk add --no-cache ufw || true
  fi
}

allow_port() {
  port="$1"
  comment="$2"
  [ -n "$port" ] || return 0
  run_with_timeout 60 ufw allow "${port}/tcp" comment "$comment" >/dev/null
}

FIREWALL_SSH_PORT="${FIREWALL_SSH_PORT:-}"
FIREWALL_FINAL_SSH_PORT="${FIREWALL_FINAL_SSH_PORT:-}"
PROXY_PORT="${PROXY_PORT:-}"

[ -n "$FIREWALL_SSH_PORT" ] || {
  echo "error=missing_firewall_ssh_port"
  exit 1
}
validate_port "$FIREWALL_SSH_PORT" firewall_ssh_port
validate_port "$FIREWALL_FINAL_SSH_PORT" firewall_final_ssh_port
validate_port "$PROXY_PORT" proxy_port

install_ufw_if_possible

if ! command -v ufw >/dev/null 2>&1; then
  echo "firewall=inactive reason=ufw_unavailable"
  exit 0
fi

run_with_timeout 60 ufw --force reset >/dev/null
run_with_timeout 60 ufw default deny incoming >/dev/null
run_with_timeout 60 ufw default allow outgoing >/dev/null

allow_port "$FIREWALL_SSH_PORT" "allow current SSH port"
allow_port "$FIREWALL_FINAL_SSH_PORT" "allow final SSH port"
allow_port "$PROXY_PORT" "allow selected proxy port"

run_with_timeout 60 ufw --force enable >/dev/null || {
  echo "firewall=inactive reason=ufw_enable_failed"
  exit 0
}

status="$(ufw status 2>/dev/null | head -n 1 || true)"
echo "firewall=active tool=ufw ssh_port=$FIREWALL_SSH_PORT final_ssh_port=${FIREWALL_FINAL_SSH_PORT:-none} proxy_port=${PROXY_PORT:-none} status=$status"
