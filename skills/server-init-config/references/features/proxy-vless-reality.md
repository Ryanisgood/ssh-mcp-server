# VLESS Reality

Run `scripts/features/proxy-vless-reality.sh` only when VLESS Reality is selected.

Defaults: `VLESS_PORT=443`, `REALITY_SERVER_NAME=www.cloudflare.com`, `REALITY_DEST_PORT=443`.

Ordering rule: run after the selected OS flow and after BBR if BBR is selected. In low-memory Alpine, VLESS Reality is one of the only optional feature scripts allowed after update and required tools.

Selection rule: use `INSTALL_VLESS_REALITY=1` with defaults for VLESS 默认配置, a custom `VLESS_PORT` for VLESS 自定义端口, or custom `VLESS_PORT`, `REALITY_SERVER_NAME`, and `REALITY_DEST_PORT` for VLESS 详细配置.
