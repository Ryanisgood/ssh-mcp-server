#!/bin/sh
set -eu

os_id=unknown
os_family=unknown
pkg_manager=unknown
service_manager=none
firewall=none

if [ -r /etc/os-release ]; then
  os_id="$(sed -n 's/^ID=//p' /etc/os-release | tr -d '"' | head -n 1)"
fi

case "$os_id" in
  debian|ubuntu)
    os_family=debian
    pkg_manager=apt
    ;;
  alpine)
    os_family=alpine
    pkg_manager=apk
    ;;
  *)
    echo "error=unsupported_os:$os_id"
    exit 1
    ;;
esac

if command -v systemctl >/dev/null 2>&1; then
  service_manager=systemd
elif command -v rc-service >/dev/null 2>&1; then
  service_manager=openrc
fi

if command -v ufw >/dev/null 2>&1; then
  firewall=ufw
elif command -v iptables >/dev/null 2>&1; then
  firewall=iptables
fi

printf 'os_id=%s\n' "$os_id"
printf 'os_family=%s\n' "$os_family"
printf 'pkg_manager=%s\n' "$pkg_manager"
printf 'service_manager=%s\n' "$service_manager"
printf 'firewall=%s\n' "$firewall"
