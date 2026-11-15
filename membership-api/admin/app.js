"use strict";
const $ = id => document.getElementById(id);
let base = "";
let adminKey = "";
let users = [];
const date = value => value ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Pendiente de activación";
function message(text, kind = "") { $("status").textContent = text; $("status").className = kind; }
async function api(path, options = {}) {
  const response = await fetch(base + path, { ...options, cache: "no-store", headers: { "content-type": "application/json", "x-yos-admin-key": adminKey, ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
  return result;
}
function cell(row, text, className = "") { const td = row.insertCell(); td.textContent = text ?? "—"; if (className) td.className = className; return td; }
function renderUsers() {
  const tbody = $("users"); tbody.replaceChildren();
  for (const user of users) {
    const row = tbody.insertRow();
    cell(row, user.username || user.email || "(sin usuario)");
    cell(row, user.status === "active" ? "Activa" : "Suspendida", `tag ${user.status === "active" ? "" : "bad"}`);
    cell(row, date(user.expires_at));
    cell(row, date(user.last_login));
    cell(row, String(user.active_sessions ?? 0));
    const button = document.createElement("button"); button.className = "secondary"; button.textContent = "EDITAR"; button.addEventListener("click", () => editUser(user));
    const td = row.insertCell(); td.append(button);
  }
}
function renderEvents(events) {
  const tbody = $("events"); tbody.replaceChildren();
  for (const event of events) { const row = tbody.insertRow(); cell(row, date(event.created_at)); cell(row, event.identifier); cell(row, event.event); cell(row, event.device_id || "—"); cell(row, event.ip_address || "—"); }
}
async function refresh() {
  message("Cargando cuentas y actividad…");
  const [userData, eventData] = await Promise.all([api("/v1/admin/users"), api("/v1/admin/events?limit=100")]);
  users = userData.users; renderUsers(); renderEvents(eventData.events); message("Conectado. Las contraseñas nunca se muestran.", "ok");
}
function editUser(user) {
  const form = $("edit-form"); form.elements.id.value = user.id; form.elements.username.value = user.username || (user.email || "").split("@")[0];
  form.elements.email.value = user.email || ""; form.elements.password.value = ""; form.elements.status.value = user.status;
  form.elements.days.value = "";
  if (user.expires_at) { const current = new Date(user.expires_at); const local = new Date(current.getTime() - current.getTimezoneOffset() * 60000); form.elements.expiresAt.value = local.toISOString().slice(0, 16); }
  else form.elements.expiresAt.value = "";
  $("edit-panel").hidden = false; $("edit-panel").scrollIntoView({ behavior: "smooth", block: "center" });
}
$("connect").addEventListener("click", async () => {
  base = $("api-url").value.trim().replace(/\/+$/, ""); adminKey = $("admin-key").value;
  if (!base.startsWith("https://") || adminKey.length < 32) return message("Usa una URL HTTPS y la clave administrativa configurada en el servidor.", "error");
  try { await refresh(); $("dashboard").hidden = false; $("auth-panel").hidden = true; sessionStorage.setItem("yos-admin-url", base); }
  catch (error) { message(error.message, "error"); }
});
$("create-form").addEventListener("submit", async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.days = Number(data.days);
  try { await api("/v1/admin/users", { method: "POST", body: JSON.stringify(data) }); event.currentTarget.reset(); event.currentTarget.elements.days.value = "30"; await refresh(); }
  catch (error) { message(error.message, "error"); }
});
$("edit-form").addEventListener("submit", async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const id = values.id; delete values.id;
  if (values.days) values.days = Number(values.days); else delete values.days;
  for (const key of ["email", "password", "expiresAt"]) if (!values[key]) delete values[key];
  if (values.expiresAt) values.expiresAt = new Date(values.expiresAt).toISOString();
  try { await api(`/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(values) }); $("edit-panel").hidden = true; await refresh(); }
  catch (error) { message(error.message, "error"); }
});
$("reload").addEventListener("click", () => refresh().catch(error => message(error.message, "error")));
$("reload-events").addEventListener("click", () => refresh().catch(error => message(error.message, "error")));
$("cancel-edit").addEventListener("click", () => { $("edit-panel").hidden = true; });
$("disconnect").addEventListener("click", () => { adminKey = ""; sessionStorage.clear(); location.reload(); });
$("api-url").value = sessionStorage.getItem("yos-admin-url") || location.origin;
