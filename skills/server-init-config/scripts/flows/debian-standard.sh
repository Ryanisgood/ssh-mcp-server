#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$base_dir/common/packages.sh"

require_root
apt_update
apt_install_required
echo "flow=debian-standard status=ok next=selected-features"
