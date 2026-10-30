# Versiones principales de YOS

Estas son las tres ediciones principales que vamos a mantener y actualizar por separado:

| Edición | Dispositivo | Instalador en GitHub Actions | Proyecto |
|---|---|---|---|
| **1.1** | Celular Android | `YOS-1.1-CELULAR-APK` | YOS Streaming, listas M3U |
| **2.4** | Celular Android y Android TV Box | `YOS-2.4-XTREAM-ANDROID-APK` | YOS Xtream Android |
| **3.2** | Televisor LG webOS | `YOS-3.2-LG-webOS-IPK` | YOS Xtream para webOS |

## Regla de numeración

Cada edición avanza por separado: celular **1.1 → 1.2 → 1.3**, Xtream Android **2.1 → 2.2 → 2.3 → 2.4** y LG webOS **3.1 → 3.2 → 3.3**. Cuando un cambio afecte varias ediciones, incrementaremos la serie de cada una de ellas. Así cada instalador y sus notas de cambios indicarán qué versión recibió la mejora.

YOS Play sigue siendo un proyecto Android adicional y no forma parte de esta lista de tres instaladores.

## Cómo descargar

Abre la ejecución más reciente que terminó correctamente en [GitHub Actions](https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID/actions). Descarga el artefacto con el nombre de la edición correspondiente y extrae el APK o IPK del ZIP.

## YOS Xtream 2.4 — celular y TV Box

- Nuevo panel de accesos a TV en vivo, películas, series y favoritos; se conserva el logotipo YOS.
- Búsqueda global del tipo de contenido elegido. Recorre categorías con dos solicitudes simultáneas, muestra el avance y tolera categorías que fallen.
- Historial local separado por cuenta para retomar películas y episodios desde la posición guardada; no persiste las URL con credenciales.
- Ficha de película con sinopsis y metadatos de `get_vod_info` cuando el proveedor los ofrece. Si la consulta falla, sigue disponible el botón para reproducir.
- Accesos e historial se adaptan a pantallas táctiles y aumentan de tamaño cuando Android detecta TV Box.
- Android `versionCode 9`, `versionName 2.4`. Artifact de Actions: `YOS-2.4-XTREAM-ANDROID-APK`.
