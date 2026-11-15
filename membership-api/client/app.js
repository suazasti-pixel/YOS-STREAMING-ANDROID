"use strict";

const $ = id => document.getElementById(id);
const apiBase = String(window.YOS_MEMBERSHIP_API_BASE || "").replace(/\/+$/, "");
let account = null;
let demoMode = false;
let token = "";

function setMessage(id, message, kind = "") {
  const node = $(id);
  node.textContent = message;
  node.className = "message" + (kind ? " " + kind : "");
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch(apiBase + path, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No fue posible completar la solicitud.");
  return payload;
}

function dateLabel(value) {
  if (!value) return "Sin fecha asignada";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function renderAccount(data) {
  account = data;
  const days = Number.isFinite(Number(data.daysRemaining)) ? Math.max(0, Number(data.daysRemaining)) : null;
  const active = Boolean(data.accessAllowed);
  const expiryCard = $("expiry-card");
  expiryCard.classList.toggle("warning", active && days !== null && days <= 7);
  expiryCard.classList.toggle("expired", !active);
  $("account-name").textContent = data.username || (data.email || "usuario").split("@")[0];
  $("account-email").textContent = data.username || data.email || "Cuenta YOS";
  $("avatar").textContent = (data.username || data.email || "Y").trim().charAt(0).toUpperCase();
  $("plan-chip").textContent = data.plan || "YOS STREAMING";
  $("expiry-date").textContent = dateLabel(data.expiresAt);
  $("days-left").textContent = days === null ? "—" : String(days);
  $("account-status").textContent = active ? "Plan activo" : "Acceso vencido";
  $("state-label").innerHTML = `<i></i> ${active ? (days !== null && days <= 7 ? "PRÓXIMO A VENCER" : "MEMBRESÍA ACTIVA") : "MEMBRESÍA VENCIDA"}`;
  $("expiry-title").textContent = active ? (days !== null && days <= 7 ? "Tu plan está por vencer" : "Tu acceso está activo") : "Tu plan necesita renovarse";
  $("expiry-description").textContent = !active ? "Solicita la renovación para recuperar el acceso cuando se confirme el pago." : days === 0 ? "Tu membresía vence hoy. Solicita la renovación para evitar interrupciones." : days !== null && days <= 7 ? `Te quedan ${days} ${days === 1 ? "día" : "días"}. Puedes solicitar la renovación ahora.` : "Tu cuenta está lista para continuar.";
  $("renewal-description").textContent = !active ? "Solicita renovar tu plan por 30 días. El acceso se actualizará cuando el pago esté confirmado." : "Puedes solicitar renovar tu plan por 30 días. Los días se sumarán al vencimiento actual.";
  $("renew").textContent = demoMode ? "PROBAR SOLICITUD DE RENOVACIÓN" : "SOLICITAR RENOVACIÓN";
  $("login-view").hidden = true;
  $("account-view").hidden = false;
  $("logout").hidden = false;
  $("demo-ribbon").hidden = !demoMode;
}

function showLogin(message = "") {
  token = "";
  account = null;
  sessionStorage.removeItem("yos-membership-token");
  $("account-view").hidden = true;
  $("login-view").hidden = false;
  $("logout").hidden = true;
  $("demo-ribbon").hidden = !demoMode;
  if (message) setMessage("login-message", message, "error");
}

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!apiBase) {
    setMessage("login-message", "La API aún no está configurada. Usa la vista de ejemplo para revisar el diseño.", "error");
    return;
  }
  const button = event.submitter;
  button.disabled = true;
  setMessage("login-message", "Validando tu cuenta…");
  try {
    const result = await api("/v1/auth/login", { method: "POST", body: JSON.stringify({ username: $("email").value, password: $("password").value }) });
    token = result.token;
    sessionStorage.setItem("yos-membership-token", token);
    demoMode = false;
    renderAccount(result.account);
  } catch (error) { setMessage("login-message", error.message, "error"); }
  finally { button.disabled = false; }
});

$("demo-login").addEventListener("click", () => {
  demoMode = true;
  setMessage("login-message", "");
  renderAccount({ email: "cliente@ejemplo.com", status: "active", plan: "YOS STREAMING", expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), daysRemaining: 3, accessAllowed: true, expiryNotice: "soon" });
  setMessage("renewal-message", "");
});

$("renew").addEventListener("click", async () => {
  const button = $("renew");
  button.disabled = true;
  try {
    if (demoMode) {
      setMessage("renewal-message", "Ejemplo: solicitud enviada · Pendiente de confirmación de pago.", "success");
    } else {
      const result = await api("/v1/renewals", { method: "POST", body: JSON.stringify({ days: 30 }) });
      setMessage("renewal-message", result.message || "Solicitud enviada. Tu acceso se actualizará tras la confirmación.", "success");
    }
  } catch (error) { setMessage("renewal-message", error.message, "error"); }
  finally { button.disabled = false; }
});

$("continue-xtream").addEventListener("click", () => {
  if (!account?.accessAllowed) {
    setMessage("renewal-message", "Tu acceso YOS está vencido. Solicita una renovación antes de continuar.", "error");
    return;
  }
  $("xtream-info").hidden = false;
  $("xtream-info").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("back-account").addEventListener("click", () => { $("xtream-info").hidden = true; });
$("logout").addEventListener("click", async () => {
  if (!demoMode && token) { try { await api("/v1/auth/logout", { method: "POST", body: "{}" }); } catch { /* La sesión local se elimina aunque falle la red. */ } }
  demoMode = false;
  showLogin();
});

token = sessionStorage.getItem("yos-membership-token") || "";
if (token && apiBase) {
  api("/v1/me").then(result => { demoMode = false; renderAccount(result.account); }).catch(() => showLogin("La sesión venció. Inicia sesión nuevamente."));
}
if (new URLSearchParams(location.search).get("demo") === "1") $("demo-login").click();
