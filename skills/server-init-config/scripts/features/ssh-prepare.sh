#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/services.sh"

NEW_USER="${NEW_USER:-zheng}"
SSH_PORT="${SSH_PORT:-17223}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-212243}"
SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-}"
CHANGE_PASSWORD="${CHANGE_PASSWORD:-0}"

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

set_sshd_ports() {
  old="$1"
  new="$2"
  tmp="${cfg}.server-init.$$"
  write_without_key "$cfg" "$tmp" Port
  printf 'Port %s\n' "$old" >> "$tmp"
  [ "$old" = "$new" ] || printf 'Port %s\n' "$new" >> "$tmp"
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

[ -n "$SSH_PUBLIC_KEY" ] || {
  echo "error=missing_ssh_public_key"
  exit 1
}
validate_port "$SSH_PORT" ssh_port

created_user=0
if ! id "$NEW_USER" >/dev/null 2>&1; then
  if [ -r /etc/os-release ] && grep -q '^ID=alpine' /etc/os-release; then
    adduser -D -s /bin/bash "$NEW_USER"
    addgroup "$NEW_USER" wheel >/dev/null 2>&1 || true
    mkdir -p /etc/sudoers.d
    echo "%wheel ALL=(ALL:ALL) ALL" >/etc/sudoers.d/wheel
  else
    useradd -m -s /bin/bash "$NEW_USER"
    usermod -aG sudo "$NEW_USER"
  fi
  created_user=1
fi

if [ "$created_user" = "1" ] || [ "$CHANGE_PASSWORD" = "1" ]; then
  echo "$NEW_USER:$DEFAULT_PASSWORD" | chpasswd
fi

ssh_dir="/home/$NEW_USER/.ssh"
mkdir -p "$ssh_dir"
touch "$ssh_dir/authorized_keys"
grep -qxF "$SSH_PUBLIC_KEY" "$ssh_dir/authorized_keys" || printf '%s\n' "$SSH_PUBLIC_KEY" >> "$ssh_dir/authorized_keys"
chmod 700 "$ssh_dir"
chmod 600 "$ssh_dir/authorized_keys"
chown -R "$NEW_USER:$NEW_USER" "$ssh_dir"
ssh-keygen -lf "$ssh_dir/authorized_keys" >/dev/null

cfg=/etc/ssh/sshd_config
[ -f "$cfg" ] || {
  echo "error=missing_sshd_config"
  exit 1
}

old_port="$(sshd -T 2>/dev/null | awk 'tolower($1)=="port" {print $2; exit}')"
[ -n "$old_port" ] || old_port=22
validate_port "$old_port" old_ssh_port

set_sshd_ports "$old_port" "$SSH_PORT"

for directive in \
  "PermitRootLogin yes" \
  "PasswordAuthentication yes" \
  "KbdInteractiveAuthentication yes" \
  "PubkeyAuthentication yes"
do
  key="$(printf '%s' "$directive" | awk '{print $1}')"
  value="$(printf '%s' "$directive" | cut -d' ' -f2-)"
  set_sshd_directive "$key" "$value"
done

sshd -t
open_tcp_port "$old_port"
open_tcp_port "$SSH_PORT"
service_restart "$(ssh_service_name)"
echo "ssh_prepare=ok old_port=$old_port new_port=$SSH_PORT root_password_still_enabled=yes"
