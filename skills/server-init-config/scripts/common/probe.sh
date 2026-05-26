#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

require_key() {
  output="$1"
  key="$2"
  if ! printf '%s\n' "$output" | grep -q "^$key"; then
    echo "error=probe_missing_key:$key"
    exit 1
  fi
}

detect_output="$("$script_dir/detect.sh")"
memory_output="$("$script_dir/memory.sh")"

require_key "$detect_output" "os_id="
require_key "$detect_output" "os_family="
require_key "$detect_output" "pkg_manager="
require_key "$detect_output" "service_manager="
require_key "$memory_output" "effective_memory_mb="
require_key "$memory_output" "memory_source="

printf '%s\n' "$detect_output"
printf '%s\n' "$memory_output"
