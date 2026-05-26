# HY2

Run `scripts/features/proxy-hy2.sh` only when HY2 is selected.

Default: `HY2_PORT=443`.

Ordering rule: run after the selected OS flow and after BBR if BBR is selected. In low-memory Alpine, HY2 is one of the only optional feature scripts allowed after update and required tools.

Selection rule: use `INSTALL_HY2=1` with either the default port or the user-provided `HY2_PORT`.
