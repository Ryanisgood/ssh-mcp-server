#!/bin/sh
set -eu

require_root() {
  [ "$(id -u)" -eq 0 ] || {
    echo "error=run_as_root"
    exit 1
  }
}

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

apt_update() {
  export DEBIAN_FRONTEND=noninteractive
  run_with_timeout 300 apt-get update -qq
  if [ "${APT_RUN_UPGRADE:-0}" = "1" ]; then
    run_with_timeout 600 apt-get \
      -o Dpkg::Options::=--force-confdef \
      -o Dpkg::Options::=--force-confold \
      upgrade -y -qq || true
  fi
}

apt_install_required() {
  export DEBIAN_FRONTEND=noninteractive
  run_with_timeout 300 apt-get install -y -qq curl wget git htop tmux net-tools dnsutils jq unzip rsync ca-certificates gnupg sudo openssh-client openssh-server iptables ufw
}

apk_update() {
  run_with_timeout 300 apk update
  run_with_timeout 600 apk upgrade --no-cache || true
}

apk_install_required() {
  run_with_timeout 300 apk add --no-cache curl wget git htop tmux bind-tools jq unzip rsync ca-certificates sudo openssh-client openssh-server iptables ip6tables shadow bash tar gzip
}

apk_install_proxy_tools() {
  run_with_timeout 300 apk add --no-cache curl openssl bash ca-certificates
}
