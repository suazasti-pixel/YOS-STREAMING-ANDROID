# Instalar YOS STREAMING en un LG con webOS

## Descargar el paquete

1. En GitHub abre **Actions** y entra en **Crear app YOS para LG webOS**.
2. Abre la ejecución más reciente que terminó correctamente.
3. Descarga el artefacto **YOS-STREAMING-LG-webOS-IPK** y extrae el archivo `.ipk`.

## Instalar para uso personal/pruebas

La instalación manual requiere una computadora en la misma red que el televisor y Developer Mode habilitado en el TV. Esta app no es un APK de Android.

1. En el LG Content Store instala y abre **Developer Mode**. Inicia sesión con una cuenta LG Developer, activa Developer Mode y el Key Server.
2. Instala Node.js en la computadora y, en PowerShell o Terminal, instala la herramienta oficial: `npm install -g @webos-tools/cli`.
3. En Developer Mode anota la dirección IP del TV y la clave del Key Server. Configura el TV en webOS CLI siguiendo la guía oficial de LG.
4. Instala el paquete con `ares-install --device NOMBRE_DEL_TV archivo.ipk` y ejecútalo con `ares-launch --device NOMBRE_DEL_TV com.yos.streaming.tv`.

La activación Developer Mode es para desarrollo/pruebas y requiere renovar su sesión cuando el televisor lo indique. La disponibilidad de códecs, reproducción de streams y acceso CORS depende del modelo, versión de webOS y proveedor de cada lista.

Guías oficiales: [Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) y [CLI de webOS TV](https://webostv.developer.lge.com/develop/tools/cli-dev-guide).
