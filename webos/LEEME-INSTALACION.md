# Instalar YOS STREAMING en un LG con webOS

## Descargar el paquete

1. En GitHub abre **Actions** y entra en **Crear app YOS para LG webOS**.
2. Abre la ejecución más reciente que terminó correctamente.
3. Descarga el artefacto **YOS-1.8-LG-Instalador-Windows** para instalarla con doble clic. Si prefieres, el artefacto **YOS-1.8-LG-webOS-IPK** contiene solo el paquete `.ipk`.

## IPTV-org y carga inicial

La versión 1.8 usa IPTV-org Mundial como única lista preinstalada y la abre al iniciar; quita la lista de 100 canales predefinida y mantiene las listas personales que ya tengas guardadas. **IPTV-org Mundial** (`https://iptv-org.github.io/iptv/index.m3u`) es la lista inicial visible en **TV en vivo**. El catálogo mundial está empaquetado dentro del IPK como instantánea de IPTV-org descargada el 3 de noviembre de 2026; ábrelo desde **Listas** cuando quieras. La playlist integrada se procesa localmente en bloques para mantener la interfaz ágil. La caché conserva hasta dos listas recientes durante cinco minutos. La lista incluida no se actualiza sola con el sitio: usa **ACTUALIZAR** cuando quieras intentar descargar una versión nueva. La reproducción depende de Internet, la disponibilidad de cada señal y los formatos aceptados por el TV.

## Instalar con el paquete guiado

1. Extrae el ZIP completo.
2. En el TV activa Developer Mode y Key Server; el computador y el televisor deben estar en la misma red.
3. Instala la webOS TV CLI oficial de LG y registra el TV una vez con `ares-setup-device`.
4. Ejecuta `INSTALAR-YOS-STREAMING-LG.bat`, escribe el alias del TV y espera a que YOS Streaming se abra.

## Instalar manualmente

La instalación manual requiere una computadora en la misma red que el televisor y Developer Mode habilitado en el TV. Esta app no es un APK de Android.

1. En el LG Content Store instala y abre **Developer Mode**. Inicia sesión con una cuenta LG Developer, activa Developer Mode y el Key Server.
2. Instala Node.js en la computadora y, en PowerShell o Terminal, instala la herramienta oficial: `npm install -g @webos-tools/cli`.
3. En Developer Mode anota la dirección IP del TV y la clave del Key Server. Configura el TV en webOS CLI siguiendo la guía oficial de LG.
4. Instala el paquete con `ares-install --device NOMBRE_DEL_TV archivo.ipk` y ejecútalo con `ares-launch --device NOMBRE_DEL_TV com.yos.streaming.tv`.

La activación Developer Mode es para desarrollo/pruebas y requiere renovar su sesión cuando el televisor lo indique. La disponibilidad de códecs, reproducción de streams y acceso CORS depende del modelo, versión de webOS y proveedor de cada lista.

Guías oficiales: [Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) y [CLI de webOS TV](https://webostv.developer.lge.com/develop/tools/cli-dev-guide).
