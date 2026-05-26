# VLESS Reality

Run `scripts/features/proxy-vless-reality.sh` only when VLESS Reality is selected.

Defaults: `VLESS_PORT=443`, `REALITY_SERVER_NAME=www.cloudflare.com`, `REALITY_DEST_PORT=443`.

Ordering rule: run after the selected OS flow and after BBR if BBR is selected. In low-memory Alpine, VLESS Reality is one of the only optional feature scripts allowed after update and required tools.

Selection rule: use `INSTALL_VLESS_REALITY=1` with defaults for VLESS 默认配置, a custom `VLESS_PORT` for VLESS 自定义端口, or custom `VLESS_PORT`, `REALITY_SERVER_NAME`, and `REALITY_DEST_PORT` for VLESS 详细配置.

Supply-chain rule: provide `XRAY_INSTALLER_SHA256` for the Xray installer. Do not run an unverified remote installer. The script must reject missing or mismatched installer hashes.

Pin the installer hash before execution:

1. Download `https://github.com/XTLS/Xray-install/raw/main/install-release.sh` with bounded curl.
2. Compute sha256 locally or on the VPS.
3. Record the hash in task tracking evidence with the source URL and fetch time.
4. Run the feature script with `XRAY_INSTALLER_SHA256=<recorded-sha256>`.

Key parsing rule: parse Xray `x25519` output case-insensitively and fail if either `privateKey` or `publicKey` would be empty. Xray v26 may print `PrivateKey:` and `Password (PublicKey):`; the script must parse those exact labels, not only old `Private key:` / `Public key:` labels.

Config permission rule: the generated Xray config contains Reality private key material. Do not make it world-readable. If the Xray systemd unit runs as a non-root user, set the config to `root:<service-group>` with mode `640`; otherwise use mode `600`.
