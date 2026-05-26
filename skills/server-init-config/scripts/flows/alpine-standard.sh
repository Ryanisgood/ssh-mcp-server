#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/packages.sh"

require_root
apk_update
apk_install_required
echo "flow=alpine-standard status=ok next=selected-features"
