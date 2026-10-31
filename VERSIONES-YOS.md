# Versiones principales de YOS

Estas son las tres ediciones principales que vamos a mantener y actualizar por separado:

| Edición | Dispositivo | Instalador en GitHub Actions | Proyecto |
|---|---|---|---|
| **1.1** | Celular Android | `YOS-1.1-CELULAR-APK` | YOS Streaming, listas M3U |
| **2.10** | Celular Android y Android TV Box | `YOS-2.10-XTREAM-ANDROID-APK` | YOS Xtream Android |
| **3.3** | Televisor LG webOS | `YOS-3.3-LG-webOS-IPK` | YOS Xtream para webOS |

## Regla de numeración

Cada edición avanza por separado: celular **1.1 → 1.2 → 1.3**, Xtream Android **2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 2.9 → 2.10 → 2.11** y LG webOS **3.1 → 3.2 → 3.3**. Cuando un cambio afecte varias ediciones, incrementaremos la serie de cada una de ellas. Así cada instalador y sus notas de cambios indicarán qué versión recibió la mejora.

## YOS Xtream LG 3.3 — reanudar y recuperar reproducción

- Guarda el progreso de películas y episodios durante la reproducción para que «Visto recientemente» permita continuar en el televisor.
- Al abrir un elemento con progreso, el reproductor webOS busca continuar desde esa posición; el control «Reintentar» permite volver a intentar una señal que falló.
- Actualiza el historial sin mover el foco del Magic Remote mientras el reproductor está abierto.
- Implementado sobre la base YOS; no utiliza los servidores del APK externo que se revisó.

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

## YOS Xtream 2.5 — series, control remoto y protección parental

- Selector de temporada en series. Cada episodio muestra su avance local o marca **Visto** al alcanzar al menos el 90% de reproducción.
- En TV Box, las flechas se mueven primero dentro de la lista o panel que tiene el foco, reduciendo saltos a controles lejanos. CH+/CH− siguen pasando por los elementos de la lista y por la cola del reproductor.
- Menú en el reproductor para elegir pistas de audio y subtítulos si la señal las incluye.
- Control parental local con PIN de 4 a 8 dígitos. Oculta categorías cuyos nombres indiquen contenido adulto, y permite desbloquearlas solo durante la sesión. La detección depende del nombre asignado por el proveedor.
- La guía muestra la hora de inicio de los programas si el proveedor incluye ese dato.
- Android `versionCode 10`, `versionName 2.5`. Artifact de Actions: `YOS-2.5-XTREAM-ANDROID-APK`.

## YOS Xtream 2.6 — navegación clara para TV Box

- Atrás desde el catálogo lleva el foco a la pestaña actual sin cerrar la sesión. Desde ahí se puede ir con las flechas a Películas, Series o Favoritos; Atrás otra vez sale de la app.
- Al volver del reproductor se recupera el foco de la tarjeta que se estaba reproduciendo, y el botón del reproductor indica **CATÁLOGO**.
- En TV Box, la barra de secciones permanece visible al desplazarse. El modo de control remoto también se activa al detectar flechas en equipos que no informan correctamente el perfil Android TV.
- Atrás en el reproductor vuelve al catálogo; CH+/CH− y los botones de página/anterior/siguiente conservan el cambio de canal.
- Android `versionCode 11`, `versionName 2.6`. Artifact de Actions: `YOS-2.6-XTREAM-ANDROID-APK`.

## YOS Xtream 2.7 — deportes, guía y diagnóstico

- Nueva vista **Deportes** que reúne canales de las categorías deportivas reconocibles del proveedor; se puede filtrar a una categoría deportiva o buscar dentro del conjunto. Cada categoría carga con concurrencia limitada y aprovecha la caché existente.
- La guía solicita hasta ocho entradas de programación, muestra horarios siguientes cuando el proveedor los ofrece y mantiene el canal reproducible si no hay datos EPG.
- Botón de búsqueda por voz en Android con idioma español de Colombia cuando el dispositivo tenga un servicio de reconocimiento de voz.
- Diagnóstico de conexión comprueba autenticación y tiempo de respuesta de categorías, e indica HTTP/HTTPS. No mide ni promete la disponibilidad de cada stream.
- El reproductor permite seleccionar calidad/resolución si la señal ofrece más de una pista de video; conserva selección de audio y subtítulos.
- Android `versionCode 12`, `versionName 2.7`. Artifact de Actions: `YOS-2.7-XTREAM-ANDROID-APK`.

## YOS Xtream 2.8 — carga más ágil de canales y catálogo

- Se cancelan solicitudes de catálogo que quedaron obsoletas al cambiar de sección, categoría, búsqueda o favoritos; así dejan de ocupar los tres espacios de red usados por la app.
- Se mantienen en caché hasta cinco categorías recientes con un límite aproximado de 18.000 elementos, para volver a verlas sin pedirlas otra vez al proveedor.
- El catálogo crea sus tarjetas en un fragmento y las inserta en un solo paso. Las carátulas siguen cargándose de forma diferida y ahora se marcan como de baja prioridad.
- Android `versionCode 13`, `versionName 2.8`. Artifact de Actions: `YOS-2.8-XTREAM-ANDROID-APK`.

## YOS Xtream 2.9 — búsqueda compatible con proveedores sin categorías

- Si el proveedor devuelve HTTP 404 al solicitar las categorías de una sección, la app intenta cargar el catálogo completo de esa sección. Si funciona, reconstruye las categorías con los datos recibidos y filtra en el dispositivo.
- La búsqueda por texto y voz consulta el catálogo local de respaldo; también permite volver a una categoría sin repetir la solicitud de red.
- El respaldo queda en memoria solo para la sesión/cuenta actual y se borra al cerrar sesión o cambiar de cuenta. Si el proveedor rechaza tanto las categorías como el catálogo completo, el mensaje muestra ambos errores.
- Android `versionCode 14`, `versionName 2.9`. Artifact de Actions: `YOS-2.9-XTREAM-ANDROID-APK`.

## YOS Xtream 2.10 — compatibilidad de respaldo M3U

- Si una consulta de API Xtream devuelve HTTP 404, la app intenta descargar una URL `get.php` M3U y organiza los elementos por `group-title` para TV en vivo, películas y series.
- Búsqueda por texto/voz, categorías, favoritos locales y reproducción usan los enlaces directos de la lista. La ficha, EPG, temporadas y vencimiento dependen de API Xtream y no están disponibles en modo M3U.
- El enlace M3U recordado se conserva dentro del almacenamiento cifrado Android. No se guardan los enlaces directos de reproducción en favoritos o historial.
- Android `versionCode 15`, `versionName 2.10`. Artifact de Actions: `YOS-2.10-XTREAM-ANDROID-APK`.
