#!/bin/sh
set -eu

memtotal_mb=""
cgroup_v2_limit_mb=""
cgroup_v1_limit_mb=""
openvz_limit_mb=""
effective_memory_mb=""
memory_source=""

is_valid_limit() {
  value="$1"
  [ -n "$value" ] || return 1
  case "$value" in *[!0-9]*) return 1 ;; esac
  [ "$value" -gt 0 ] || return 1
  [ "$value" -lt 9000000000000000000 ] || return 1
}

consider() {
  value="$1"
  source="$2"
  is_valid_limit "$value" || return 0
  if [ -z "$effective_memory_mb" ] || [ "$value" -lt "$effective_memory_mb" ]; then
    effective_memory_mb="$value"
    memory_source="$source"
  fi
}

if [ -r /proc/meminfo ]; then
  memtotal_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
  consider "$memtotal_mb" meminfo
fi

if [ -r /sys/fs/cgroup/memory.max ]; then
  raw="$(cat /sys/fs/cgroup/memory.max)"
  if is_valid_limit "$raw"; then
    cgroup_v2_limit_mb=$((raw / 1024 / 1024))
    consider "$cgroup_v2_limit_mb" cgroup_v2
  fi
fi

if [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  raw="$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)"
  if is_valid_limit "$raw"; then
    cgroup_v1_limit_mb=$((raw / 1024 / 1024))
    consider "$cgroup_v1_limit_mb" cgroup_v1
  fi
fi

if [ -r /proc/user_beancounters ]; then
  openvz_limit_mb="$(awk '$1 == "privvmpages" && $5 ~ /^[0-9]+$/ {print int($5 * 4 / 1024)}' /proc/user_beancounters | head -n 1)"
  consider "$openvz_limit_mb" openvz
fi

[ -n "$effective_memory_mb" ] || effective_memory_mb=0
[ -n "$memory_source" ] || memory_source=unknown

printf 'memtotal_mb=%s\n' "$memtotal_mb"
printf 'cgroup_v2_limit_mb=%s\n' "$cgroup_v2_limit_mb"
printf 'cgroup_v1_limit_mb=%s\n' "$cgroup_v1_limit_mb"
printf 'openvz_limit_mb=%s\n' "$openvz_limit_mb"
printf 'effective_memory_mb=%s\n' "$effective_memory_mb"
printf 'memory_source=%s\n' "$memory_source"
