# YOS Membership API 0.1.0

Base técnica de cuentas YOS separada de los datos Xtream del proveedor. La API guarda las contraseñas como hash scrypt, entrega sesiones opacas revocables y calcula la vigencia en PostgreSQL en cada consulta. No guarda contraseñas Xtream ni procesa pagos.

## Requisitos y arranque local

- Node.js 20 o superior y PostgreSQL.
- Crear una base de datos y ejecutar `schema.sql`.
- Copiar `.env.example` a `.env` y completar `DATABASE_URL` y `YOS_ADMIN_KEY` con secretos propios. No subir `.env` al repositorio.
- Ejecutar `npm install` y `npm start` dentro de esta carpeta.
- Antes de publicar, poner la API detrás de HTTPS, proteger PostgreSQL y limitar el acceso administrativo a un entorno controlado.

## Vista cliente

`client/index.html` contiene un prototipo adaptable a celular y TV, conectado al contrato de esta API cuando `client/config.js` recibe la URL HTTPS. Sin esa URL, **VER VISTA DE EJEMPLO** enseña la pantalla con información ficticia; no autentica ni guarda credenciales. Ábrelo en Chrome para revisar la propuesta visual. Al integrar en Android y webOS se reutilizará el diseño respetando la navegación y formularios Xtream existentes.

## Rutas

- `POST /v1/auth/login` — `{ "email", "password" }`; devuelve un token, `account.accessAllowed`, `account.expiresAt` y aviso calculado por el servidor (`expiryNotice`: `upcoming` hasta 7 días, `soon` hasta 3, `urgent` hasta 1). Un usuario vencido aún puede consultar su estado y pedir renovación.
- `GET /v1/me` — `Authorization: Bearer <token>`; consulta la vigencia actual al servidor.
- `POST /v1/renewals` — sesión Bearer y `{ "days": 30 }`; crea una solicitud pendiente, no concede acceso.
- `POST /v1/auth/logout` — revoca la sesión actual.
- `POST /v1/admin/users` — cabecera `X-YOS-Admin-Key`; crea cuenta y plan por días.
- `GET /v1/admin/renewals?status=pending` — lista solicitudes pendientes (o `confirmed`/`rejected`) para administración.
- `POST /v1/admin/renewals/:id/confirm` — cabecera `X-YOS-Admin-Key`; úsala solo después de verificar el pago. Es idempotente y suma días desde la fecha de vencimiento o desde ahora, la que sea posterior.
- `POST /v1/admin/renewals/:id/reject` — cabecera `X-YOS-Admin-Key`; cierra una solicitud pendiente sin cambiar la vigencia.
- `GET /health` — comprobación de conectividad con la base de datos.

Las solicitudes de renovación quedan pendientes hasta la confirmación manual; aquí no hay pasarela de pago. Las cuentas Xtream siguen siendo independientes: el proveedor controla su propia fecha, conexiones y disponibilidad. La app cliente aún no está conectada a esta API porque no hay un dominio HTTPS de producción configurado; no debe mostrarse al usuario una vigencia local inventada. Define `ALLOWED_ORIGINS` con los orígenes exactos de las apps web que se conecten. Para hacer cumplir la membresía también al reproducir, cada cliente tendrá que consultar `/v1/me` y bloquear reproducción al expirar; un backend de membresía no puede anular por sí solo enlaces Xtream usados fuera de YOS.

## Seguridad operativa

Use HTTPS, secretos diferentes por entorno, copias de seguridad y acceso restringido a PostgreSQL. Rote `YOS_ADMIN_KEY`; no coloque esa llave maestra dentro de Android, webOS ni el navegador. Las credenciales de los usuarios YOS nunca se reutilizan para el servidor IPTV.
