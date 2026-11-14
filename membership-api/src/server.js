import "dotenv/config";
import http from "node:http";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;
const port = Number(process.env.PORT || 8787);
const sessionHours = Math.min(168, Math.max(1, Number(process.env.SESSION_HOURS || 24)));
const attemptsLimit = Math.max(3, Number(process.env.LOGIN_ATTEMPTS_PER_15_MIN || 10));
const allowedOrigins = new Set(String(process.env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined });
const loginAttempts = new Map();

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
  res.end(JSON.stringify(body));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-headers", "Authorization, Content-Type, X-YOS-Admin-Key");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  return true;
}

async function readBody(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16_384) throw Object.assign(new Error("Solicitud demasiado grande."), { status: 413 });
  }
  try { return text ? JSON.parse(text) : {}; }
  catch { throw Object.assign(new Error("JSON inválido."), { status: 400 }); }
}

const sha256 = value => createHash("sha256").update(value).digest("hex");
const normalizeEmail = value => String(value || "").trim().toLowerCase();
const authToken = req => /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1] || "";
const isAdmin = req => Boolean(process.env.YOS_ADMIN_KEY) && timingSafeEqual(Buffer.from(sha256(req.headers["x-yos-admin-key"] || "")), Buffer.from(sha256(process.env.YOS_ADMIN_KEY)));

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function checkPassword(password, encoded) {
  const [algorithm, n, r, p, saltText, hashText] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function enforceLoginRateLimit(req) {
  const key = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  if (loginAttempts.size > 10_000) {
    for (const [ip, attempt] of loginAttempts) if (now - attempt.startedAt > 15 * 60_000) loginAttempts.delete(ip);
  }
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt > 15 * 60_000) loginAttempts.set(key, { startedAt: now, count: 1 });
  else if (++entry.count > attemptsLimit) throw Object.assign(new Error("Demasiados intentos. Espera 15 minutos."), { status: 429 });
}

async function currentUser(req) {
  const token = authToken(req);
  if (!token || token.length > 256) return null;
  const result = await pool.query(`SELECT u.id, u.email, u.status AS user_status,
      s.plan_name, s.starts_at, s.expires_at,
      (u.status = 'active' AND s.expires_at > now()) AS access_allowed,
      CASE WHEN s.expires_at IS NULL THEN NULL ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.expires_at - now())) / 86400))::integer END AS days_remaining
    FROM yos_sessions x
    JOIN yos_users u ON u.id = x.user_id
    LEFT JOIN yos_subscriptions s ON s.user_id = u.id
    WHERE x.token_hash = $1 AND x.revoked_at IS NULL AND x.expires_at > now()`, [sha256(token)]);
  return result.rows[0] || null;
}

const toAccount = row => {
  const daysRemaining = row.days_remaining == null ? null : Number(row.days_remaining);
  return {
    email: row.email,
    status: row.user_status,
    plan: row.plan_name || null,
    startsAt: row.starts_at || null,
    expiresAt: row.expires_at || null,
    accessAllowed: Boolean(row.access_allowed),
    daysRemaining,
    expiryNotice: daysRemaining == null || daysRemaining > 7 ? null : daysRemaining <= 1 ? "urgent" : daysRemaining <= 3 ? "soon" : "upcoming"
  };
};

async function route(req, res) {
  if (!applyCors(req, res)) return json(res, 403, { error: "Origen no permitido." });
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    await pool.query("SELECT 1");
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/v1/auth/login") {
    enforceLoginRateLimit(req);
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!email || password.length < 1 || password.length > 1024) return json(res, 400, { error: "Ingresa correo y contraseña." });
    const result = await pool.query(`SELECT u.id, u.email, u.password_hash, u.status AS user_status,
        s.plan_name, s.starts_at, s.expires_at,
        (u.status = 'active' AND s.expires_at > now()) AS access_allowed,
        CASE WHEN s.expires_at IS NULL THEN NULL ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.expires_at - now())) / 86400))::integer END AS days_remaining
      FROM yos_users u LEFT JOIN yos_subscriptions s ON s.user_id = u.id WHERE u.email = $1`, [email]);
    const row = result.rows[0];
    if (!row || !(await checkPassword(password, row.password_hash))) return json(res, 401, { error: "Correo o contraseña incorrectos." });
    if (row.user_status !== "active") return json(res, 403, { error: "Cuenta suspendida. Contacta al administrador." });
    const token = randomBytes(32).toString("base64url");
    await pool.query("INSERT INTO yos_sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 hour'))", [sha256(token), row.id, sessionHours]);
    return json(res, 200, { token, account: toAccount(row), sessionExpiresIn: sessionHours * 3600 });
  }

  if (req.method === "GET" && url.pathname === "/v1/me") {
    const user = await currentUser(req);
    if (!user) return json(res, 401, { error: "Sesión vencida. Inicia sesión nuevamente." });
    return json(res, 200, { account: toAccount(user) });
  }

  if (req.method === "POST" && url.pathname === "/v1/renewals") {
    const user = await currentUser(req);
    if (!user) return json(res, 401, { error: "Inicia sesión para solicitar renovación." });
    const body = await readBody(req);
    const days = Number(body.days || 30);
    if (!Number.isInteger(days) || days < 1 || days > 366) return json(res, 400, { error: "La duración debe ser de 1 a 366 días." });
    const created = await pool.query(`INSERT INTO yos_renewal_requests(user_id, requested_days) VALUES ($1, $2)
      ON CONFLICT (user_id) WHERE status = 'pending' DO NOTHING RETURNING id, status, created_at`, [user.id, days]);
    if (!created.rowCount) {
      const pending = await pool.query("SELECT id, status, created_at FROM yos_renewal_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1", [user.id]);
      return json(res, 200, { requestId: pending.rows[0]?.id, status: "pending", message: "Ya existe una solicitud pendiente." });
    }
    return json(res, 201, { requestId: created.rows[0].id, status: created.rows[0].status, createdAt: created.rows[0].created_at, message: "Solicitud creada. El acceso se habilita cuando el administrador confirme el pago." });
  }

  if (req.method === "POST" && url.pathname === "/v1/auth/logout") {
    const token = authToken(req);
    if (token) await pool.query("UPDATE yos_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [sha256(token)]);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/v1/admin/users") {
    if (!isAdmin(req)) return json(res, 401, { error: "No autorizado." });
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const days = Number(body.days || 30);
    const plan = String(body.plan || "YOS Streaming").slice(0, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 1024 || !Number.isInteger(days) || days < 1 || days > 366) {
      return json(res, 400, { error: "Correo válido, contraseña de al menos 12 caracteres y duración de 1 a 366 días requeridos." });
    }
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query("INSERT INTO yos_users(email, password_hash) VALUES ($1, $2) RETURNING id, email", [email, passwordHash]);
      const subscription = await client.query("INSERT INTO yos_subscriptions(user_id, plan_name, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 day')) RETURNING expires_at", [user.rows[0].id, plan, days]);
      await client.query("COMMIT");
      return json(res, 201, { user: user.rows[0], plan, expiresAt: subscription.rows[0].expires_at });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") return json(res, 409, { error: "Ya existe una cuenta con ese correo." });
      throw error;
    } finally { client.release(); }
  }

  if (req.method === "GET" && url.pathname === "/v1/admin/renewals") {
    if (!isAdmin(req)) return json(res, 401, { error: "No autorizado." });
    const status = url.searchParams.get("status") || "pending";
    if (!["pending", "confirmed", "rejected"].includes(status)) return json(res, 400, { error: "Estado inválido." });
    const result = await pool.query(`SELECT r.id, u.email, r.requested_days, r.status, r.created_at
      FROM yos_renewal_requests r JOIN yos_users u ON u.id = r.user_id
      WHERE r.status = $1 ORDER BY r.created_at ASC LIMIT 100`, [status]);
    return json(res, 200, { requests: result.rows });
  }

  const rejectMatch = /^\/v1\/admin\/renewals\/([0-9a-f-]+)\/reject$/i.exec(url.pathname);
  if (req.method === "POST" && rejectMatch) {
    if (!isAdmin(req)) return json(res, 401, { error: "No autorizado." });
    const body = await readBody(req);
    const result = await pool.query(`UPDATE yos_renewal_requests SET status = 'rejected', resolved_at = now(), admin_note = $2
      WHERE id = $1 AND status = 'pending' RETURNING id, status`, [rejectMatch[1], String(body.note || "Solicitud rechazada").slice(0, 240)]);
    if (!result.rowCount) return json(res, 409, { error: "La solicitud no existe o ya fue resuelta." });
    return json(res, 200, result.rows[0]);
  }

  const confirmMatch = /^\/v1\/admin\/renewals\/([0-9a-f-]+)\/confirm$/i.exec(url.pathname);
  if (req.method === "POST" && confirmMatch) {
    if (!isAdmin(req)) return json(res, 401, { error: "No autorizado." });
    const body = await readBody(req);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const request = await client.query("SELECT * FROM yos_renewal_requests WHERE id = $1 FOR UPDATE", [confirmMatch[1]]);
      if (!request.rowCount) { await client.query("ROLLBACK"); return json(res, 404, { error: "Solicitud no encontrada." }); }
      const renewal = request.rows[0];
      if (renewal.status === "confirmed") {
        const subscription = await client.query("SELECT expires_at FROM yos_subscriptions WHERE user_id = $1", [renewal.user_id]);
        await client.query("COMMIT");
        return json(res, 200, { status: "confirmed", expiresAt: subscription.rows[0]?.expires_at, idempotent: true });
      }
      if (renewal.status !== "pending") { await client.query("ROLLBACK"); return json(res, 409, { error: "La solicitud ya fue resuelta." }); }
      const note = String(body.note || "Pago confirmado manualmente").slice(0, 240);
      const subscription = await client.query(`UPDATE yos_subscriptions SET expires_at = GREATEST(expires_at, now()) + ($2 * interval '1 day'), updated_at = now()
        WHERE user_id = $1 RETURNING expires_at`, [renewal.user_id, renewal.requested_days]);
      if (!subscription.rowCount) { await client.query("ROLLBACK"); return json(res, 409, { error: "La cuenta no tiene un plan creado." }); }
      await client.query("UPDATE yos_renewal_requests SET status = 'confirmed', resolved_at = now(), admin_note = $2 WHERE id = $1", [renewal.id, note]);
      await client.query("COMMIT");
      return json(res, 200, { status: "confirmed", expiresAt: subscription.rows[0].expires_at, addedDays: renewal.requested_days });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  return json(res, 404, { error: "Ruta no encontrada." });
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio.");
if (!process.env.YOS_ADMIN_KEY || process.env.YOS_ADMIN_KEY.length < 32) throw new Error("Configura YOS_ADMIN_KEY con al menos 32 caracteres aleatorios.");
if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) throw new Error("Configura ALLOWED_ORIGINS antes de iniciar en producción.");

const server = http.createServer(async (req, res) => {
  try { await route(req, res); }
  catch (error) {
    console.error("API request failed:", error?.message || "unknown error");
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : "Error interno." });
    else res.destroy();
  }
});

server.listen(port, "0.0.0.0", () => console.log(`YOS Membership API listening on ${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
