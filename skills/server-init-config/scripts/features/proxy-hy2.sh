#!/bin/sh
set -eu

HY2_PORT="${HY2_PORT:-443}"
HY2_INSTALLER_SHA256="${HY2_INSTALLER_SHA256:-}"
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
  echo "hy2_installer_sha256=$actual"
  if [ -n "$expected" ]; then
    [ "$actual" = "$expected" ] || {
      echo "error=hy2_installer_sha256_mismatch expected=$expected actual=$actual"
      exit 1
    }
    return 0
  fi
  [ "$ALLOW_UNVERIFIED_REMOTE_INSTALL" = "1" ] || {
    echo "error=HY2_INSTALLER_SHA256_required set ALLOW_UNVERIFIED_REMOTE_INSTALL=1 to run unverified installer"
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

start_hysteria_service() {
  if command -v systemctl >/dev/null 2>&1; then
    run_with_timeout 60 systemctl enable --now hysteria-server >/dev/null 2>&1 || run_with_timeout 60 systemctl enable --now hysteria >/dev/null 2>&1 || {
      echo "hy2_service=inactive"
      exit 1
    }
  elif command -v rc-service >/dev/null 2>&1; then
    run_with_timeout 60 rc-update add hysteria-server default >/dev/null 2>&1 || run_with_timeout 60 rc-update add hysteria default >/dev/null 2>&1 || true
    run_with_timeout 60 rc-service hysteria-server restart >/dev/null 2>&1 || run_with_timeout 60 rc-service hysteria restart >/dev/null 2>&1 || {
      echo "hy2_service=inactive"
      exit 1
    }
  else
    echo "hy2_service=inactive reason=no_service_manager"
    exit 1
  fi
}

validate_port "$HY2_PORT" hy2_port

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  run_with_timeout 180 apt-get update -qq
  run_with_timeout 180 apt-get install -y -qq curl openssl
else
  run_with_timeout 180 apk add --no-cache curl openssl bash
fi

installer="/tmp/hy2-install.$$"
trap 'rm -f "$installer"' EXIT HUP INT TERM
curl -fsSL --connect-timeout 15 --max-time 120 https://get.hy2.sh/ -o "$installer"
verify_remote_installer "$installer" "$HY2_INSTALLER_SHA256"
run_with_timeout 180 bash "$installer"
mkdir -p /etc/hysteria

password="$(openssl rand -hex 16)"
openssl req -x509 -nodes -newkey rsa:2048 -keyout /etc/hysteria/server.key -out /etc/hysteria/server.crt -subj "/CN=bing.com" -days 3650 >/dev/null 2>&1

backup_file /etc/hysteria/config.yaml
cat >/etc/hysteria/config.yaml <<EOF
listen: :$HY2_PORT

tls:
  cert: /etc/hysteria/server.crt
  key: /etc/hysteria/server.key

auth:
  type: password
  password: $password

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
EOF

start_hysteria_service

echo "hy2=ok port=$HY2_PORT password=$password"
