# Continuar YOS STREAMING

## Repositorio

- GitHub: https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID
- Rama activa: main
- Último cambio funcional: 7075498 — al agregar una lista M3U, el nombre es opcional y la carga inicia automáticamente.
- APK #20 compilada correctamente: https://github.com/suazasti-pixel/YOS-STREAMING-ANDROID/actions/runs/40447664230#artifacts.
- Historial reciente: eliminar la franja promocional, mejorar importación IPTV y guardar la PWA en web/.
- La compilación Android se ejecuta automáticamente en GitHub Actions al subir cambios a main.
- Versión de trabajo actual: 1.1. Reproductor Android nativo Media3, guía XMLTV opcional y carga progresiva de canales en la app Android.
- Para activar la guía, el usuario debe ingresar en Configuración una URL XMLTV proporcionada por su proveedor. La guía se asocia mediante `tvg-id`, `tvg-name` o nombre del canal.
- En Android, los canales se abren en PlayerActivity con botones de reproducción del sistema, cambio CH+/CH- y hasta 101 canales cercanos de la lista actual. En navegador/PWA se conserva el reproductor web.
- La pantalla de inicio ahora prioriza TV en vivo y el reproductor; la marca y administración quedan más abajo, sin quitar controles para listas. La app restaura la última lista abierta, carga automáticamente la lista ligera local en una instalación nueva y ofrece continuar con el último canal.
- El orden inicial de canales respeta el orden del proveedor M3U; desde el selector se puede cambiar a nombre, país o categoría.
- El build local no está instalado en todos los entornos; revisar la última ejecución de GitHub Actions antes de entregar un APK.

## Estructura

- app/: aplicación Android para celular y TV Box.
- app/src/main/assets/www/: interfaz web incluida dentro de la aplicación Android.
- web/: versión PWA independiente de la plataforma web.
- app/src/main/java/com/yos/streaming/MainActivity.java: integración Android, incluido el acceso de red para cargar listas.

## Compilar y descargar

1. Abre la pestaña Actions del repositorio.
2. Selecciona la ejecución más reciente de Crear APK YOS Streaming.
3. Cuando termine correctamente, descarga YOS-STREAMING-APK en Artifacts.

También se puede compilar localmente con Java 17 y Gradle 8.7 ejecutando gradle assembleDebug.

## Continuidad desde otra cuenta

El repositorio es la copia principal del proyecto. Otra cuenta puede abrir o clonar el repositorio público. Para subir cambios desde esa cuenta, el propietario debe agregarla como colaboradora o transferir el repositorio desde GitHub.

La carpeta web/ conserva la versión PWA separada y la carpeta app/ conserva la versión instalable Android. Al cambiar la interfaz, revisar si el cambio debe aplicarse a ambas.

## Datos IPTV y privacidad

No guardar usuarios, contraseñas ni enlaces privados en el código, en commits, en respaldos públicos ni en capturas. Las cuentas IPTV se agregan desde la interfaz y quedan guardadas localmente en el dispositivo del usuario. Para probarlas se necesita una lista o enlace oficial autorizado del proveedor.
