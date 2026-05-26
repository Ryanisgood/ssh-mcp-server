#!/bin/sh
set -eu

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

service_restart() {
  service_name="$1"
  if command -v systemctl >/dev/null 2>&1; then
    run_with_timeout 60 systemctl restart "$service_name"
  elif command -v rc-service >/dev/null 2>&1; then
    run_with_timeout 60 rc-service "$service_name" restart
  else
    echo "error=no_service_manager"
    return 1
  fi
}

service_enable_now() {
  service_name="$1"
  if command -v systemctl >/dev/null 2>&1; then
    run_with_timeout 60 systemctl enable --now "$service_name"
  elif command -v rc-service >/dev/null 2>&1; then
    run_with_timeout 60 rc-update add "$service_name" default >/dev/null 2>&1 || true
    run_with_timeout 60 rc-service "$service_name" restart || run_with_timeout 60 rc-service "$service_name" start
  else
    echo "error=no_service_manager"
    return 1
  fi
}

ssh_service_name() {
  if [ -r /etc/os-release ] && grep -q '^ID=alpine' /etc/os-release; then
    echo sshd
  elif command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files sshd.service --no-legend 2>/dev/null | grep -q '^sshd.service'; then
    echo sshd
  else
    echo ssh
  fi
}
