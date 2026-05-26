#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/packages.sh"

require_root

alpine_update() {
  apk_update
}

alpine_required_tools() {
  apk_install_proxy_tools
}

alpine_update
alpine_required_tools
echo "flow=alpine-low-memory status=ok next=selected-proxy-only"
