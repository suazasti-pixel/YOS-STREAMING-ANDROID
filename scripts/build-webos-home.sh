#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/build/webos-home-app"
PACKAGE_DIR="$ROOT_DIR/build/webos-home-package"
WEBOS_JS_VERSION="1.2.13"
WEBOS_JS_ZIP="$ROOT_DIR/build/webOSTVjs-$WEBOS_JS_VERSION.zip"

rm -rf "$APP_DIR" "$PACKAGE_DIR"
mkdir -p "$APP_DIR" "$PACKAGE_DIR" "$ROOT_DIR/build/webostvjs"
cp "$ROOT_DIR/webos-home/appinfo.json" "$ROOT_DIR/webos-home/index.html" \
  "$ROOT_DIR/webos-home/home.css" "$ROOT_DIR/webos-home/home.js" "$APP_DIR/"
cp "$ROOT_DIR/webos/icon.png" "$APP_DIR/icon.png"
cp "$ROOT_DIR/webos/largeIcon.png" "$APP_DIR/largeIcon.png"

WEBOS_JS="$(find "$ROOT_DIR/build/webostvjs" -type f -name 'webOSTV.js' -print -quit || true)"
if [[ -z "$WEBOS_JS" ]]; then
  curl --fail --location --retry 3 "https://webostv.developer.lge.com/assets/library/webOSTVjs-$WEBOS_JS_VERSION.zip" -o "$WEBOS_JS_ZIP"
  unzip -oq "$WEBOS_JS_ZIP" -d "$ROOT_DIR/build/webostvjs"
  WEBOS_JS="$(find "$ROOT_DIR/build/webostvjs" -type f -name 'webOSTV.js' -print -quit)"
fi
test -n "$WEBOS_JS"
cp "$WEBOS_JS" "$APP_DIR/webOSTV.js"
ares-package -o "$PACKAGE_DIR" "$APP_DIR"
test -n "$(find "$PACKAGE_DIR" -maxdepth 1 -type f -name 'com.yos.launcher.home_*.ipk' -print -quit)"

