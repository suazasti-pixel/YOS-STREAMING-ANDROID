# YOS Xtream para LG webOS

Aplicación **YOS 3.3 para LG webOS**, independiente de las apps Android YOS Streaming y YOS Xtream. El televisor LG usa el paquete `.ipk`; no se le instala el APK Android.

## Descargar el instalador

1. En GitHub, abre **Actions** y entra en **Crear app YOS para LG webOS**.
2. Abre la ejecución más reciente que terminó correctamente.
3. En **Artifacts**, descarga **YOS-3.3-LG-webOS-IPK** y extrae el archivo `.ipk`.

## Instalar para pruebas personales

1. En el televisor, abre **Developer Mode** y activa **Dev Mode Status** y **Key Server**. Mantén el TV y el computador en la misma red.
2. En PowerShell, confirma que la CLI de webOS esté instalada: `npm install -g @webos-tools/cli`.
3. Registra el TV siguiendo la guía oficial de la CLI de LG. Usa la IP inalámbrica que muestra el televisor; la dirección cableada puede decir `disconnected` si no conectaste Ethernet.
4. Instala y abre el archivo reemplazando el nombre del dispositivo y la ruta del paquete:

```powershell
ares-install --device NOMBRE_DEL_TV C:\ruta\a\com.yos.streaming.xtreamtv_1.0.0_all.ipk
ares-launch --device NOMBRE_DEL_TV com.yos.streaming.xtreamtv
```

Developer Mode es para desarrollo y pruebas personales; su sesión puede necesitar extensión desde la aplicación Developer Mode del TV.

## Uso y compatibilidad

La interfaz incluye TV en vivo, películas, series, favoritos, guía EPG cuando el proveedor la ofrece, búsqueda y reproducción HTML5. Está adaptada a pantalla grande, Magic Remote, flechas y teclas de canal. El reproductor guarda el progreso de películas y episodios para continuar después, y permite reintentar una transmisión que falla. Usuario y contraseña solo se mantienen durante la sesión y no se guardan en el TV.

Usa únicamente cuentas de proveedores autorizados. La reproducción depende de la disponibilidad del servidor, su soporte de Xtream y de los formatos/códecs compatibles con el modelo y la versión de webOS. No se puede garantizar que una transmisión externa abra o cargue rápido.

Guías oficiales: [Developer Mode para webOS TV](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app), [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-dev-guide) y [servicios JavaScript](https://webostv.developer.lge.com/develop/guides/js-service-usage).
