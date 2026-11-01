# YOS Xtream para LG webOS

Aplicación **YOS Xtream LG 3.10.0 para LG webOS**, independiente de las apps Android YOS Streaming y YOS Xtream. El televisor LG usa el paquete `.ipk`; no se le instala el APK Android. Esta versión agrega perfiles de cuenta que se pueden seleccionar, guardar, editar o borrar en el televisor.

## Descargar el instalador

1. En GitHub, abre **Actions** y entra en **Crear app YOS para LG webOS**.
2. Abre la ejecución más reciente que terminó correctamente.
3. En **Artifacts**, descarga **YOS-3.10-LG-Instalador-Windows** si quieres el instalador guiado. Extrae el ZIP completo y ejecuta `INSTALAR-YOS-XTREAM-LG.bat`.
4. También puedes descargar **YOS-3.10-LG-webOS-IPK** si solo necesitas el paquete `.ipk` para instalarlo manualmente.

## Instalar para pruebas personales

1. En el televisor, abre **Developer Mode** y activa **Dev Mode Status** y **Key Server**. Mantén el TV y el computador en la misma red.
2. Instala la CLI de webOS y registra el televisor una vez siguiendo la guía oficial enlazada abajo.
3. Para la instalación guiada, ejecuta `INSTALAR-YOS-XTREAM-LG.bat` desde el ZIP extraído y escribe el alias del TV. El instalador instala o actualiza la app y la abre.
4. Para la instalación manual, usa la IP inalámbrica que muestra el televisor (la dirección cableada puede decir `disconnected` si no conectaste Ethernet) y estos comandos:

```powershell
ares-install --device NOMBRE_DEL_TV C:\ruta\a\com.yos.streaming.xtreamtv_1.0.0_all.ipk
ares-launch --device NOMBRE_DEL_TV com.yos.streaming.xtreamtv
```

Developer Mode es para desarrollo y pruebas personales; su sesión puede necesitar extensión desde la aplicación Developer Mode del TV.

## Uso y compatibilidad

La interfaz incluye TV en vivo, películas, series, favoritos, guía EPG cuando el proveedor la ofrece, búsqueda y reproducción HTML5. Está adaptada a pantalla grande, Magic Remote, flechas y teclas de canal. El reproductor guarda el progreso de películas y episodios para continuar después, y permite reintentar una transmisión que falla. Si la API Xtream autorizada no ofrece el catálogo, puede usar el enlace M3U `get.php` como alternativa. Las listas se descargan temporalmente por el servicio webOS, con límite de 10 MB y sin registrar el enlace; usuario y contraseña solo se mantienen durante la sesión y no se guardan en el TV.

Usa únicamente cuentas de proveedores autorizados. Los perfiles se guardan en el almacenamiento local de la app en ese TV; ese almacenamiento no cifra las contraseñas. No compartas una compilación personal que tenga credenciales preconfiguradas: el IPK puede inspeccionarse. La reproducción depende de la disponibilidad del servidor, su soporte de Xtream y de los formatos/códecs compatibles con el modelo y la versión de webOS. No se puede garantizar que una transmisión externa abra o cargue rápido.

Guías oficiales: [Developer Mode para webOS TV](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app), [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-dev-guide) y [servicios JavaScript](https://webostv.developer.lge.com/develop/guides/js-service-usage).
