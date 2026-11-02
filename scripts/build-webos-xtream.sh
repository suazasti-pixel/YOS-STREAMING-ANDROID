#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/build/webos-xtream-app"
SERVICE_DIR="$ROOT_DIR/webos-xtream/service/com.yos.streaming.xtreamtv.service"
PACKAGE_DIR="$ROOT_DIR/build/webos-xtream-package"
WEBOS_JS_VERSION="1.2.13"
WEBOS_JS_ZIP="$ROOT_DIR/build/webOSTVjs-$WEBOS_JS_VERSION.zip"

rm -rf "$APP_DIR" "$PACKAGE_DIR"
mkdir -p "$APP_DIR" "$PACKAGE_DIR" "$ROOT_DIR/build/webostvjs"
cp -a "$ROOT_DIR/xtream/src/main/assets/www/." "$APP_DIR/"
cp "$ROOT_DIR/webos-xtream/appinfo.json" "$APP_DIR/appinfo.json"
cp "$ROOT_DIR/webos/icon.png" "$APP_DIR/icon.png"
cp "$ROOT_DIR/webos/largeIcon.png" "$APP_DIR/largeIcon.png"
cp "$ROOT_DIR/webos-xtream/tv-lg.css" "$APP_DIR/tv-lg.css"
cp "$ROOT_DIR/webos-xtream/webos-bridge.js" "$APP_DIR/webos-bridge.js"

# Optional, local-only preset accounts for a personal TV package. This file is
# gitignored and is intentionally absent from public GitHub Actions builds.
PRIVATE_ACCOUNTS_FILE="$ROOT_DIR/private-yos-xtream-accounts.json"
if [[ -f "$PRIVATE_ACCOUNTS_FILE" ]]; then
  python3 - "$PRIVATE_ACCOUNTS_FILE" "$APP_DIR/accounts.private.js" <<'PY'
from pathlib import Path
import json, sys
accounts = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if not isinstance(accounts, list):
    raise SystemExit("private-yos-xtream-accounts.json debe contener un arreglo JSON")
Path(sys.argv[2]).write_text(
    "window.YOSXtreamPresetAccounts = " + json.dumps(accounts, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
PY
fi

WEBOS_JS="$(find "$ROOT_DIR/build/webostvjs" -type f -name 'webOSTV.js' -print -quit || true)"
if [[ -z "$WEBOS_JS" ]]; then
  curl --fail --location --retry 3 "https://webostv.developer.lge.com/assets/library/webOSTVjs-$WEBOS_JS_VERSION.zip" -o "$WEBOS_JS_ZIP"
  unzip -oq "$WEBOS_JS_ZIP" -d "$ROOT_DIR/build/webostvjs"
  WEBOS_JS="$(find "$ROOT_DIR/build/webostvjs" -type f -name 'webOSTV.js' -print -quit)"
fi
test -n "$WEBOS_JS"
cp "$WEBOS_JS" "$APP_DIR/webOSTV.js"

python3 - "$APP_DIR/index.html" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
html = path.read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="tv.css">', '<link rel="stylesheet" href="tv.css">\n  <link rel="stylesheet" href="tv-lg.css">')
html = html.replace('<p class="fine-print">Las credenciales recordadas se cifran en este dispositivo. Se envían al servidor que escribas al iniciar sesión.</p>', '<p class="fine-print">Los perfiles se guardan en el almacenamiento local de esta app en este TV. No compartas el paquete personal que trae una cuenta preconfigurada.</p>')
private_script = '  <script src="accounts.private.js"></script>\n' if path.with_name('accounts.private.js').exists() else ''
html = html.replace('  <script src="app.js"></script>', '  <script src="webOSTV.js"></script>\n  <script src="webos-bridge.js"></script>\n' + private_script + '  <script src="app.js"></script>')
path.write_text(html, encoding="utf-8")
PY

ares-package -o "$PACKAGE_DIR" "$APP_DIR" "$SERVICE_DIR"
test -n "$(find "$PACKAGE_DIR" -maxdepth 1 -type f -name '*.ipk' -print -quit)"
