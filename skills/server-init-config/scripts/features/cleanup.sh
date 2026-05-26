#!/bin/sh
set -eu

target="${SERVER_INIT_REMOTE_DIR:-/root/server-init}"
case "$target" in
  /root/server-init|/tmp/server-init)
    rm -rf "$target"
    echo "cleanup_removed=server-init"
    echo "cleanup=ok target=$target"
    ;;
  *)
    echo "error=refusing_cleanup_target:$target"
    exit 1
    ;;
esac
