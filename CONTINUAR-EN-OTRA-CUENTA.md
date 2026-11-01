# Continuar los proyectos YOS en otra cuenta

Este archivo resume el estado para retomar el trabajo en otra cuenta de ChatGPT/Codex.

## Repositorio principal

- GitHub: https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID
- Rama: `main`
- Último cambio guardado: `266509f` — YOS Streaming LG 1.1.
- Los fuentes de los proyectos descritos están versionados en este repositorio.

## Versiones actuales

| Proyecto | Versión fuente | Carpeta/código | Cómo obtener el instalador |
| --- | --- | --- | --- |
| YOS Streaming Android | 1.1 | `app/` | GitHub Actions del flujo de Android |
| YOS Xtream Android | 2.14 | `xtream/` | GitHub Actions del flujo de Android |
| YOS Play Android | 1.0.0 | `yosplay/` | GitHub Actions del flujo de Android |
| YOS Streaming LG webOS | 1.1.0 | `web/`, `webos/` | Acción `Crear app YOS para LG webOS`; artefacto `YOS-1.1-LG-Instalador-Windows` |
| YOS Xtream LG webOS | 3.12.0 | `xtream/`, `webos-xtream/` | Acción `Crear app YOS para LG webOS`; artefactos `YOS-3.12-LG-webOS-IPK` y `YOS-3.12-LG-Instalador-Windows` |

Para instalar YOS Streaming LG, extrae el ZIP del artefacto y ejecuta `INSTALAR-YOS-STREAMING-LG.bat`. Para YOS Xtream LG, ejecuta `INSTALAR-YOS-XTREAM-LG.bat`. Ambos requieren Developer Mode/Key Server activo, webOS TV CLI de LG y el TV registrado en el computador.

## Último trabajo

YOS Streaming LG 1.1 usa un diseño para TV con navegación lateral, accesos amplios a TV en vivo/películas/series y estilos adaptados al control Magic. La instalación se hace con un ZIP guiado y un `.bat`. El flujo de compilación está en `.github/workflows/webos.yml`; el empaquetado común está en `scripts/build-webos.sh`.

YOS Xtream LG 3.12 muestra el emblema YOS y el nombre corto en el menú del TV. El flujo produce la versión pública sin cuentas privadas.

## Cuentas y archivos personales

- `private-yos-xtream-accounts.json` se guarda solo en este computador y está excluido de Git. No subir credenciales, listas privadas ni instaladores personales a GitHub.
- Los ZIP/IPK personales construidos localmente pueden estar en `build/` o en `C:\Users\YOS\REVISAR\Downloads`. GitHub Actions crea artefactos públicos sin esos perfiles privados.
- `YOS-Xtream-2.6-Editable/` es una copia local no confirmada; revisar su procedencia y contenido antes de incorporarla al repositorio.

## Para retomar

1. Abre el repositorio anterior o clónalo desde el enlace de GitHub.
2. Lee este archivo y revisa los últimos commits en `main`.
3. Conserva la numeración acordada: YOS Streaming Android `1.x`; YOS Xtream Android para celular/TV Box `2.x`; YOS Xtream LG `3.x`. YOS Streaming LG y YOS Play mantienen su propia serie `1.x`. Incrementa solo la aplicación que haya cambiado.
