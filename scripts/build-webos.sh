#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/build/webos-app"
PACKAGE_DIR="$ROOT_DIR/build/webos-package"

rm -rf "$APP_DIR" "$PACKAGE_DIR"
mkdir -p "$APP_DIR" "$PACKAGE_DIR"
cp -a "$ROOT_DIR/web/." "$APP_DIR/"
cp "$ROOT_DIR/webos/appinfo.json" "$APP_DIR/appinfo.json"
cp "$ROOT_DIR/webos/icon.png" "$APP_DIR/icon.png"
cp "$ROOT_DIR/webos/largeIcon.png" "$APP_DIR/largeIcon.png"

esbuild "$APP_DIR/app.js" --target=chrome68 --outfile="$APP_DIR/app.transpiled.js"
mv "$APP_DIR/app.transpiled.js" "$APP_DIR/app.js"
esbuild "$APP_DIR/pwa.js" --target=chrome68 --outfile="$APP_DIR/pwa.transpiled.js"
mv "$APP_DIR/pwa.transpiled.js" "$APP_DIR/pwa.js"
ares-package -o "$PACKAGE_DIR" "$APP_DIR"
test -n "$(find "$PACKAGE_DIR" -maxdepth 1 -type f -name '*.ipk' -print -quit)"
