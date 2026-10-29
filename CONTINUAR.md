# Continuar YOS STREAMING

## Repositorio

- GitHub: https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID
- Rama activa: main
- Estado guardado el 2026-10-29: copia local limpia y sincronizada con `origin/main`; último commit `9252882` (`Handle secure credential storage errors`).
- Último cambio funcional: 142c07c — búfer HLS más estable y recuperación automática limitada de errores temporales; builds en web/PWA y Android.
- APK versión 1.7 (versionCode 8) compilada correctamente: https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID/actions/runs/40705240200#artifacts.
- Historial reciente: eliminar la franja promocional, mejorar importación IPTV y guardar la PWA en web/.
- La compilación Android se ejecuta automáticamente en GitHub Actions al subir cambios a main.
- Paquete experimental de LG webOS: webos/appinfo.json, scripts/build-webos.sh y workflow .github/workflows/webos.yml; el APK Android no se instala directamente en webOS. Revisar el artefacto YOS-STREAMING-LG-webOS-IPK en Actions y seguir webos/LEEME-INSTALACION.md. Compatible con las señales que acepte el navegador webOS; listas y streams externos pueden estar sujetos a CORS, geobloqueos y derechos del proveedor.
- Versión de trabajo actual: 1.7. Logo YOS de alta resolución y WhatsApp en el encabezado. Reproductor Android Media3 con cola de 21 canales cercanos, búfer de 20–60 segundos y reproducción tras rebuffer a 3 segundos. Web/PWA usa hls.js con low-latency desactivado, hasta 30 segundos de búfer y hasta 3 intentos de recuperación de red / 2 de medios. Caracol en la lista abre la señal oficial web y no usa el búfer interno. Los enlaces de streaming externos dependen de su proveedor y de la conexión; no se ha certificado la reproducción continua de los 100 canales.
- Para activar la guía, el usuario debe ingresar en Configuración una URL XMLTV proporcionada por su proveedor. La guía se asocia mediante `tvg-id`, `tvg-name` o nombre del canal.
- En Android, los canales se abren en PlayerActivity con botones de reproducción del sistema, cambio CH+/CH- y hasta 21 canales cercanos de la lista actual. En navegador/PWA se conserva el reproductor web.
- La pantalla de inicio prioriza TV en vivo y el reproductor; el banner se quitó, favoritos quedaron plegados y la administración de listas está en el botón LISTAS. La app restaura la última lista abierta, carga automáticamente la lista ligera local en una instalación nueva y ofrece continuar con el último canal.
- El orden inicial de canales respeta el orden del proveedor M3U; desde el selector se puede cambiar a nombre, país o categoría.
- El build local no está instalado en todos los entornos; revisar la última ejecución de GitHub Actions antes de entregar un APK.

## Estructura

- app/: aplicación Android para celular y TV Box.
- xtream/: segunda aplicación Android independiente para servidores autorizados compatibles con Xtream Codes API.
- app/src/main/assets/www/: interfaz web incluida dentro de la aplicación Android.
- web/: versión PWA independiente de la plataforma web.
- app/src/main/java/com/yos/streaming/MainActivity.java: integración Android, incluido el acceso de red para cargar listas.

## Compilar y descargar

1. Abre la pestaña Actions del repositorio.
2. Selecciona la ejecución más reciente de Crear APK YOS Streaming.
3. Cuando termine correctamente, descarga YOS-STREAMING-APK en Artifacts.

También se puede compilar localmente con Java 17 y Gradle 8.7 ejecutando gradle assembleDebug.

El mismo build genera también `xtream/build/outputs/apk/debug/xtream-debug.apk`; en GitHub Actions se descarga como artifact `YOS-XTREAM-APK`.

## Continuidad desde otra cuenta

El repositorio es la copia principal del proyecto. Otra cuenta puede abrir o clonar el repositorio público. Para subir cambios desde esa cuenta, el propietario debe agregarla como colaboradora o transferir el repositorio desde GitHub.

La carpeta web/ conserva la versión PWA separada y la carpeta app/ conserva la versión instalable Android. Al cambiar la interfaz, revisar si el cambio debe aplicarse a ambas.

### Punto actual: instalación en TV LG webOS

- La aplicación para LG es el paquete webOS de `webos/`; el APK de Android no se instala en televisores LG webOS.
- El usuario activó Developer Mode y Key Server en el televisor. En la pantalla, `IP Address (wired): disconnected` solo indica que el cable Ethernet no está conectado; se debe usar la IP que aparece en `IP Address (wireless)` si la TV está por Wi-Fi. La computadora y el televisor deben estar en la misma red.
- En Windows, usar los comandos `.cmd` de webOS CLI para evitar el bloqueo de scripts `.ps1` de PowerShell: `ares-setup-device.cmd`, `ares-novacom.cmd --device myTV --getkey`, `ares-install.cmd --device myTV "RUTA\A\APP.ipk"` y `ares-launch.cmd --device myTV com.yos.streaming.tv`.
- Al ejecutar `ares-novacom.cmd --device myTV --getkey`, escribir la passphrase vigente del Developer Mode en el prompt `Input passphrase:` y pulsar Enter. No se incluye ni se guarda esa clave en este repositorio. Si no avanza, recoger el texto exacto del prompt/error ocultando la passphrase.
- Mantener Developer Mode activo durante la instalación y pruebas. Revisar `webos/LEEME-INSTALACION.md` y el artefacto `YOS-STREAMING-LG-webOS-IPK` de GitHub Actions para obtener el `.ipk`.
- Ajuste de legibilidad para TV en curso: `web/tv.css` aumenta tamaños y espacios cuando se detecta un control remoto (`body.tv-remote`) y marca el foco con un contorno rojo. Solo se carga desde la PWA/webOS, no desde los assets Android.

## Segunda app YOS Xtream

- La app separada vive en `xtream/` y usa el paquete `com.yos.streaming.xtream`, por lo que se instala junto a YOS Streaming.
- Permite conectar a `player_api.php`, explorar categorías de TV en vivo, películas y series, y reproducir con el player nativo Media3.
- Si se marca **Recordar esta cuenta**, servidor, usuario y contraseña se cifran con AES-GCM usando Android Keystore. No se guardan en archivos del proyecto ni en GitHub.
- Proveedores que solo entregan M3U, deshabilitan la API Xtream o usan rutas incompatibles no podrán iniciar sesión en esta app. HTTP no cifra credenciales durante el transporte; la app muestra un aviso y recomienda HTTPS si el proveedor lo ofrece.
- Mejora de interfaz para Android TV/TV Box: `xtream/src/main/assets/www/tv.css` aumenta tamaños de letra, tarjetas y controles. La navegación con flechas usa el foco espacial, enfoca la categoría al cargar y el primer resultado al elegirla; en series enfoca el primer episodio. Los cambios están pendientes de validar en un TV Box real.
- En 1.2.0 se añadió el acceso pegando directamente un enlace completo `get.php`, que extrae `username` y `password` para consultar la API Xtream.
- Rendimiento Xtream 1.3.0 (versionCode 4): caché de categorías por sesión, de las tres últimas categorías de contenido y de seis series; render inicial limitado a 60 tarjetas, portadas con carga diferida y decodificación asíncrona, y compresión gzip para respuestas API si el servidor la admite. Conserva el logotipo YOS y el modo de TV Box.

## Datos IPTV y privacidad

No guardar usuarios, contraseñas ni enlaces privados en el código, en commits, en respaldos públicos ni en capturas. Las cuentas IPTV se agregan desde la interfaz y quedan guardadas localmente en el dispositivo del usuario. Para probarlas se necesita una lista o enlace oficial autorizado del proveedor.

## Listas compactas públicas

- `web/listas_m3u/YOS_Premium_Latino.m3u`: 42 señales combinadas de cine, series, deportes y canales abiertos latinoamericanos.
- `web/listas_m3u/YOS_Premium_Deportes_Cine.m3u`: 39 señales de deportes internacionales, cine y series en español.
- Ambas se pueden agregar desde **Listas recomendadas**; están duplicadas en `app/src/main/assets/www/listas_m3u/` y precargadas por el service worker.
- Son fuentes públicas/gratuitas. Geobloqueos, cambios de URLs y rendimiento dependen del emisor y región; no se certifica disponibilidad continua.




## Verificación de listas públicas (2026-10-28)

- Se sondearon 81 entradas de las dos listas Premium previas. 79 manifiestos respondieron como M3U accesible; 2 fallaron por corresponder a Teledeporte (un mismo enlace duplicado).
- Se generó `web/listas_m3u/YOS_Premium_Verificada.m3u` con 53 URLs únicas accesibles; el catálogo depura repeticiones y excluye Teledeporte, que no respondió durante la prueba.
- La lista está disponible en **Listas recomendadas** y se incluye también en los assets Android y el precache PWA. El sondeo confirma solamente que el manifiesto respondió; no garantiza reproducción continua, geodisponibilidad ni rapidez.


## Lista Colombia y Latinoamérica (2026-10-28)

- Se creó `YOS_Colombia_Latino_Deportes.m3u` con 200 URLs únicas: 60 señales de Colombia, 50 de deportes internacionales, 35 de películas, 30 de series y 25 de animación.
- La selección se basa en catálogos públicos de iptv-org; se excluyeron entradas marcadas como geobloqueadas o no 24/7.
- Está en **Listas recomendadas**, sincronizada entre `web/` y Android, y añadida al precache de ambos service workers. El filtrado no prueba la reproducción individual ni asegura disponibilidad futura.
