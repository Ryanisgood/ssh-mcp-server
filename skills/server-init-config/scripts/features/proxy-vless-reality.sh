#!/bin/sh
set -eu

VLESS_PORT="${VLESS_PORT:-443}"
REALITY_SERVER_NAME="${REALITY_SERVER_NAME:-www.cloudflare.com}"
REALITY_DEST_PORT="${REALITY_DEST_PORT:-443}"
XRAY_INSTALLER_SHA256="${XRAY_INSTALLER_SHA256:-}"
ALLOW_UNVERIFIED_REMOTE_INSTALL="${ALLOW_UNVERIFIED_REMOTE_INSTALL:-0}"

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

validate_hostname() {
  host="$1"
  case "$host" in
    ''|*[^A-Za-z0-9.-]*|.*|*.)
      echo "error=invalid_reality_server_name:$host"
      exit 1
      ;;
  esac
  printf '%s\n' "$host" | awk '
    length($0) > 253 { exit 1 }
    {
      n = split($0, labels, ".")
      for (i = 1; i <= n; i++) {
        if (labels[i] == "" || length(labels[i]) > 63 || labels[i] ~ /^-/ || labels[i] ~ /-$/) {
          exit 1
        }
      }
    }
  ' || {
    echo "error=invalid_reality_server_name:$host"
    exit 1
  }
}

require_domain_hostname() {
  host="$1"
  case "$host" in
    *.*)
      ;;
    *)
      echo "error=reality_server_name_must_be_domain:$host"
      exit 1
      ;;
  esac
  case "$host" in
    *[!0-9.]*)
      ;;
    *)
      echo "error=reality_server_name_must_not_be_ip:$host"
      exit 1
      ;;
  esac
}

sha256_file() {
  file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    shasum -a 256 "$file" | awk '{print $1}'
  fi
}

verify_remote_installer() {
  file="$1"
  expected="$2"
  actual="$(sha256_file "$file")"
  echo "xray_installer_sha256=$actual"
  if [ -n "$expected" ]; then
    [ "$actual" = "$expected" ] || {
      echo "error=xray_installer_sha256_mismatch expected=$expected actual=$actual"
      exit 1
    }
    return 0
  fi
  [ "$ALLOW_UNVERIFIED_REMOTE_INSTALL" = "1" ] || {
    echo "error=XRAY_INSTALLER_SHA256_required set ALLOW_UNVERIFIED_REMOTE_INSTALL=1 to run unverified installer"
    exit 1
  }
}

backup_file() {
  file="$1"
  if [ -f "$file" ]; then
    ts="$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$file.server-init.bak.$ts"
  fi
}

start_xray_service() {
  if command -v systemctl >/dev/null 2>&1; then
    run_with_timeout 60 systemctl enable --now xray >/dev/null 2>&1 || run_with_timeout 60 systemctl restart xray >/dev/null 2>&1 || {
      echo "vless_reality_service=inactive"
      exit 1
    }
  elif command -v rc-service >/dev/null 2>&1; then
    run_with_timeout 60 rc-update add xray default >/dev/null 2>&1 || true
    run_with_timeout 60 rc-service xray restart >/dev/null 2>&1 || run_with_timeout 60 rc-service xray start >/dev/null 2>&1 || {
      echo "vless_reality_service=inactive"
      exit 1
    }
  else
    echo "vless_reality_service=inactive reason=no_service_manager"
    exit 1
  fi
}

validate_port "$VLESS_PORT" vless_port
validate_port "$REALITY_DEST_PORT" reality_dest_port
validate_hostname "$REALITY_SERVER_NAME"
require_domain_hostname "$REALITY_SERVER_NAME"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  run_with_timeout 180 apt-get update -qq
  run_with_timeout 180 apt-get install -y -qq curl openssl
else
  run_with_timeout 180 apk add --no-cache curl openssl bash
fi

installer="/tmp/xray-install-release.$$"
trap 'rm -f "$installer"' EXIT HUP INT TERM
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/XTLS/Xray-install/raw/main/install-release.sh -o "$installer"
verify_remote_installer "$installer" "$XRAY_INSTALLER_SHA256"
run_with_timeout 180 bash "$installer" install
mkdir -p /usr/local/etc/xray

uuid="$(cat /proc/sys/kernel/random/uuid)"
private_key="$(xray x25519 2>/dev/null | awk -F': ' '/Private key/ {print $2}')"
public_key="$(xray x25519 -i "$private_key" 2>/dev/null | awk -F': ' '/Public key/ {print $2}')"
short_id="$(openssl rand -hex 8)"

backup_file /usr/local/etc/xray/config.json
cat >/usr/local/etc/xray/config.json <<EOF
{
  "log": { "loglevel": "warning" },
  "inbounds": [{
    "port": $VLESS_PORT,
    "protocol": "vless",
    "settings": {
      "clients": [{ "id": "$uuid", "flow": "xtls-rprx-vision" }],
      "decryption": "none"
    },
    "streamSettings": {
      "network": "tcp",
      "security": "reality",
      "realitySettings": {
        "show": false,
        "dest": "$REALITY_SERVER_NAME:$REALITY_DEST_PORT",
        "xver": 0,
        "serverNames": ["$REALITY_SERVER_NAME"],
        "privateKey": "$private_key",
        "shortIds": ["$short_id"]
      }
    }
  }],
  "outbounds": [{ "protocol": "freedom" }]
}
EOF

start_xray_service

echo "vless_reality=ok port=$VLESS_PORT uuid=$uuid publicKey=$public_key shortId=$short_id serverName=$REALITY_SERVER_NAME destPort=$REALITY_DEST_PORT"
