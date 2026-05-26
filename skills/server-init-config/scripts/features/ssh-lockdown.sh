#!/bin/sh
set -eu

[ "${FINALIZE_SSH_LOCKDOWN:-0}" = "1" ] || {
  echo "error=FINALIZE_SSH_LOCKDOWN_required"
  exit 1
}

LOCKDOWN_CONFIRMED_USER="${LOCKDOWN_CONFIRMED_USER:-zheng}"
[ "$(id -u)" -eq 0 ] || {
  echo "error=ssh_lockdown_must_run_as_root"
  exit 1
}
[ "${SUDO_USER:-}" = "$LOCKDOWN_CONFIRMED_USER" ] || {
  echo "error=ssh_lockdown_must_run_via_sudo_from_$LOCKDOWN_CONFIRMED_USER"
  exit 1
}

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/services.sh"

SSH_PORT="${SSH_PORT:-17223}"

validate_port() {
  port="$1"
  label="$2"
  case "$port" in
    ''|*[!0-9]*)
      echo "error=invalid_${label}:$port"
      exit 1
      ;;
  esac
  [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || {
    echo "error=invalid_${label}:$port"
    exit 1
  }
}

write_without_key() {
  src="$1"
  dst="$2"
  key="$3"
  awk -v key="$key" 'tolower($1) != tolower(key) { print }' "$src" > "$dst"
}

set_sshd_directive() {
  key="$1"
  value="$2"
  tmp="${cfg}.server-init.$$"
  write_without_key "$cfg" "$tmp" "$key"
  printf '%s %s\n' "$key" "$value" >> "$tmp"
  cat "$tmp" > "$cfg"
  rm -f "$tmp"
}

set_sshd_port() {
  port="$1"
  tmp="${cfg}.server-init.$$"
  write_without_key "$cfg" "$tmp" Port
  printf 'Port %s\n' "$port" >> "$tmp"
  cat "$tmp" > "$cfg"
  rm -f "$tmp"
}

open_tcp_port() {
  port="$1"
  if command -v ufw >/dev/null 2>&1; then
    ufw allow "${port}/tcp" >/dev/null 2>&1 || true
  elif command -v iptables >/dev/null 2>&1; then
    iptables -C INPUT -p tcp --dport "$port" -j ACCEPT >/dev/null 2>&1 || \
      iptables -I INPUT -p tcp --dport "$port" -j ACCEPT >/dev/null 2>&1 || true
  fi
}

cfg=/etc/ssh/sshd_config
[ -f "$cfg" ] || {
  echo "error=missing_sshd_config"
  exit 1
}
validate_port "$SSH_PORT" ssh_port

set_sshd_port "$SSH_PORT"

for directive in \
  "PermitRootLogin no" \
  "PasswordAuthentication no" \
  "KbdInteractiveAuthentication no" \
  "PubkeyAuthentication yes"
do
  key="$(printf '%s' "$directive" | awk '{print $1}')"
  value="$(printf '%s' "$directive" | cut -d' ' -f2-)"
  set_sshd_directive "$key" "$value"
done

sshd -t
open_tcp_port "$SSH_PORT"
service_restart "$(ssh_service_name)"
echo "ssh_lockdown=ok port=$SSH_PORT"
