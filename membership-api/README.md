# YOS Membership API 0.2.0

Servicio de cuentas YOS separado de los datos Xtream del proveedor. La API guarda contraseñas como hash scrypt, entrega sesiones revocables y calcula la vigencia en PostgreSQL. Los días de una cuenta nueva empiezan con el primer acceso correcto. No guarda contraseñas Xtream ni procesa pagos.

## Requisitos y arranque local

- Node.js 20 o superior y PostgreSQL.
- Crear una base de datos y ejecutar `schema.sql`.
- Copiar `.env.example` a `.env` y completar `DATABASE_URL` y `YOS_ADMIN_KEY` con secretos propios. No subir `.env` al repositorio.
- Ejecutar `npm install` y `npm start` dentro de esta carpeta.
- Antes de publicar, poner la API detrás de HTTPS, proteger PostgreSQL y limitar el acceso administrativo a un entorno controlado.

## Despliegue preparado para Render

El archivo `../render.yaml` declara el servicio Node.js y PostgreSQL, genera `YOS_ADMIN_KEY`, aplica el esquema al iniciar y revisa `/health`. En Render, crea un Blueprint desde el repositorio `YOS-STREAMING-ANDROID` y revisa los planes antes de confirmar. La configuración usa un servicio web `starter` y PostgreSQL `0.1c-256mb`; los planes pagados mínimos suman alrededor de US$13/mes según el precio publicado al preparar esta configuración. Los servicios quedan en Ohio, en la misma región, para usar la conexión privada de la base de datos.

Después del despliegue:

1. Abre `https://<nombre-del-servicio>.onrender.com/admin/` e ingresa la clave `YOS_ADMIN_KEY` visible en el panel de variables del servicio.
2. Crea una cuenta. La contraseña debe tener al menos 12 caracteres; el plan comienza al primer ingreso correcto.
3. Comparte `https://<nombre-del-servicio>.onrender.com/client/` con el usuario final para que inicie sesión y consulte su vigencia.
4. Mantén la clave administrativa en privado y no la incluyas en APK, IPK ni navegador.

El portal web quedará conectado al servicio al desplegar. El APK YOS-Xuper todavía necesitará una integración nativa posterior para mostrar esa misma pantalla de acceso y bloquear reproducción al vencer; publicar este backend por sí solo no cambia el APK.

## Vista cliente

`client/index.html` contiene un prototipo adaptable a celular y TV, conectado al contrato de esta API cuando `client/config.js` recibe la URL HTTPS. Sin esa URL, **VER VISTA DE EJEMPLO** enseña la pantalla con información ficticia; no autentica ni guarda credenciales. Ábrelo en Chrome para revisar la propuesta visual. Al integrar en Android y webOS se reutilizará el diseño respetando la navegación y formularios Xtream existentes.

## Rutas

- `POST /v1/auth/login` — `{ "username", "password", "deviceId?" }` (acepta `email` para compatibilidad); activa el plan por primera vez y devuelve un token, `account.accessAllowed`, `account.expiresAt` y aviso calculado por el servidor. La API registra accesos correctos, fallidos, suspendidos y vencidos sin guardar la contraseña.
- `GET /v1/me` — `Authorization: Bearer <token>`; consulta la vigencia actual al servidor.
- `POST /v1/renewals` — sesión Bearer y `{ "days": 30 }`; crea una solicitud pendiente, no concede acceso.
- `POST /v1/auth/logout` — revoca la sesión actual.
- `POST /v1/admin/users` — cabecera `X-YOS-Admin-Key`; crea una cuenta con usuario, contraseña y duración (30 días por defecto). La vigencia empieza al iniciar sesión por primera vez.
- `GET /v1/admin/users` — lista cuentas, vigencia, último acceso y sesiones activas.
- `PATCH /v1/admin/users/:id` — cambia usuario, correo, clave, estado o vigencia. Cambiar usuario/clave o suspender revoca las sesiones existentes. `days` extiende el plan; `expiresAt` fija la fecha de vencimiento.
- `GET /v1/admin/events?limit=100` — auditoría de actividad con fecha, cuenta, evento, dispositivo e IP.
- `GET /v1/admin/renewals?status=pending` — lista solicitudes pendientes (o `confirmed`/`rejected`) para administración.
- `POST /v1/admin/renewals/:id/confirm` — cabecera `X-YOS-Admin-Key`; úsala solo después de verificar el pago. Es idempotente y suma días desde la fecha de vencimiento o desde ahora, la que sea posterior.
- `POST /v1/admin/renewals/:id/reject` — cabecera `X-YOS-Admin-Key`; cierra una solicitud pendiente sin cambiar la vigencia.
- `GET /health` — comprobación de conectividad con la base de datos.

El panel administrativo está en `admin/index.html`; sirve esa carpeta bajo HTTPS y usa la clave del servidor desde el formulario. Las solicitudes de renovación quedan pendientes hasta confirmación manual; no hay pasarela de pago. Las cuentas Xtream siguen siendo independientes. El APK YOS-Xuper 1.5 todavía no consulta esta API: se necesita publicar el backend con una URL HTTPS y luego enlazar la app para que el control de suscripción sea real. Define `ALLOWED_ORIGINS` para las apps web. Para bloquear al vencer también durante la reproducción, el cliente debe consultar `/v1/me`; un backend no puede anular enlaces Xtream usados fuera de YOS.

## Seguridad operativa

Use HTTPS, secretos diferentes por entorno, copias de seguridad y acceso restringido a PostgreSQL. Rote `YOS_ADMIN_KEY`; no coloque esa llave maestra dentro de Android, webOS ni el navegador. Las credenciales de los usuarios YOS nunca se reutilizan para el servidor IPTV.
