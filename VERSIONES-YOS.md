# Versiones principales de YOS

Estas son las tres ediciones principales que vamos a mantener y actualizar por separado:

| Edición | Dispositivo | Instalador en GitHub Actions | Proyecto |
|---|---|---|---|
| **1.1** | Celular Android | `YOS-1.1-CELULAR-APK` | YOS Streaming, listas M3U |
| **2.19** | Celular Android y Android TV Box | `YOS-2.19-XTREAM-ANDROID-APK` | YOS Xtream Android |
| **3.16** | Televisor LG webOS | `YOS-3.16-LG-webOS-IPK` | YOS Xtream para webOS, controles grandes para Magic Remote en TV de 65 pulgadas |
| **3.15** | Televisor LG webOS | `YOS-3.15-LG-webOS-IPK` | YOS Xtream para webOS |

## Regla de numeración

Cada edición avanza por separado: celular **1.1 → 1.2 → 1.3**, Xtream Android **2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 2.9 → 2.10 → 2.11 → 2.12 → 2.13 → 2.14 → 2.15 → 2.16 → 2.17 → 2.18 → 2.19 → 2.20 → 2.21** y LG webOS **3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8 → 3.9 → 3.10 → 3.11 → 3.12 → 3.13 → 3.14 → 3.15 → 3.16**. Cuando un cambio afecte varias ediciones, incrementaremos la serie de cada una de ellas. Así cada instalador y sus notas de cambios indicarán qué versión recibió la mejora.

## YOS Xtream LG 3.16 — controles grandes para Magic Remote

- Se ampliaron controles, filtros, búsqueda y foco para televisión LG de pantalla grande y navegación desde el sofá.
- Se conservan el paquete webOS `.ipk` y el instalador guiado para Windows.
- Artefactos: `YOS-3.16-LG-webOS-IPK` y `YOS-3.16-LG-Instalador-Windows`.

## YOS Xtream Android 2.19 — celular y TV Box

- Separa la interfaz táctil compacta de celular del modo de control remoto de Android TV/TV Box; tener perfiles de cuenta guardados ya no agranda la interfaz del teléfono.
- Detecta Android TV por Leanback, modo televisión o ausencia de pantalla táctil.
- Mantiene navegación con flechas, OK y CH en TV Box, sin activar el diseño remoto en celulares por usar teclado o controles externos.
- Android `versionCode 24`, `versionName 2.19`. Artefacto: `YOS-2.19-XTREAM-ANDROID-APK`.

## YOS Xtream Android 2.18 — ocultar subtítulos al cambiar pista

- Al escoger Audio o Calidad de video se apaga la pista de subtítulos activa; al abrir Subtítulos se pueden elegir de nuevo, incluido Ninguno.
- Android `versionCode 23`, `versionName 2.18`. Artefacto: `YOS-2.18-XTREAM-ANDROID-APK`.

## YOS Xtream Android 2.17 y LG 3.15 — búsqueda por número de canal

- La búsqueda de TV en vivo acepta el número que entrega el proveedor (`num`, `channel_number`, `number` o `lcn`); si no existe, usa la posición del canal dentro de su categoría. También muestra el número junto a la categoría.
- La búsqueda por texto conserva la búsqueda global progresiva: pinta coincidencias mientras revisa categorías y limita las consultas simultáneas. La carga de secciones y categorías continúa separada, con páginas y caché existentes.
- Android `versionCode 22`, `versionName 2.17`. Artefacto: `YOS-2.17-XTREAM-ANDROID-APK`. LG `version 3.15.0`. Artefactos: `YOS-3.15-LG-webOS-IPK` y `YOS-3.15-LG-Instalador-Windows`.

## YOS Xtream Android 2.16 y LG 3.14 — acceso directo a Buscar

- Se añadió junto al campo una acción grande **BUSCAR CANALES**; al seleccionarla con Magic Remote, el foco pasa al buscador y la sección activa determina si se buscan canales, películas, series o favoritos.
- El botón cambia su texto según la sección abierta y conserva la búsqueda por texto existente; Favoritos sigue a un solo clic en la cabecera.
- Android `versionCode 21`, `versionName 2.16`. Artefacto: `YOS-2.16-XTREAM-ANDROID-APK`. LG `version 3.14.0`. Artefactos: `YOS-3.14-LG-webOS-IPK` y `YOS-3.14-LG-Instalador-Windows`.

## YOS Xtream Android 2.15 y LG 3.13 — icono, búsqueda y canales a mano

- El paquete webOS lleva iconos YOS regenerados desde el logo de alta resolución para que se distingan mejor en el menú del televisor.
- La búsqueda usa una lupa SVG nítida y una etiqueta más clara; Favoritos tiene un botón destacado junto al buscador, además de conservar su pestaña y las estrellas por contenido.
- Al volver a TV en vivo, películas o series, la app restaura la última categoría usada. Si ya está en caché, muestra sus primeros 36 resultados sin volver a descargarla.
- La búsqueda de todo el catálogo va mostrando coincidencias mientras revisa categorías; las llamadas siguen limitadas a dos simultáneas para cuidar la compatibilidad con proveedores.
- Android `versionCode 20`, `versionName 2.15`. Artefacto: `YOS-2.15-XTREAM-ANDROID-APK`. LG `version 3.13.0`. Artefactos: `YOS-3.13-LG-webOS-IPK` y `YOS-3.13-LG-Instalador-Windows`.

## YOS Xtream Android 2.14 y LG 3.12 — salida y reapertura del reproductor

- La app ya no envía toda una categoría al reproductor. Mantiene una cola de hasta 51 elementos alrededor del canal seleccionado para evitar pasar miles de filas y URLs en un Intent.
- Android evita abrir reproductores duplicados mientras se inicia uno y restablece la navegación/foco al regresar incluso si el reproductor se cierra sin datos de progreso.
- Se conserva el cambio de canal dentro de la ventana de la cola; la cola completa vuelve a generarse al abrir otro canal.
- Android `versionCode 19`, `versionName 2.14`. Artefacto: `YOS-2.14-XTREAM-ANDROID-APK`. LG `version 3.12.0`. Artefacto: `YOS-3.12-LG-webOS-IPK`.

## YOS Xtream Android 2.13 y LG 3.6 — categorías más rápidas

- Se recuerda localmente la última categoría usada por proveedor (solo sección e identificador; no se almacenan enlaces de reproducción ni contraseñas) y se precarga como máximo una categoría en tiempo inactivo tras iniciar sesión.
- El catálogo muestra 36 elementos primero y añade grupos conforme se desplaza; los controles remotos conservan el botón **Cargar más**.
- Las tarjetas nuevas se anexan al catálogo sin reconstruir las anteriores; carátulas siguen en carga diferida y baja prioridad.
- Al cargar una categoría se informa el tiempo de respuesta del servidor para ayudar a distinguir demoras del proveedor.
- Android `versionCode 18`, `versionName 2.13`. Artefacto: `YOS-2.13-XTREAM-ANDROID-APK`. LG `version 3.6.0`. Artefacto: `YOS-3.6-LG-webOS-IPK`.

## YOS Xtream Android 2.12 y LG 3.5 — inicio renovado

- Inicio ahora es una portada propia con el logo YOS, accesos a TV, deportes, películas, series y favoritos, más el panel «Visto recientemente».
- Tras iniciar sesión no descarga automáticamente las categorías de TV en vivo. El catálogo se consulta cuando se elige una sección; esto evita trabajo de red innecesario y acelera la entrada.
- El logo superior regresa a Inicio; al tocar la búsqueda desde Inicio se abre la última sección consultada para que los resultados aparezcan en su contexto.
- Android `versionCode 17`, `versionName 2.12`. Artefacto: `YOS-2.12-XTREAM-ANDROID-APK`. LG `version 3.5.0`. Artefacto: `YOS-3.5-LG-webOS-IPK`.

## YOS Home LG 1.0 — panel de accesos para webOS

- Pantalla independiente con atajos a YOS Streaming y YOS Xtream.
- Permite añadir y quitar accesos por ID de aplicaciones webOS; se guardan localmente en el TV.
- Tarjetas grandes y foco visible para el control Magic.
- Es un panel dentro de una app: webOS no permite reemplazar el launcher del sistema ni cambiar la acción del botón Home.
- Artefactos de Actions: `YOS-Home-1.0-LG-webOS-IPK` y `YOS-Home-1.0-LG-Instalador-Windows`.

## YOS Xtream 2.11 y YOS Xtream LG 3.4 — M3U también en webOS

- La edición LG ahora puede descargar listas M3U autorizadas mediante un servicio nativo webOS; el texto se entrega en fragmentos temporales para evitar respuestas Luna demasiado grandes.
- La descarga tiene límite de 10 MB, vence de la memoria temporal en dos minutos y solo permite redirecciones al mismo host; nunca escribe la URL con credenciales en los registros.
- Se corrige el argumento de «recordar cuenta» entre la interfaz compartida y el puente LG.
- Android y LG comparten el flujo de respaldo M3U, búsqueda y filtros; las opciones de Xtream API que no están en M3U siguen dependiendo del proveedor.
- Android `versionCode 16`, `versionName 2.11`. Artefacto: `YOS-2.11-XTREAM-ANDROID-APK`. LG `version 3.4.0`. Artefacto: `YOS-3.4-LG-webOS-IPK`.

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

## YOS Streaming LG 1.2 — IPTV-org Mundial y catálogo ágil

- Se preinstala en las fuentes guardadas el enlace IPTV-org Mundial (`index.m3u`) para abrirlo desde **Listas**; la lista ligera local de 100 canales sigue siendo el inicio rápido.
- El análisis M3U se procesa en bloques y actualiza el estado mientras trabaja, manteniendo responsiva la interfaz del televisor. La caché usa la política HTTP del servidor y conserva hasta dos listas recientes durante cinco minutos.
- El instalador Windows fija el IPK de YOS 1.2.0 para no escoger por error otro paquete `.ipk` de la carpeta Descargas.
- Artifact: `YOS-1.2-LG-Instalador-Windows` o `YOS-1.2-LG-webOS-IPK`.

## YOS Streaming LG 1.3 — interfaz ampliada y lista inicial garantizada

- Amplía textos, controles, tarjetas y paneles para verlos desde el sofá en LG webOS.
- Una migración única añade las fuentes predefinidas y abre la selección ligera de 100 canales, preservando las demás listas y favoritos.
- El paquete webOS incluye la M3U ligera como recurso local embebido, evitando fallos de carga por origen `file://`.
- Artifact: `YOS-1.3-LG-Instalador-Windows` o `YOS-1.3-LG-webOS-IPK`.


## YOS Streaming LG 1.4 — IPTV-org Mundial integrada

- Incluye dentro del paquete una instantánea local del M3U completo de IPTV-org (11.399 entradas, descargado el 3 de noviembre de 2026).
- La lista mundial queda preinstalada en **Listas** y se puede abrir sin volver a descargar el M3U. La reproducción de cada emisión sigue requiriendo Internet y depende del estado del canal.
- Conserva como inicio rápido la selección ligera YOS de 100 canales; así la app no necesita analizar el catálogo mundial para mostrar canales al abrir.
- Actualiza el identificador de caché y usa una migración de fuentes de 1.4 para preservar listas existentes, agregar las predefinidas y abrir la lista ligera una vez.
- Artifact: `YOS-1.4-LG-Instalador-Windows` o `YOS-1.4-LG-webOS-IPK`.


## YOS Streaming LG 1.5 — interfaz legible a distancia

- Aumenta nuevamente tamaño de navegación, filtros, controles, opciones de listas, tarjetas y canales para uso desde el sofá.
- Fuerza el perfil de TV en el paquete webOS y carga su hoja de estilos al final para que el tamaño no dependa del User-Agent ni del orden de estilos base.
- Mantiene la instantánea IPTV-org integrada y la lista ligera de 100 canales como inicio rápido.
- Artifact: `YOS-1.5-LG-Instalador-Windows` o `YOS-1.5-LG-webOS-IPK`.


## YOS Streaming LG 1.6 — optimizada para LG 65″ 2020

- Amplía otro nivel la escala del logo, las secciones, filtros, botones, tarjetas de canales y controles de listas para lectura a distancia en televisor grande.
- Mantiene el modo TV aplicado directamente al paquete webOS, la lista completa IPTV-org integrada y el inicio rápido con la selección ligera de 100 canales.
- Artifact: `YOS-1.6-LG-Instalador-Windows` o `YOS-1.6-LG-webOS-IPK`.


## YOS Streaming LG 1.7 — lista mundial visible y control Magic

- La lista IPTV-org Mundial se muestra primero en **Listas** y queda como lista activa al actualizar; se conserva YOS 100 como alternativa ligera.
- La lista mundial se sirve desde el M3U integrado en el IPK y no necesita una descarga inicial desde Internet.
- Corrige el foco del control remoto dentro de diálogos: las flechas recorren controles visibles del diálogo, con indicador de foco persistente; las flechas arriba/abajo recorren canales.
- El paquete webOS activa el perfil TV y enfoca **TV en vivo** al iniciar.
- Artifact: `YOS-1.7-LG-Instalador-Windows` o `YOS-1.7-LG-webOS-IPK`.


## YOS Streaming LG 1.8 — IPTV-org como única lista inicial

- Integra la instantánea de `https://iptv-org.github.io/iptv/index.m3u` en el paquete webOS y la abre al iniciar; no requiere descargar el M3U por red.
- Elimina YOS 100 como lista predeterminada. Las listas personales guardadas se conservan.
- Sustituye la barra lateral fija por una barra superior horizontal; el contenido reserva su espacio y evita superposiciones.
- Mantiene la navegación del Magic Remote con foco visible y las flechas entre controles.
- Artifact: `YOS-1.8-LG-Instalador-Windows` o `YOS-1.8-LG-webOS-IPK`.
