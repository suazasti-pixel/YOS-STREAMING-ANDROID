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
cp "$ROOT_DIR/webos/yos-tv-home.css" "$APP_DIR/yos-tv-home.css"

python3 - "$APP_DIR/index.html" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
html = path.read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="tv.css?v=1">', '<link rel="stylesheet" href="tv.css?v=1">\n<link rel="stylesheet" href="yos-tv-home.css?v=1">')
panel = '''<section class="tv-featured" aria-label="Explora YOS Streaming">
  <div class="tv-featured-copy"><span class="tv-featured-kicker">YOS STREAMING</span><h1>Tu entretenimiento.<br><em>A tu manera.</em></h1><p>Explora tus listas en una interfaz diseñada para el televisor.</p></div>
  <div class="tv-featured-actions" aria-label="Secciones">
    <button class="tv-section-card" type="button" data-tab="live"><span>▶</span><b>TV EN VIVO</b><small>Canales y favoritos</small></button>
    <button class="tv-section-card" type="button" data-tab="movie"><span>▣</span><b>PELÍCULAS</b><small>Explora tu catálogo</small></button>
    <button class="tv-section-card" type="button" data-tab="series"><span>▤</span><b>SERIES</b><small>Temporadas y episodios</small></button>
  </div>
</section>\n'''
html = html.replace('<main id="inicio">', '<main id="inicio">\n' + panel)
if 'class="tv-featured"' not in html or 'yos-tv-home.css' not in html:
    raise SystemExit("No se pudo integrar el panel de TV en index.html")
path.write_text(html, encoding="utf-8")
PY

esbuild "$APP_DIR/app.js" --target=chrome68 --outfile="$APP_DIR/app.transpiled.js"
mv "$APP_DIR/app.transpiled.js" "$APP_DIR/app.js"
esbuild "$APP_DIR/pwa.js" --target=chrome68 --outfile="$APP_DIR/pwa.transpiled.js"
mv "$APP_DIR/pwa.transpiled.js" "$APP_DIR/pwa.js"
ares-package -o "$PACKAGE_DIR" "$APP_DIR"
test -n "$(find "$PACKAGE_DIR" -maxdepth 1 -type f -name '*.ipk' -print -quit)"
