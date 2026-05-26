# Memory Detection

Memory classification must use actual usable memory, 即实际可用内存. 不能只读取 `/proc/meminfo`, because NAT and container VPS providers may show host MemTotal such as 4G while the container limit is 256MB.

In the main initialization flow, run the combined probe entry:

```sh
timeout 30 sh /root/server-init/scripts/common/probe.sh
```

The combined probe must print memory fields plus OS fields. The memory fields are:

```text
memtotal_mb=...
cgroup_v2_limit_mb=...
cgroup_v1_limit_mb=...
openvz_limit_mb=...
effective_memory_mb=...
memory_source=...
```

Run `scripts/common/memory.sh` directly only when debugging memory detection in isolation.

Use only `effective_memory_mb` for policy decisions. The value is the minimum valid candidate from:

- `/proc/meminfo` MemTotal
- cgroup v2 `/sys/fs/cgroup/memory.max`
- cgroup v1 `/sys/fs/cgroup/memory/memory.limit_in_bytes`
- OpenVZ `/proc/user_beancounters`

If `effective_memory_mb < 256` and OS is Alpine, ask in Chinese whether to run the low-memory Alpine default flow. Record both the numeric value and `memory_source` in task tracking evidence.
