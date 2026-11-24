"use strict";

const $ = id => document.getElementById(id);
const PAGE_SIZE = 36;
const PLAYBACK_QUEUE_LIMIT = 51;
const LAST_CATEGORY_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const ITEM_CACHE_LIMIT = 5;
const ITEM_CACHE_ROW_LIMIT = 18000;
const MAX_M3U_ITEMS = 20000;
const state = { credentials: null, kind: "live", categories: [], items: [], localItems: [], localCategoryFallback: false, localFallbackCategory: "", filtered: [], limit: PAGE_SIZE, series: null, movie: null, showFavorites: false, globalSearch: false, sportsMode: false, parentalHash: "", parentalUnlocked: false, parentalMode: "setup", parentalFailures: 0, parentalBlockedUntil: 0, episodes: [] };
const kinds = {
  live: { title: "Canales en vivo", categories: "get_live_categories", items: "get_live_streams", singular: "live" },
  movie: { title: "Películas", categories: "get_vod_categories", items: "get_vod_streams", singular: "movie" },
  series: { title: "Series", categories: "get_series_categories", items: "get_series", singular: "series" }
};
let requestSequence = 0;
let m3uRequestSequence = 0;
let categoryRequestSequence = 0;
let itemRequestSequence = 0;
let searchTimer = 0;
let searchSequence = 0;
let guideTimer = 0;
let guideRequestSequence = 0;
const pending = new Map();
const pendingM3u = new Map();
const categoryCache = new Map();
const itemCache = new Map();
const fallbackCatalogCache = new Map();
const seriesCache = new Map();
const guideCache = new Map();
const guidePending = new Map();
let lastPlaybackFocus = null;
let savedPlaylistUrl = "";
let loginMode = "xtream";
let sessionRestoreInProgress = false;
const YOS_THEME_KEY = "yos-xtream-theme-v1";
const YOS_DENSITY_KEY = "yos-xtream-density-v1";

function applyYosTheme(theme) {
  const safeTheme = ["yos", "ocean", "amber"].includes(theme) ? theme : "yos";
  document.body.dataset.yosTheme = safeTheme;
  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === safeTheme));
  });
}

function readYosTheme() {
  try { return localStorage.getItem(YOS_THEME_KEY) || "yos"; }
  catch { return "yos"; }
}

function applyYosDensity(density) {
  const safeDensity = ["compact", "balanced", "large"].includes(density) ? density : "balanced";
  document.body.dataset.yosDensity = safeDensity;
  document.querySelectorAll("[data-density-choice]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.densityChoice === safeDensity));
  });
}

function readYosDensity() {
  try { return localStorage.getItem(YOS_DENSITY_KEY) || "balanced"; }
  catch { return "balanced"; }
}

function cacheItems(key, rows) {
  if (rows.length > ITEM_CACHE_ROW_LIMIT) return;
  itemCache.delete(key);
  itemCache.set(key, rows);
  const cachedRows = () => [...itemCache.values()].reduce((total, items) => total + items.length, 0);
  while (itemCache.size > ITEM_CACHE_LIMIT || (itemCache.size > 1 && cachedRows() > ITEM_CACHE_ROW_LIMIT)) {
    itemCache.delete(itemCache.keys().next().value);
  }
}

function showFallbackCatalog(kind, catalog, requestId) {
  if (requestId !== categoryRequestSequence || state.kind !== kind) return;
  const categories = catalog.categories;
  state.localCategoryFallback = true;
  state.localFallbackCategory = "";
  state.categories = categories;
  showCategories(kind, categories);
  const categoryNames = new Map(categories.map(row => [String(row.category_id), row.category_name || "Categoría"]));
  const categorizedItems = catalog.items.map(item => ({ ...item, category_name: item.category_name || categoryNames.get(String(item.category_id)) || "" }));
  const visibleIds = new Set(categories.filter(row => visibleCategory(row.category_name) && (!state.sportsMode || isSportsCategory(row.category_name))).map(row => String(row.category_id)));
  const visibleItems = categorizedItems.filter(item => {
    const categoryId = item.category_id == null ? "" : String(item.category_id);
    const sportsItem = isSportsCategory(item.category_name) || isSportsCategory(item.name);
    return (!categoryId || visibleIds.has(categoryId) || (state.sportsMode && sportsItem)) &&
      visibleCategory(item.category_name) && (state.parentalUnlocked || !isRestrictedCategory(item.name)) && (!state.sportsMode || sportsItem);
  });
  state.localItems = visibleItems;
  state.items = visibleItems;
  state.limit = PAGE_SIZE;
  applySearch();
  const kindName = kinds[kind].title.toLowerCase();
  setStatus("catalog-status", visibleItems.length
    ? (state.credentials?.m3uMode ? "Lista M3U cargada · categorías listas para buscar." : "Catálogo de " + kindName + " listo · categorías reconstruidas desde el contenido del proveedor.")
    : "El proveedor no devolvió contenido para esta sección.", visibleItems.length ? "ok" : "");
  if (visibleItems.length && document.body.classList.contains("tv-remote")) requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
}

function classifyM3uItem(name, category, url) {
  const text = (String(name || "") + " " + String(category || "") + " " + String(url || "")).toLocaleLowerCase();
  if (/\b(series?|temporadas?|episodios?|episodes?|seasons?|tv\s*shows?)\b|s\d{1,2}\s*e\d{1,2}/i.test(text)) return "series";
  if (/\b(movies?|pel[ií]culas?|cine|films?|vod|pelis)\b|\.(mp4|mkv|avi|mov)(?:$|[?#])/i.test(text)) return "movie";
  return "live";
}

function parseM3uPlaylist(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  return new Promise((resolve, reject) => {
    const items = [];
    let current = null;
    let offset = 0;
    function consumeSlice() {
      const started = performance.now();
      let processed = 0;
      while (offset <= source.length && processed < 1200 && performance.now() - started < 10) {
        const newline = source.indexOf("\n", offset);
        const end = newline < 0 ? source.length : newline;
        const line = source.slice(offset, end).trim();
        offset = newline < 0 ? source.length + 1 : newline + 1;
        processed++;
        if (!line) continue;
        if (line.startsWith("#EXTINF:")) {
          const comma = line.indexOf(",");
          const attributesText = comma >= 0 ? line.slice(0, comma) : line;
          const attributes = {};
          const matcher = /([\w-]+)="([^"]*)"/g;
          let match;
          while ((match = matcher.exec(attributesText))) attributes[match[1].toLowerCase()] = match[2];
          const name = comma >= 0 ? line.slice(comma + 1).trim() : attributes["tvg-name"] || "Sin título";
          const category = attributes["group-title"] || attributes.category || "General";
          current = { name: name || attributes["tvg-name"] || "Sin título", category_name: category, stream_icon: attributes["tvg-logo"] || "", _kind: classifyM3uItem(name, category, ""), _m3u: true };
        } else if (current && /^https?:\/\//i.test(line)) {
          const id = String(items.length + 1);
          let extension = "";
          try { extension = new URL(line).pathname.split(".").pop().toLowerCase(); } catch { /* El enlace se valida al reproducir. */ }
          if (!/^[a-z0-9]{1,8}$/i.test(extension)) extension = current._kind === "live" ? "m3u8" : "mp4";
          const kind = classifyM3uItem(current.name, current.category_name, line);
          items.push({ ...current, _kind: kind, stream_id: id, series_id: kind === "series" ? id : undefined, id, category_id: current.category_name, container_extension: extension, url: line });
          current = null;
          if (items.length > MAX_M3U_ITEMS) {
            reject(new Error("La lista contiene más de 20.000 elementos; usa una lista filtrada o la conexión Xtream."));
            return;
          }
        }
      }
      if (offset <= source.length) setTimeout(consumeSlice, 0);
      else resolve(items);
    }
    consumeSlice();
  });
}

function makeM3uUrl(server, username, password, suppliedUrl = "") {
  if (suppliedUrl) return suppliedUrl;
  const url = new URL(server.replace(/\/+$/, "") + "/get.php");
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  url.searchParams.set("type", "m3u_plus");
  url.searchParams.set("output", "ts");
  return url.toString();
}

function loadM3uUrl(url) {
  const native = bridge();
  if (!native?.downloadM3uAsync && !native?.downloadM3u) return Promise.reject(new Error("Esta versión de YOS no tiene habilitada la carga de listas M3U."));
  if (native.downloadM3uAsync) cancelPendingM3uRequests("Carga anterior sustituida por una lista nueva.");
  const download = native.downloadM3uAsync
    ? new Promise((resolve, reject) => {
      const id = "m3u" + (++m3uRequestSequence);
      const timer = setTimeout(() => {
        pendingM3u.delete(id);
        try { native.cancelM3uRequest?.(id); } catch { /* La solicitud también queda limitada por el timeout de red. */ }
        reject(new Error("La lista M3U tardó demasiado en descargarse. Revisa la conexión o usa una lista más pequeña."));
      }, 90000);
      pendingM3u.set(id, { resolve, reject, timer });
      try { native.downloadM3uAsync(id, url); }
      catch (error) { clearTimeout(timer); pendingM3u.delete(id); reject(error); }
    })
    : Promise.resolve().then(() => native.downloadM3u(url));
  return download.then(async raw => {
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!result.ok) return Promise.reject(new Error(result.error || "No se pudo descargar la lista M3U."));
    if (Array.isArray(result.items)) return result.items;
    if (!String(result.text || "").includes("#EXTINF:")) throw new Error("El servidor no devolvió una lista M3U válida.");
    return await parseM3uPlaylist(result.text);
  });
}

function stablePlaylistId(url) {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index++) hash = Math.imul(hash ^ url.charCodeAt(index), 16777619);
  return "m3u:" + (hash >>> 0).toString(16);
}

function setLoginMode(mode) {
  loginMode = mode === "m3u" ? "m3u" : "xtream";
  const useM3u = loginMode === "m3u";
  $("login-view").classList.toggle("m3u-mode", useM3u);
  $("xtream-fields").hidden = useM3u;
  $("m3u-fields").hidden = !useM3u;
  $("server").disabled = useM3u;
  $("username").disabled = useM3u;
  $("password").disabled = useM3u;
  $("server").required = !useM3u;
  $("username").required = !useM3u;
  $("password").required = !useM3u;
  $("m3u-url").disabled = !useM3u;
  $("m3u-url").required = useM3u;
  $("source-xtream").classList.toggle("active", !useM3u);
  $("source-m3u").classList.toggle("active", useM3u);
  $("source-xtream").setAttribute("aria-pressed", String(!useM3u));
  $("source-m3u").setAttribute("aria-pressed", String(useM3u));
  $("login-button").textContent = useM3u ? "CARGAR LISTA M3U" : "INICIAR SESIÓN";
  setStatus("login-status", useM3u ? "Lista M3U seleccionada. Pega el enlace completo." : "Modo Xtream seleccionado.");
  if (document.body.classList.contains("tv-remote")) {
    const selected = useM3u ? $("source-m3u") : $("source-xtream");
    requestAnimationFrame(() => selected.focus({ preventScroll: true }));
  } else if (useM3u) {
    setTimeout(() => $("m3u-url").focus(), 0);
  }
}

function openConnectedCatalog(info, credentials) {
  const remember = shouldPersistSession();
  const stored = bridge().saveCredentials(credentials.server, credentials.username, credentials.password, credentials.playlistUrl || "", remember);
  const storageResult = readAccount(stored);
  if (!storageResult.ok) throw new Error(storageResult.error || "No se pudieron guardar los datos de forma segura.");
  categoryCache.clear();
  itemCache.clear();
  fallbackCatalogCache.clear();
  seriesCache.clear();
  guideCache.clear();
  guidePending.clear();
  state.parentalHash = localStorage.getItem(parentalStoreKey()) || "";
  state.parentalUnlocked = false;
  state.parentalFailures = 0;
  state.sportsMode = false;
  $("parental-control").hidden = false;
  updateParentalButton();
  $("login-view").hidden = true;
  $("catalog-view").hidden = false;
  $("logout").hidden = false;
  const exp = info?.exp_date && /^\d+$/.test(String(info.exp_date)) ? new Date(Number(info.exp_date) * 1000).toLocaleDateString() : "";
  $("account-summary").textContent = state.credentials.m3uMode ? "Lista M3U · " + state.credentials.m3uItems.length + " elementos" : "Cuenta conectada" + (exp ? " · Vence " + exp : "");
  renderRecent();
  setStatus("login-status", "");
  showHome();
}

async function connectDirectM3u() {
  const rawUrl = $("m3u-url").value.trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error("Pega un enlace M3U válido que empiece por http:// o https://."); }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error("El enlace debe usar http:// o https://.");
  const button = $("login-button");
  button.disabled = true;
  setStatus("login-status", "Descargando y organizando la lista M3U…");
  try {
    const items = await loadM3uUrl(parsed.toString());
    if (!items.length) throw new Error("La lista no contiene canales o elementos reproducibles.");
    const credentials = { server: stablePlaylistId(parsed.toString()), username: "", password: "", playlistUrl: parsed.toString() };
    state.credentials = { ...credentials, m3uMode: true, m3uItems: items };
    openConnectedCatalog(null, credentials);
  } catch (error) {
    state.credentials = null;
    throw error;
  } finally { button.disabled = false; }
}

async function switchToM3uMode() {
  const account = state.credentials;
  if (!account || account.m3uMode) return false;
  const m3uUrl = makeM3uUrl(account.server, account.username, account.password, account.playlistUrl || "");
  const items = await loadM3uUrl(m3uUrl);
  if (!items.length) throw new Error("La lista M3U no contiene elementos reproducibles.");
  account.m3uMode = true;
  account.m3uItems = items;
  account.playlistUrl = m3uUrl;
  categoryCache.clear(); itemCache.clear(); fallbackCatalogCache.clear(); seriesCache.clear(); guideCache.clear();
  try { bridge()?.saveCredentials(account.server, account.username, account.password, m3uUrl, shouldPersistSession()); }
  catch { /* El catálogo sigue disponible aunque no se pueda recordar la cuenta. */ }
  $("account-summary").textContent = "Lista M3U · " + items.length + " elementos";
  return true;
}

function cancelPendingApiRequests() {
  const native = bridge();
  if (native?.cancelApiRequests) native.cancelApiRequests();
  cancelPendingM3uRequests();
  for (const [id, job] of pending) {
    clearTimeout(job.timer);
    pending.delete(id);
    job.reject(new Error("Solicitud reemplazada por la navegación actual."));
  }
  guidePending.clear();
}

function cancelPendingM3uRequests(reason = "La carga M3U se canceló al cambiar de pantalla.") {
  const native = bridge();
  if (!pendingM3u.size) return;
  try { native?.cancelM3uRequests?.(); } catch { /* La llamada nativa puede no existir en versiones anteriores. */ }
  for (const [id, job] of pendingM3u) {
    clearTimeout(job.timer);
    pendingM3u.delete(id);
    job.reject(new Error(reason));
  }
}

function providerStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-favorites-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function historyStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-recent-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function lastCategoryStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-last-category-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function rememberLastCategory(kind, categoryId) {
  if (!state.credentials || state.credentials.m3uMode || !kinds[kind] || categoryId == null || String(categoryId) === "") return;
  try {
    const key = lastCategoryStoreKey();
    const categoryName = state.categories.find(row => String(row.category_id) === String(categoryId))?.category_name || "";
    if (key) localStorage.setItem(key, JSON.stringify({ kind, categoryId: String(categoryId), categoryName, savedAt: Date.now() }));
  } catch { /* El catálogo funciona aunque el almacenamiento local no esté disponible. */ }
}

function prefetchLastCategory() {
  if (!state.credentials || state.credentials.m3uMode) return;
  let saved;
  try {
    const key = lastCategoryStoreKey();
    saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
  } catch { return; }
  if (!saved || Date.now() - Number(saved.savedAt) > LAST_CATEGORY_MAX_AGE || !kinds[saved.kind] || !saved.categoryId) return;
  const providerKey = state.credentials.server + "|" + state.credentials.username;
  const cacheKey = saved.kind + ":" + saved.categoryId;
  if (itemCache.has(cacheKey)) return;
  const prefetch = () => {
    if (!state.credentials || state.credentials.m3uMode || state.credentials.server + "|" + state.credentials.username !== providerKey || itemCache.has(cacheKey)) return;
    callApi(kinds[saved.kind].items, saved.categoryId).then(rows => {
      if (!Array.isArray(rows) || !state.credentials || state.credentials.server + "|" + state.credentials.username !== providerKey) return;
      const categoryName = saved.categoryName || "";
      cacheItems(cacheKey, rows.map(item => ({ ...item, category_name: item.category_name || categoryName })));
    }).catch(() => { /* La precarga es opcional; se vuelve a intentar al abrir la categoría. */ });
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(prefetch, { timeout: 2500 });
  else setTimeout(prefetch, 700);
}

function parentalStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-parental-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function isRestrictedCategory(name) {
  return /\b(adultos?|xxx|porn(?:o|ografía)?|er[oó]tic[oa]s?|solo\s+adultos)\b|(?:\+\s*18|18\s*(?:\+|plus))/i.test(String(name || ""));
}

function visibleCategory(category) { return state.parentalUnlocked || !isRestrictedCategory(category?.category_name); }

function categoriesStatus(rows) {
  const visibleCount = rows.filter(visibleCategory).length;
  if (!visibleCount) return "No hay categorías visibles. Revisa Control parental.";
  return visibleCount < rows.length ? "Elige una categoría. Las categorías +18 permanecen ocultas." : "Elige una categoría para cargar el contenido.";
}

async function hashPin(pin) {
  if (!window.crypto?.subtle) throw new Error("Este dispositivo no permite guardar el PIN de forma segura.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function updateParentalButton() {
  const button = $("parental-control");
  button.textContent = state.parentalUnlocked ? "🔓 PIN" : "🔒 PIN";
  button.setAttribute("aria-label", state.parentalUnlocked ? "Cambiar PIN del control parental" : "Control parental bloqueado");
}

function openParentalDialog() {
  state.parentalMode = !state.parentalHash ? "setup" : state.parentalUnlocked ? "change" : "unlock";
  $("parental-current").value = "";
  $("parental-new").value = "";
  $("parental-current-label").hidden = state.parentalMode === "setup";
  $("parental-current").hidden = state.parentalMode === "setup";
  $("parental-new-label").hidden = state.parentalMode === "unlock";
  $("parental-new").hidden = state.parentalMode === "unlock";
  $("parental-lock-now").hidden = !state.parentalUnlocked;
  $("parental-submit").textContent = state.parentalMode === "setup" ? "GUARDAR PIN" : state.parentalMode === "change" ? "CAMBIAR PIN" : "DESBLOQUEAR CATEGORÍAS";
  $("parental-description").textContent = state.parentalMode === "setup" ? "Crea un PIN local para ocultar las categorías +18 detectadas." : state.parentalMode === "change" ? "Confirma tu PIN actual y escribe uno nuevo." : "Escribe el PIN para mostrar temporalmente las categorías restringidas.";
  setStatus("parental-status", "");
  $("parental-dialog").showModal();
  requestAnimationFrame(() => $(state.parentalMode === "setup" ? "parental-new" : "parental-current").focus());
}

function closeParentalDialog() {
  $("parental-dialog").close();
}

function readRecent() {
  try {
    const key = historyStoreKey();
    const rows = key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function refreshAfterParentalChange() {
  updateParentalButton();
  renderRecent();
  if (state.showFavorites) {
    state.filtered = readFavorites().filter(item => state.parentalUnlocked || !isRestrictedCategory(item.category_name));
    state.limit = PAGE_SIZE;
    applySearch();
  } else loadCategories(state.kind);
}

function saveRecent(rows) {
  try { const key = historyStoreKey(); if (key) localStorage.setItem(key, JSON.stringify(rows.slice(0, 16))); }
  catch { /* El historial es opcional si el almacenamiento está lleno. */ }
}

function renderRecent() {
  const rows = readRecent().filter(row => state.parentalUnlocked || !isRestrictedCategory(row.category));
  const panel = $("recent-panel");
  const grid = $("recent-grid");
  grid.replaceChildren();
  panel.hidden = rows.length === 0;
  for (const row of rows.slice(0, 8)) {
    const card = document.createElement("button");
    card.type = "button"; card.className = "recent-card";
    const cover = document.createElement("span"); cover.className = "recent-cover";
    if (/^https?:\/\//i.test(row.cover || "")) {
      const img = document.createElement("img"); img.loading = "lazy"; img.decoding = "async"; img.alt = ""; img.src = row.cover;
      img.onerror = () => { cover.textContent = "YOS"; }; cover.append(img);
    } else cover.textContent = row.kind === "live" ? "▶" : "YOS";
    const info = document.createElement("span"); info.className = "recent-info";
    const title = document.createElement("b"); title.textContent = row.title || "Contenido";
    const sub = document.createElement("small");
    sub.textContent = (row.kind === "live" ? "TV en vivo" : row.kind === "movie" ? "Película" : "Serie") + (row.category ? " · " + row.category : "");
    info.append(title, sub);
    if (row.kind !== "live" && row.duration > 0 && row.position > 0) {
      const track = document.createElement("span"); track.className = "recent-progress";
      const fill = document.createElement("i"); fill.style.width = Math.min(100, Math.round(row.position / row.duration * 100)) + "%"; track.append(fill); info.append(track);
    }
    card.append(cover, info);
    card.addEventListener("click", () => resumeRecent(row));
    grid.append(card);
  }
}

function resumeRecent(row) {
  if (!bridge()) return;
  if (!state.parentalUnlocked && isRestrictedCategory(row.category)) return;
  const kind = row.kind || "live";
  const playlistItem = state.credentials?.m3uMode
    ? state.credentials.m3uItems.find(item => String(item.stream_id) === String(row.id) && item._kind === kind)
    : null;
  const item = {
    id: row.id, stream_id: row.id, name: row.title, title: row.title,
    container_extension: row.extension, category_name: row.category,
    stream_icon: row.cover, cover: row.cover, _kind: kind, _m3u: !!playlistItem, url: playlistItem?.url
  };
  playItems([item], kind, 0, Number(row.position) || 0);
}

function favoriteId(item, kind) {
  const id = kind === "series" ? (item.series_id || item.id) : item.stream_id;
  return kind + ":" + String(id == null ? "" : id);
}

function readFavorites() {
  try {
    const key = providerStoreKey();
    const rows = key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
    if (!Array.isArray(rows)) return [];
    if (!state.credentials?.m3uMode) return rows;
    return rows.map(row => {
      const item = state.credentials.m3uItems.find(candidate => favoriteId(candidate, candidate._kind) === row.favoriteId);
      return item ? { ...row, ...item } : row;
    });
  } catch { return []; }
}

function saveFavorites(rows) {
  const key = providerStoreKey();
  try {
    if (key) localStorage.setItem(key, JSON.stringify(rows.map(({ url, ...item }) => item)));
  }
  catch { setStatus("catalog-status", "No se pudieron guardar los favoritos en este dispositivo.", "error"); }
}

function makeFavorite(item, kind) {
  return {
    favoriteId: favoriteId(item, kind), _kind: kind,
    stream_id: item.stream_id, series_id: item.series_id, id: item.id,
    _yosChannelNumber: item._yosChannelNumber,
    container_extension: item.container_extension, name: item.name || item.title || "Sin título",
    category_name: item.category_name, stream_icon: item.stream_icon, cover: item.cover
  };
}

function channelNumber(item, index) {
  const raw = item?._yosChannelNumber ?? item?.num ?? item?.channel_number ?? item?.channelNumber ?? item?.number ?? item?.lcn;
  const value = String(raw == null || raw === "" ? Math.max(1, index + 1) : raw).trim().replace(/^0+(?=\d)/, "");
  return /^\d+$/.test(value) ? value : String(Math.max(1, index + 1));
}

function normalizeCatalogText(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesCatalogSearch(item, query, index, kind = state.kind) {
  const name = normalizeCatalogText([item?.name, item?.title, item?.category_name, item?.categoryName].join(" "));
  const q = normalizeCatalogText(query);
  if (name.includes(q)) return true;
  const explicitNumber = item?._yosChannelNumber ?? item?.num ?? item?.channel_number ?? item?.channelNumber ?? item?.number ?? item?.lcn;
  return kind === "live" && /^\d+$/.test(q) && !(state.showFavorites && explicitNumber == null) && channelNumber(item, index) === q.replace(/^0+(?=\d)/, "");
}

function toggleFavorite(item, kind) {
  const id = favoriteId(item, kind);
  const rows = readFavorites();
  const index = rows.findIndex(row => row.favoriteId === id);
  if (index >= 0) rows.splice(index, 1);
  else rows.unshift(makeFavorite(item, kind));
  saveFavorites(rows);
  if (state.showFavorites) applySearch();
  else renderItems();
}

function showFavoritesView() {
  setHomeMode(false);
  searchSequence++;
  itemRequestSequence++;
  categoryRequestSequence++;
  cancelPendingApiRequests();
  state.showFavorites = true;
  updateSearchControls();
  state.sportsMode = false;
  state.globalSearch = false;
  state.items = [];
  state.filtered = readFavorites().filter(item => state.parentalUnlocked || !isRestrictedCategory(item.category_name));
  state.limit = PAGE_SIZE;
  $("search").value = "";
  $("favorites-tab").classList.add("active");
  document.querySelectorAll(".tab[data-kind]").forEach(tab => tab.classList.remove("active"));
  $("category").closest(".filters").classList.add("favorites-mode");
  $("category").closest(".filters").classList.remove("sports-mode");
  $("catalog-title").textContent = "Favoritos";
  $("guide-panel").hidden = true;
  setStatus("catalog-status", state.filtered.length ? "Tus canales, películas y series guardados." : "Agrega favoritos con ☆ en una tarjeta.");
  applySearch();
}

function showBrowseKind(kind) {
  setHomeMode(false);
  const sportsMode = kind === "sports";
  state.sportsMode = sportsMode;
  document.querySelectorAll(".tab[data-kind]").forEach(tab => tab.classList.toggle("active", tab.dataset.kind === kind));
  loadCategories(sportsMode ? "live" : kind);
  document.querySelector(".tabs")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setHomeMode(enabled) {
  const home = Boolean(enabled);
  document.body.classList.toggle("home-mode", home);
  $("home-hero").hidden = !home;
  $("home-tab").classList.toggle("active", home);
  [".filters", "#catalog-status", "#guide-panel", "#content-grid", "#load-more"].forEach(selector => {
    const element = document.querySelector(selector);
    if (element) element.hidden = home;
  });
  if (home) {
    document.querySelectorAll(".tab[data-kind]").forEach(tab => tab.classList.remove("active"));
    $("favorites-tab").classList.remove("active");
    $("catalog-title").textContent = "Inicio";
    $("home-message").textContent = readRecent().length ? "Continúa viendo o explora tu biblioteca." : "Elige una sección para empezar a disfrutar.";
  }
}

function showHome() {
  setHomeMode(true);
  prefetchLastCategory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isSportsCategory(name) {
  return /\b(sport\w*|deport\w*|f[uú]tbol|football|soccer|fifa|uefa|conmebol|champions|liga\s*mx|premier\s*league|nba|wnba|nfl|nhl|mlb|ufc|formula\s*1|f1|moto\s*gp|tenis|tennis|golf|boxeo|boxing|espn|fox\s*sports|win\s*sports|winsports|tudn|tyc|dazn|directv\s*sports|gol\s*tv)\b/i.test(String(name || ""));
}

async function loadSportsItems(selectedCategory = "") {
  if (state.localCategoryFallback && !selectedCategory) {
    state.items = state.localItems;
    state.limit = PAGE_SIZE;
    applySearch();
    setStatus("catalog-status", state.items.length ? "Canales deportivos filtrados desde el catálogo cargado." : "No hay canales deportivos en el catálogo devuelto por el proveedor.", state.items.length ? "ok" : "");
    return;
  }
  const sportsCategories = state.categories.filter(row => row?.category_id != null && visibleCategory(row) && isSportsCategory(row.category_name));
  if (selectedCategory) return loadItems(selectedCategory);
  const requestId = ++itemRequestSequence;
  searchSequence++;
  state.items = []; state.localItems = []; state.filtered = []; state.limit = PAGE_SIZE;
  $("content-grid").replaceChildren(); $("catalog-count").textContent = ""; $("load-more").hidden = true;
  if (!sportsCategories.length) {
    setStatus("catalog-status", "Tu proveedor no tiene categorías con nombres deportivos reconocibles.");
    renderItems();
    return;
  }
  setStatus("catalog-status", "Cargando deportes desde " + sportsCategories.length + " categorías…");
  let next = 0;
  const found = new Map();
  const worker = async () => {
    while (next < sportsCategories.length && requestId === itemRequestSequence) {
      const category = sportsCategories[next++];
      try {
        let rows = itemCache.get("live:" + category.category_id);
        if (!rows) {
          const response = await callApi(kinds.live.items, category.category_id);
          if (!Array.isArray(response)) continue;
          rows = response.map(item => ({ ...item, category_name: item.category_name || category.category_name }));
          cacheItems("live:" + category.category_id, rows);
        }
        if (requestId !== itemRequestSequence || !state.sportsMode) return;
        for (const item of rows) if (item.stream_id != null) found.set(String(item.stream_id), item);
      } catch { /* Una categoría con error no impide cargar las otras. */ }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (requestId !== itemRequestSequence || !state.sportsMode) return;
  state.items = [...found.values()]; state.localItems = state.items;
  applySearch();
  setStatus("catalog-status", state.items.length ? state.items.length + " canales deportivos listos en " + sportsCategories.length + " categorías." : "No se pudo cargar contenido deportivo. Revisa el diagnóstico o el proveedor.", state.items.length ? "ok" : "error");
  if (state.items.length && document.body.classList.contains("tv-remote")) requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
}

function setStatus(id, message, type = "") {
  const el = $(id);
  el.textContent = message || "";
  el.className = "status" + (type ? " " + type : "");
}

function bridge() { return window.YOSXtream || null; }

function callApi(action = "", categoryId = "", itemId = "") {
  return new Promise((resolve, reject) => {
    const native = bridge();
    if (!native) return reject(new Error("Inicia sesión desde la app YOS Xtream instalada en Android o TV Box."));
    const id = "r" + (++requestSequence);
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("El servidor tardó demasiado en responder.")); }, 40000);
    pending.set(id, { resolve, reject, timer });
    native.requestApi(id, state.credentials.server, state.credentials.username, state.credentials.password,
      action, String(categoryId || ""), String(itemId || ""));
  });
}

window.yosXtreamResponse = (id, raw) => {
  const job = pending.get(id);
  if (!job) return;
  clearTimeout(job.timer);
  pending.delete(id);
  try {
    const data = JSON.parse(raw);
    if (data && data._error) throw new Error(data._error);
    job.resolve(data);
  } catch (error) { job.reject(error); }
};

window.yosM3uResponse = (id, raw) => {
  const job = pendingM3u.get(id);
  if (!job) return;
  clearTimeout(job.timer);
  pendingM3u.delete(id);
  job.resolve(raw);
};

window.yosVoiceSearchResult = text => {
  const query = String(text || "").trim();
  if (!query) return;
  $("search").value = query;
  $("search").dispatchEvent(new Event("input", { bubbles: true }));
};
window.yosVoiceSearchError = () => setStatus("catalog-status", "La búsqueda por voz se canceló o no está disponible en este dispositivo.");

async function runDiagnostics() {
  const result = $("diagnostics-result");
  const button = $("diagnostics-run");
  if (!state.credentials) { result.textContent = "Conecta primero tu cuenta Xtream para revisar el proveedor."; return; }
  if (state.credentials.m3uMode) { result.textContent = "Cuenta cargada como lista M3U. Esta fuente no ofrece diagnóstico de API Xtream."; return; }
  button.disabled = true;
  result.textContent = "Probando autenticación y catálogo…";
  const started = performance.now();
  try {
    const auth = await callApi();
    const authMs = Math.round(performance.now() - started);
    if (!auth?.user_info || String(auth.user_info.auth) !== "1") throw new Error("El proveedor no confirmó una cuenta activa.");
    const categoriesStarted = performance.now();
    const categories = await callApi("get_live_categories");
    const categoriesMs = Math.round(performance.now() - categoriesStarted);
    if (!Array.isArray(categories)) throw new Error("El proveedor devolvió una respuesta de categorías no reconocida.");
    result.textContent = "Conexión correcta · Autenticación " + authMs + " ms · " + categories.length + " categorías en " + categoriesMs + " ms · " + (/^https:/i.test(state.credentials.server) ? "HTTPS" : "HTTP sin cifrado");
  } catch (error) {
    result.textContent = "No completó la prueba: " + (error.message || "revisa internet, servidor o cuenta.");
  } finally { button.disabled = false; }
}

function readAccount(raw) {
  try { return JSON.parse(raw || "{}"); }
  catch { return {}; }
}

function shouldPersistSession() {
  const native = bridge();
  if (typeof native?.supportsPersistentSession === "function") return native.supportsPersistentSession();
  return $("remember").checked;
}

function setHttpWarning() {
  const value = (loginMode === "m3u" ? $("m3u-url").value : $("server").value).trim();
  $("http-warning").hidden = !/^http:\/\//i.test(value);
}

function readConnectionFields() {
  let server = $("server").value.trim().replace(/\/+$/, "");
  let username = $("username").value.trim();
  let password = $("password").value;
  let playlistUrl = savedPlaylistUrl;
  try {
    const parsed = new URL(server);
    if (/\/get\.php\/?$/i.test(parsed.pathname)) {
      const linkUsername = parsed.searchParams.get("username");
      const linkPassword = parsed.searchParams.get("password");
      if (!linkUsername || !linkPassword) {
        throw new Error("El enlace get.php debe incluir username y password.");
      }
      const basePath = parsed.pathname.replace(/\/get\.php\/?$/i, "").replace(/\/+$/, "");
      playlistUrl = parsed.toString();
      server = parsed.origin + basePath;
      username = linkUsername;
      password = linkPassword;
      $("server").value = server;
      $("username").value = username;
      $("password").value = password;
      setHttpWarning();
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("El enlace get.php")) throw error;
  }
  return { server, username, password, playlistUrl };
}

$("server").addEventListener("input", () => { savedPlaylistUrl = ""; setHttpWarning(); });
$("username").addEventListener("input", () => { savedPlaylistUrl = ""; });
$("password").addEventListener("input", () => { savedPlaylistUrl = ""; });
$("m3u-url").addEventListener("input", () => { savedPlaylistUrl = ""; setHttpWarning(); });
$("source-xtream").addEventListener("click", () => setLoginMode("xtream"));
$("source-m3u").addEventListener("click", () => setLoginMode("m3u"));
document.querySelectorAll(".source-option").forEach(button => button.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " " && event.keyCode !== 23) return;
  event.preventDefault();
  setLoginMode(button.id === "source-m3u" ? "m3u" : "xtream");
}));

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (loginMode === "m3u") {
    try { await connectDirectM3u(); }
    catch (error) {
      const message = sessionRestoreInProgress
        ? "La sesión sigue guardada. No tienes que volver a escribir el enlace; revisa internet y la lista se reconectará al regresar a la app."
        : error.message || "No se pudo cargar la lista M3U.";
      setStatus("login-status", message, "error");
    } finally { sessionRestoreInProgress = false; }
    return;
  }
  let connection;
  try { connection = readConnectionFields(); }
  catch (error) { setStatus("login-status", error.message, "error"); return; }
  const { server, username, password, playlistUrl } = connection;
  if (!/^https?:\/\/[^/]+(?::\d+)?(?:\/[^?#]*)?$/i.test(server)) {
    setStatus("login-status", "Escribe el servidor con http:// o https:// y su puerto si aplica.", "error");
    return;
  }
  if (!username || !password) return;
  const button = $("login-button");
  button.disabled = true;
  setStatus("login-status", "Conectando con el proveedor…");
  state.credentials = { server, username, password, playlistUrl };
  try {
    let auth;
    try { auth = await callApi(); }
    catch (apiError) {
      if (!/HTTP 404\b/.test(apiError.message || "")) throw apiError;
      setStatus("login-status", "La API Xtream no está disponible. Probando el enlace M3U…");
      try { await switchToM3uMode(); }
      catch (m3uError) { throw new Error("La API respondió HTTP 404 y la lista M3U no se pudo cargar: " + (m3uError.message || "revisa el enlace")); }
      auth = null;
    }
    const info = auth && auth.user_info;
    if (!state.credentials.m3uMode && (!info || String(info.auth) !== "1")) throw new Error("El proveedor no autenticó esta cuenta o no ofrece una API Xtream compatible.");
    if (!state.credentials.m3uMode && info.status && !/^active$/i.test(String(info.status))) throw new Error("La cuenta aparece como " + info.status + ".");
    const remember = shouldPersistSession();
    const stored = bridge().saveCredentials(server, username, password, state.credentials.playlistUrl || "", remember);
    const storageResult = readAccount(stored);
    if (!storageResult.ok) throw new Error(storageResult.error || "No se pudieron guardar las credenciales.");
    categoryCache.clear();
    itemCache.clear();
    fallbackCatalogCache.clear();
    seriesCache.clear();
    guideCache.clear();
    guidePending.clear();
    state.parentalHash = localStorage.getItem(parentalStoreKey()) || "";
    state.parentalUnlocked = false;
    state.parentalFailures = 0;
    state.sportsMode = false;
    $("parental-control").hidden = false;
    updateParentalButton();
    $("login-view").hidden = true;
    $("catalog-view").hidden = false;
    $("logout").hidden = false;
    const exp = info?.exp_date && /^\d+$/.test(String(info.exp_date)) ? new Date(Number(info.exp_date) * 1000).toLocaleDateString() : "";
    $("account-summary").textContent = state.credentials.m3uMode ? "Lista M3U · " + state.credentials.m3uItems.length + " elementos" : "Cuenta conectada" + (exp ? " · Vence " + exp : "");
    renderRecent();
    setStatus("login-status", "");
    showHome();
  } catch (error) {
    state.credentials = null;
    const message = sessionRestoreInProgress
      ? "La sesión sigue guardada de forma cifrada. No vuelvas a escribir los datos; revisa la conexión y la app intentará reconectar al volver. " + (error.message || "")
      : error.message || "No se pudo conectar. Revisa servidor, usuario y contraseña.";
    setStatus("login-status", message, "error");
  } finally { button.disabled = false; sessionRestoreInProgress = false; }
});

async function loadCategories(kind) {
  setHomeMode(false);
  searchSequence++;
  const requestId = ++categoryRequestSequence;
  itemRequestSequence++;
  cancelPendingApiRequests();
  state.kind = kind;
  state.showFavorites = false;
  updateSearchControls();
  state.globalSearch = false;
  $("favorites-tab").classList.remove("active");
  $("category").closest(".filters").classList.remove("favorites-mode");
  $("guide-panel").hidden = true;
  state.categories = [];
  state.items = [];
  state.localItems = [];
  state.localCategoryFallback = false;
  state.localFallbackCategory = "";
  state.filtered = [];
  state.limit = PAGE_SIZE;
  $("catalog-title").textContent = state.sportsMode ? "Deportes" : kinds[kind].title;
  $("content-grid").replaceChildren();
  $("catalog-count").textContent = "";
  $("load-more").hidden = true;
  $("search").value = "";
  $("category").disabled = false;
  if (state.credentials?.m3uMode) {
    const items = state.credentials.m3uItems.filter(item => item._kind === kind);
    const categoryMap = new Map();
    for (const item of items) {
      const id = String(item.category_name || "General");
      if (!categoryMap.has(id)) categoryMap.set(id, { category_id: id, category_name: id });
    }
    const catalog = {
      categories: [...categoryMap.values()],
      items: items.map(item => ({ ...item, category_id: String(item.category_name || "General") }))
    };
    showFallbackCatalog(kind, catalog, requestId);
    return;
  }
  const fallbackCatalog = fallbackCatalogCache.get(kind);
  if (fallbackCatalog) {
    state.localCategoryFallback = true;
    showFallbackCatalog(kind, fallbackCatalog, requestId);
    return;
  }
  const cachedRows = categoryCache.get(kind);
  if (cachedRows) {
    showCategories(kind, cachedRows);
    if (state.sportsMode) loadSportsItems();
    else if (!loadRememberedCategory(kind, cachedRows)) setStatus("catalog-status", cachedRows.length ? categoriesStatus(cachedRows) : "El proveedor no devolvió categorías para esta sección.");
    return;
  }
  $("category").innerHTML = '<option value="">Cargando categorías…</option>';
  setStatus("catalog-status", "Cargando categorías…");
  try {
    const rows = await callApi(kinds[kind].categories);
    if (requestId !== categoryRequestSequence || state.kind !== kind) return;
    if (!Array.isArray(rows)) throw new Error("El proveedor devolvió categorías con formato no reconocido.");
    categoryCache.set(kind, rows);
    showCategories(kind, rows);
    if (state.sportsMode) loadSportsItems();
    else if (!loadRememberedCategory(kind, rows)) setStatus("catalog-status", rows.length ? categoriesStatus(rows) : "El proveedor no devolvió categorías para esta sección.");
  } catch (error) {
    if (requestId !== categoryRequestSequence) return;
    if (/HTTP 404\b/.test(error.message || "")) {
      try {
        if (await switchToM3uMode()) {
          await loadCategories(kind);
          return;
        }
      } catch (m3uError) {
        error = new Error("La API respondió HTTP 404 y la lista M3U no se pudo cargar: " + (m3uError.message || "revisa el proveedor"));
      }
      $("category").innerHTML = '<option value="">Cargando catálogo…</option>';
      setStatus("catalog-status", "El proveedor rechazó la lista de categorías. Intentando cargar el catálogo completo…");
      try {
        const items = await callApi(kinds[kind].items);
        if (requestId !== categoryRequestSequence || state.kind !== kind) return;
        if (!Array.isArray(items)) throw new Error("el catálogo completo devolvió un formato no reconocido");
        const categoryMap = new Map();
        for (const item of items) {
          if (item?.category_id == null) continue;
          const id = String(item.category_id);
          if (!categoryMap.has(id)) categoryMap.set(id, { category_id: id, category_name: item.category_name || "Categoría " + id });
        }
        const catalog = { categories: [...categoryMap.values()], items };
        fallbackCatalogCache.delete(kind);
        fallbackCatalogCache.set(kind, catalog);
        while (fallbackCatalogCache.size > 1) fallbackCatalogCache.delete(fallbackCatalogCache.keys().next().value);
        showFallbackCatalog(kind, catalog, requestId);
        return;
      } catch (fallbackError) {
        if (requestId !== categoryRequestSequence) return;
        error = new Error("El proveedor respondió HTTP 404 al cargar categorías y tampoco permitió cargar el catálogo completo: " + (fallbackError.message || "revisa el proveedor"));
      }
    }
    $("category").innerHTML = '<option value="">Sin categorías</option>';
    setStatus("catalog-status", error.message, "error");
  }
}

function updateSearchControls() {
  const inputLabel = state.showFavorites ? "favoritos" : state.sportsMode ? "canales deportivos" : state.kind === "live" ? "canales" : state.kind === "movie" ? "películas" : "series";
  $("search").placeholder = state.kind === "live" && !state.showFavorites
    ? "Buscar " + inputLabel + " por nombre o número (ej. 222)"
    : "Buscar " + inputLabel;
  $("search").setAttribute("aria-label", "Buscar " + inputLabel);
}

function loadRememberedCategory(kind, rows) {
  if (!state.credentials || state.credentials.m3uMode || !Array.isArray(rows)) return false;
  try {
    const key = lastCategoryStoreKey();
    const saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
    if (!saved || saved.kind !== kind || Date.now() - Number(saved.savedAt) > LAST_CATEGORY_MAX_AGE) return false;
    const category = rows.find(row => String(row.category_id) === String(saved.categoryId) && visibleCategory(row.category_name));
    if (!category) return false;
    $("category").value = String(category.category_id);
    loadItems(category.category_id);
    return true;
  } catch { return false; }
}

function showCategories(kind, rows) {
  state.categories = rows;
  $("category").closest(".filters").classList.toggle("sports-mode", state.sportsMode);
  $("category").innerHTML = state.sportsMode ? '<option value="">Todas las categorías deportivas</option>' : '<option value="">Selecciona una categoría</option>';
  const visibleRows = rows.filter(row => visibleCategory(row) && (!state.sportsMode || isSportsCategory(row.category_name)));
  for (const row of visibleRows) {
    if (!row || row.category_id == null) continue;
    const option = document.createElement("option");
    option.value = String(row.category_id);
    option.textContent = row.category_name || "Categoría";
    $("category").append(option);
  }
  if (rows.length > visibleRows.length && !state.sportsMode) setStatus("catalog-status", "Categorías para adultos ocultas. Usa Control parental para mostrarlas.");
  if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => $("category").focus());
}

async function loadItems(categoryId) {
  searchSequence++;
  const requestId = ++itemRequestSequence;
  cancelPendingApiRequests();
  if (!categoryId) {
    state.items = [];
    state.localItems = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", "Elige una categoría para cargar el contenido.");
    return;
  }
  if (state.localCategoryFallback) {
    state.localFallbackCategory = String(categoryId);
    state.items = state.localItems.filter(item => String(item.category_id ?? "") === String(categoryId));
    state.limit = PAGE_SIZE;
    applySearch();
    setStatus("catalog-status", state.items.length ? "Categoría filtrada localmente." : "Esta categoría no tiene contenido.", state.items.length ? "ok" : "");
    return;
  }
  const kind = state.kind;
  rememberLastCategory(kind, categoryId);
  const cacheKey = kind + ":" + categoryId;
  const cachedRows = itemCache.get(cacheKey);
  if (cachedRows) {
    itemCache.delete(cacheKey);
    itemCache.set(cacheKey, cachedRows);
    state.items = cachedRows;
    state.localItems = cachedRows;
    state.limit = PAGE_SIZE;
    applySearch();
    setStatus("catalog-status", "Contenido cargado.", "ok");
    if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
    return;
  }
  $("category").disabled = true;
  $("content-grid").replaceChildren();
  setStatus("catalog-status", "Cargando " + kinds[state.kind].title.toLowerCase() + "…");
  const requestStartedAt = performance.now();
  try {
    const rows = await callApi(kinds[kind].items, categoryId);
    if (requestId !== itemRequestSequence || state.kind !== kind || $("category").value !== String(categoryId)) return;
    if (!Array.isArray(rows)) throw new Error("El proveedor devolvió contenido con formato no reconocido.");
    const categoryName = state.categories.find(row => String(row.category_id) === String(categoryId))?.category_name || "";
    const categorizedRows = rows.map((item, index) => ({ ...item, _yosChannelNumber: channelNumber(item, index), category_name: item.category_name || categoryName }));
    cacheItems(cacheKey, categorizedRows);
    state.items = categorizedRows;
    state.localItems = rows;
    state.limit = PAGE_SIZE;
    applySearch();
    const providerSeconds = ((performance.now() - requestStartedAt) / 1000).toFixed(1);
    setStatus("catalog-status", rows.length ? rows.length + " elementos listos · servidor " + providerSeconds + " s." : "Esta categoría no tiene contenido.", rows.length ? "ok" : "");
    if (rows.length && document.body.classList.contains("tv-remote")) {
      requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
    }
  } catch (error) {
    if (requestId !== itemRequestSequence || state.kind !== kind) return;
    if (/HTTP 404\b/.test(error.message || "")) {
      try {
        if (await switchToM3uMode()) {
          await loadCategories(kind);
          return;
        }
      } catch (m3uError) { error = new Error("La API respondió HTTP 404 y la lista M3U no se pudo cargar: " + (m3uError.message || "revisa el proveedor")); }
    }
    state.items = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", error.message, "error");
  } finally { if (requestId === itemRequestSequence) $("category").disabled = false; }
}

function applySearch() {
  const q = $("search").value.trim();
  const source = state.showFavorites ? readFavorites() : state.items;
  const kind = state.showFavorites ? "live" : state.kind;
  state.filtered = q ? source.filter((item, index) => matchesCatalogSearch(item, q, index, item._kind || kind)) : [...source];
  state.limit = PAGE_SIZE;
  renderItems();
}

async function searchCatalog(query) {
  const requestId = ++searchSequence;
  const kind = state.kind;
  const q = query.trim();
  if (q.length < 2 || state.showFavorites) {
    if (state.globalSearch) cancelPendingApiRequests();
    if (state.globalSearch && !state.showFavorites) {
      state.items = state.localCategoryFallback && state.localFallbackCategory
        ? state.localItems.filter(item => String(item.category_id ?? "") === state.localFallbackCategory)
        : state.localItems;
    }
    state.globalSearch = false;
    applySearch();
    if (q.length === 1 && !state.showFavorites) setStatus("catalog-status", /^\d$/.test(q) && kind === "live" ? "Canal #" + q + " en la categoría cargada. Escribe más dígitos para buscar en todo el catálogo." : "Escribe al menos 2 caracteres para buscar en todo el catálogo.");
    return;
  }
  if (state.localCategoryFallback) {
    state.globalSearch = true;
    state.items = state.localItems;
    applySearch();
    setStatus("catalog-status", state.filtered.length ? "Resultados en el catálogo cargado localmente." : "No encontramos coincidencias en este tipo de contenido.", state.filtered.length ? "ok" : "");
    return;
  }
  if (!state.categories.length) { setStatus("catalog-status", "Espera a que carguen las categorías para buscar."); return; }
  cancelPendingApiRequests();
  state.globalSearch = true;
  // Show matches from recently opened categories immediately, while the remaining
  // categories continue loading in the background.
  const found = new Map();
  for (const [cacheKey, cachedItems] of itemCache) {
    if (!cacheKey.startsWith(kind + ":")) continue;
    const categoryId = cacheKey.slice(kind.length + 1);
    const category = state.categories.find(row => String(row.category_id) === categoryId);
    cachedItems.forEach((item, itemIndex) => {
      if (!matchesCatalogSearch(item, q, itemIndex, kind)) return;
      const id = kind === "series" ? (item.series_id || item.id) : item.stream_id;
      if (id != null) found.set(String(id), { ...item, _yosChannelNumber: kind === "live" ? channelNumber(item, itemIndex) : item._yosChannelNumber, _kind: kind, category_name: item.category_name || category?.category_name || "" });
    });
  }
  state.items = [...found.values()];
  state.filtered = state.items;
  state.limit = PAGE_SIZE;
  renderItems();
  const categories = state.categories.filter(row => row && row.category_id != null && visibleCategory(row) && (!state.sportsMode || isSportsCategory(row.category_name)));
  let next = 0;
  let checked = 0;
  let unsupportedAction = false;
  let m3uFallbackError = "";
  let lastPaintAt = 0;
  setStatus("catalog-status", found.size
    ? found.size + " resultados rápidos. Buscando en " + categories.length + " categorías…"
    : "Buscando en " + categories.length + " categorías…");
  const worker = async () => {
    while (next < categories.length && requestId === searchSequence) {
      const row = categories[next++];
      try {
        let items = itemCache.get(kind + ":" + row.category_id);
        if (!items) {
          const response = await callApi(kinds[kind].items, row.category_id);
          if (!Array.isArray(response)) continue;
          items = response;
          cacheItems(kind + ":" + row.category_id, items);
        }
        if (requestId !== searchSequence || state.kind !== kind) return;
        items.forEach((item, itemIndex) => {
          if (matchesCatalogSearch(item, q, itemIndex, kind)) {
            const id = kind === "series" ? (item.series_id || item.id) : item.stream_id;
            if (id != null) found.set(String(id), { ...item, _yosChannelNumber: kind === "live" ? channelNumber(item, itemIndex) : item._yosChannelNumber, _kind: kind, category_name: item.category_name || row.category_name });
          }
        });
      } catch (error) {
        if (/HTTP 404\b/.test(error.message || "")) unsupportedAction = true;
      }
      checked++;
      if (found.size && (checked === 1 || checked % 3 === 0 || performance.now() - lastPaintAt > 300)) {
        state.items = [...found.values()];
        state.filtered = state.items;
        state.limit = PAGE_SIZE;
        renderItems();
        lastPaintAt = performance.now();
      }
      if (requestId === searchSequence) setStatus("catalog-status", "Revisando " + checked + " de " + categories.length + " categorías… " + found.size + " resultados.");
    }
  };
  await Promise.all([worker(), worker()]);
  if (requestId !== searchSequence || state.kind !== kind) return;
  if (unsupportedAction) {
    try {
      if (await switchToM3uMode()) {
        await loadCategories(kind);
        return;
      }
    } catch (error) { m3uFallbackError = error.message || "No se pudo cargar la lista M3U."; }
  }
  state.items = [...found.values()];
  state.filtered = state.items;
  state.limit = PAGE_SIZE;
  renderItems();
  const noMatch = /^\d+$/.test(q) ? "No encontramos el canal #" + q + " en las categorías de TV cargadas." : "No encontramos coincidencias en este tipo de contenido.";
  setStatus("catalog-status", m3uFallbackError ? "La API respondió HTTP 404 y la lista M3U no se pudo cargar: " + m3uFallbackError : state.filtered.length ? "Resultados en todo el catálogo." : noMatch, m3uFallbackError ? "error" : state.filtered.length ? "ok" : "");
  if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
}

function renderItems(append = false) {
  const box = $("content-grid");
  const startAt = append ? Math.max(0, state.limit - PAGE_SIZE) : 0;
  if (!append) box.replaceChildren();
  const fragment = document.createDocumentFragment();
  const page = state.filtered.slice(startAt, state.limit);
  const favoriteIds = new Set(readFavorites().map(row => row.favoriteId));
  if (!append && !state.filtered.length) {
    const empty = document.createElement("p");
    empty.className = "muted empty-state";
    empty.textContent = state.showFavorites ? "Todavía no tienes favoritos." : "No se encontraron elementos en esta categoría.";
    box.append(empty);
  }
  for (const item of page) {
    const kind = item._kind || state.kind;
    const wrapper = document.createElement("article");
    wrapper.className = "content-card-wrap";
    const button = document.createElement("button");
    button.className = "content-card";
    button.type = "button";
    button.dataset.contentId = String(kind === "series" ? (item.series_id || item.id || "") : (item.stream_id || ""));
    button.dataset.contentKind = kind;
    const posterUrl = item.stream_icon || item.cover || "";
    let poster;
    if (/^https?:\/\//i.test(posterUrl)) {
      const img = document.createElement("img");
      img.className = "poster";
      img.loading = "lazy";
      img.decoding = "async";
      img.fetchPriority = "low";
      img.alt = "";
      img.src = posterUrl;
      img.onerror = () => img.replaceWith(posterPlaceholder(item.name));
      poster = img;
    } else {
      poster = posterPlaceholder(item.name);
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.name || "Sin título";
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const categoryLabel = item.category_name || (kind === "live" ? "TV en vivo" : kind === "movie" ? "Película" : "Serie");
    const liveNumber = state.showFavorites && item._yosChannelNumber == null && item.num == null && item.channel_number == null && item.channelNumber == null && item.number == null && item.lcn == null
      ? "—" : channelNumber(item, state.items.indexOf(item));
    meta.textContent = kind === "live" ? "CANAL " + liveNumber + " · " + categoryLabel : categoryLabel;
    body.append(title, meta);
    button.append(poster, body);
    button.addEventListener("click", () => selectItem(item));
    if (kind === "live") button.addEventListener("focus", () => {
      clearTimeout(guideTimer);
      guideTimer = setTimeout(() => showProgramGuide(item), 220);
    });
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-toggle";
    const favored = favoriteIds.has(favoriteId(item, kind));
    favorite.textContent = favored ? "★" : "☆";
    favorite.setAttribute("aria-pressed", String(favored));
    favorite.setAttribute("aria-label", (favored ? "Quitar de favoritos " : "Agregar a favoritos ") + (item.name || "contenido"));
    favorite.addEventListener("click", () => toggleFavorite(item, kind));
    wrapper.append(button, favorite);
    fragment.append(wrapper);
  }
  box.append(fragment);
  $("catalog-count").textContent = state.filtered.length ? state.filtered.length + " elementos" : "";
  $("load-more").hidden = state.limit >= state.filtered.length;
}

function loadNextPage() {
  if (state.limit >= state.filtered.length) return;
  state.limit = Math.min(state.filtered.length, state.limit + PAGE_SIZE);
  renderItems(true);
}

function posterPlaceholder(name) {
  const placeholder = document.createElement("div");
  placeholder.className = "poster poster-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.textContent = String(name || "YOS").trim().slice(0, 2).toUpperCase() || "Y";
  return placeholder;
}

async function showProgramGuide(item) {
  const kind = item._kind || state.kind;
  if (state.credentials?.m3uMode) {
    $("guide-panel").hidden = false;
    $("guide-channel").textContent = item.name || "Canal en vivo";
    $("guide-now").textContent = "La lista M3U no incluye datos de programación.";
    $("guide-next").textContent = "La reproducción del canal está disponible.";
    $("guide-now-time").textContent = "";
    $("guide-next-time").textContent = "";
    $("guide-upcoming").replaceChildren();
    return;
  }
  if (kind !== "live" || item.stream_id == null) {
    $("guide-panel").hidden = true;
    return;
  }
  const requestId = ++guideRequestSequence;
  const key = String(item.stream_id);
  $("guide-panel").hidden = false;
  $("guide-channel").textContent = item.name || "Canal en vivo";
  $("guide-now").textContent = "Consultando programación…";
  $("guide-next").textContent = "Consultando programación…";
  $("guide-now-time").textContent = "";
  $("guide-next-time").textContent = "";
  $("guide-upcoming").replaceChildren();
  try {
    let programs = guideCache.get(key);
    if (!programs) {
      let pendingGuide = guidePending.get(key);
      if (!pendingGuide) {
        pendingGuide = callApi("get_short_epg", "", key).finally(() => guidePending.delete(key));
        guidePending.set(key, pendingGuide);
      }
      const response = await pendingGuide;
      programs = Array.isArray(response) ? response : (Array.isArray(response?.epg_list) ? response.epg_list : []);
      guideCache.set(key, programs);
      while (guideCache.size > 80) guideCache.delete(guideCache.keys().next().value);
    }
    if (requestId !== guideRequestSequence) return;
    $("guide-now").textContent = programs[0]?.title || "El proveedor no ofrece datos de programación.";
    $("guide-next").textContent = programs[1]?.title || "Sin siguiente programa disponible.";
    $("guide-now-time").textContent = formatProgramTime(programs[0]);
    $("guide-next-time").textContent = formatProgramTime(programs[1]);
    const upcoming = $("guide-upcoming");
    for (const program of programs.slice(2, 8)) {
      const card = document.createElement("article");
      const time = document.createElement("span"); time.textContent = [formatProgramTime(program), formatProgramEndTime(program)].filter(Boolean).join(" – ") || "PRÓXIMO";
      const title = document.createElement("strong"); title.textContent = program.title || "Programa";
      card.append(time, title); upcoming.append(card);
    }
    if (!programs.length) upcoming.textContent = "El proveedor no ofrece programación para este canal.";
  } catch {
    if (requestId !== guideRequestSequence) return;
    $("guide-now").textContent = "Guía no disponible para este canal.";
    $("guide-next").textContent = "La reproducción del canal sigue disponible.";
    $("guide-upcoming").textContent = "No se pudo consultar la programación extendida.";
  }
}

function formatProgramTime(program) {
  if (!program) return "";
  const raw = program.start_timestamp || program.start || "";
  if (!raw) return "";
  const numeric = Number(raw);
  const dateValue = Number.isFinite(numeric) ? (numeric < 100000000000 ? numeric * 1000 : numeric) : String(raw).replace(" ", "T");
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatProgramEndTime(program) {
  if (!program) return "";
  const raw = program.stop_timestamp || program.end_timestamp || program.stop || program.end || "";
  if (!raw) return "";
  const numeric = Number(raw);
  const value = Number.isFinite(numeric) ? (numeric < 100000000000 ? numeric * 1000 : numeric) : String(raw).replace(" ", "T");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function streamUrl(kind, item) {
  if (item._m3u && /^https?:\/\//i.test(item.url || "")) return item.url;
  const c = state.credentials;
  const route = kind === "live" ? "live" : kind === "movie" ? "movie" : "series";
  const id = kind === "live" ? item.stream_id : kind === "movie" ? item.stream_id : item.id;
  let extension = String(item.container_extension || (kind === "live" ? "m3u8" : "mp4")).replace(/^\./, "");
  if (!/^[a-z0-9]{1,8}$/i.test(extension)) extension = kind === "live" ? "m3u8" : "mp4";
  return c.server + "/" + route + "/" + encodeURIComponent(c.username) + "/" + encodeURIComponent(c.password) + "/" + encodeURIComponent(String(id)) + "." + extension;
}

function playItems(items, kind, index = 0, resumePosition = 0) {
  if (!Array.isArray(items) || !items.length) return;
  const selectedIndex = Math.max(0, Math.min(Number(index) || 0, items.length - 1));
  const queueStart = Math.max(0, Math.min(selectedIndex - Math.floor(PLAYBACK_QUEUE_LIMIT / 2), items.length - PLAYBACK_QUEUE_LIMIT));
  const queueItems = items.slice(queueStart, queueStart + PLAYBACK_QUEUE_LIMIT);
  const queue = queueItems.map(item => {
    const id = kind === "series" ? (item.id || item.stream_id || item.series_id) : item.stream_id;
    return {
      url: streamUrl(kind, item), name: item.title || item.name || "YOS Xtream", kind,
      id: String(id == null ? "" : id), category: item.category_name || "",
      extension: item.container_extension || (kind === "live" ? "m3u8" : "mp4"),
      cover: item.stream_icon || item.cover || ""
    };
  });
  if (!queue.length) return;
  const queueIndex = selectedIndex - queueStart;
  const selected = queue[queueIndex];
  lastPlaybackFocus = document.activeElement?.closest?.(".content-card, .recent-card") || null;
  const recent = readRecent().find(row => row.kind === kind && row.id === selected.id);
  const startAt = resumePosition || (kind !== "live" && recent ? Number(recent.position) || 0 : 0);
  if (bridge()) bridge().playNative(selected.url, selected.name, JSON.stringify(queue), queueIndex, startAt);
  else setStatus("catalog-status", "La reproducción está disponible en el APK Android/TV Box.");
}

function restorePlaybackFocus() {
  if (document.body.classList.contains("tv-remote") && !document.body.classList.contains("player-open")) requestAnimationFrame(() => {
    const target = lastPlaybackFocus?.isConnected ? lastPlaybackFocus : null;
    if (target && !target.closest("[hidden]")) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    } else {
      const activeTab = state.showFavorites ? $("favorites-tab") : document.querySelector('.tab[data-kind="' + (state.sportsMode ? "sports" : state.kind) + '"]');
      activeTab?.focus({ preventScroll: true });
    }
  });
}

window.yosPlaybackReturned = restorePlaybackFocus;
window.yosPlaybackFinished = raw => {
  try {
    const playback = JSON.parse(raw || "{}");
    if (playback.id && playback.title) {
      const kind = ["live", "movie", "series"].includes(playback.kind) ? playback.kind : "live";
      const rows = readRecent().filter(row => !(row.kind === kind && row.id === String(playback.id)));
      rows.unshift({
        id: String(playback.id), kind, title: String(playback.title), category: String(playback.category || ""),
        extension: String(playback.extension || ""), cover: /^https?:\/\//i.test(playback.cover || "") ? playback.cover : "",
        position: kind === "live" ? 0 : Math.max(0, Number(playback.position) || 0),
        duration: kind === "live" ? 0 : Math.max(0, Number(playback.duration) || 0)
      });
      saveRecent(rows);
      renderRecent();
    }
  } catch { /* Los datos del player no son necesarios para seguir navegando. */ }
  restorePlaybackFocus();
};

async function selectItem(item) {
  const kind = item._kind || state.kind;
  if (kind === "live") showProgramGuide(item);
  if (kind === "series" && !item._m3u) return showEpisodes(item);
  if (kind === "movie") return showMovieDetails(item);
  const streamKey = "stream_id";
  const source = state.showFavorites ? readFavorites() : state.filtered;
  const queueItems = source.filter(row => (row._kind || state.kind) === kind && row[streamKey] != null);
  const index = queueItems.findIndex(row => String(row[streamKey]) === String(item[streamKey]));
  playItems(queueItems, kind, Math.max(0, index));
}

let activeMovie = null;
async function showMovieDetails(movie) {
  activeMovie = movie;
  $("movie-title").textContent = movie.name || "Película";
  $("movie-meta").textContent = movie.category_name || "Película";
  $("movie-plot").textContent = movie.plot || movie.description || "Consultando información del proveedor…";
  const coverUrl = movie.stream_icon || movie.cover || "";
  $("movie-cover").hidden = !/^https?:\/\//i.test(coverUrl);
  if (!$("movie-cover").hidden) { $("movie-cover").src = coverUrl; $("movie-cover").onerror = () => { $("movie-cover").hidden = true; }; }
  $("movie-status").textContent = "";
  updateMovieFavoriteButton();
  $("movie-dialog").showModal();
  if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => $("movie-play").focus());
  if (movie._m3u || state.credentials?.m3uMode) {
    $("movie-plot").textContent = movie.plot || movie.description || "La lista M3U no incluye sinopsis para esta película.";
    $("movie-status").textContent = "";
    return;
  }
  try {
    const response = await callApi("get_vod_info", "", String(movie.stream_id));
    const data = response?.info || response?.movie_data || {};
    if (activeMovie !== movie) return;
    $("movie-plot").textContent = data.plot || data.description || movie.plot || movie.description || "Sin sinopsis disponible.";
    const tags = [movie.category_name, data.releasedate || data.releaseDate || data.year, data.rating ? "★ " + data.rating : ""].filter(Boolean);
    $("movie-meta").textContent = tags.join(" · ") || "Película";
    if (data.movie_image || data.cover_big) {
      const url = data.movie_image || data.cover_big;
      if (/^https?:\/\//i.test(url)) { $("movie-cover").hidden = false; $("movie-cover").src = url; }
    }
    if (data.container_extension) activeMovie.container_extension = data.container_extension;
  } catch (error) {
    if (activeMovie === movie) $("movie-status").textContent = "No pudimos cargar la ficha. Puedes reproducirla igualmente.";
  }
}

function updateMovieFavoriteButton() {
  if (!activeMovie) return;
  const favorite = readFavorites().some(row => row.favoriteId === favoriteId(activeMovie, "movie"));
  $("movie-favorite").textContent = favorite ? "★ GUARDADO" : "☆ FAVORITO";
}

async function showEpisodes(series) {
  setStatus("catalog-status", "Cargando episodios…");
  try {
    const seriesId = String(series.series_id || series.id);
    let info = seriesCache.get(seriesId);
    if (!info) {
      info = await callApi("get_series_info", "", seriesId);
      seriesCache.set(seriesId, info);
      while (seriesCache.size > 6) seriesCache.delete(seriesCache.keys().next().value);
    }
    const seasons = info && info.episodes;
    const episodes = [];
    if (Array.isArray(seasons)) episodes.push(...seasons);
    else if (seasons && typeof seasons === "object") {
      for (const season of Object.keys(seasons).sort((a, b) => Number(a) - Number(b))) {
        for (const episode of (Array.isArray(seasons[season]) ? seasons[season] : [])) episodes.push({ ...episode, _season: season });
      }
    }
    if (!episodes.length) throw new Error("No se encontraron episodios para esta serie.");
    state.series = series;
    state.episodes = episodes.map(episode => ({ ...episode, _seasonLabel: String(episode._season ?? episode.season ?? "1") }));
    const seasonSelect = $("season-picker");
    const seasonNames = [...new Set(state.episodes.map(episode => episode._seasonLabel))].sort((a, b) => Number(a) - Number(b));
    seasonSelect.replaceChildren();
    for (const season of seasonNames) {
      const option = document.createElement("option");
      option.value = season; option.textContent = "Temporada " + season; seasonSelect.append(option);
    }
    $("season-picker-label").hidden = seasonNames.length <= 1;
    renderEpisodes(seasonNames[0]);
    $("episodes-title").textContent = series.name || "Episodios";
    $("episodes-dialog").showModal();
    if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => {
      const firstEpisode = $("episode-list").querySelector("button");
      if (firstEpisode) firstEpisode.focus(); else $("season-picker").focus();
    });
    setStatus("catalog-status", "");
  } catch (error) { setStatus("catalog-status", error.message, "error"); }
}

function renderEpisodes(season) {
  const box = $("episode-list");
  box.replaceChildren();
  const episodes = state.episodes.filter(episode => episode._seasonLabel === season);
  const recentRows = readRecent().filter(row => state.parentalUnlocked || !isRestrictedCategory(row.category));
  episodes.forEach((episode, index) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "episode-button";
    const number = episode.episode_num ? "E" + episode.episode_num + " · " : "";
    const title = episode.title || episode.name || "Episodio " + (index + 1);
    const progress = recentRows.find(row => row.kind === "series" && row.id === String(episode.id));
    let suffix = "";
    if (progress?.duration > 0 && progress.position >= progress.duration * 0.9) suffix = " · VISTO";
    else if (progress?.duration > 0 && progress.position > 0) suffix = " · RETOMAR " + Math.round(progress.position / progress.duration * 100) + "%";
    button.textContent = number + title + suffix;
    if (suffix) button.classList.add("episode-progress-state");
    button.addEventListener("click", () => {
      $("episodes-dialog").close();
      const playlist = episodes.map(episode => ({ ...episode, name: episode.title || episode.name, category_name: state.series?.category_name, cover: state.series?.cover || state.series?.stream_icon }));
      playItems(playlist, "series", index);
    });
    box.append(button);
  });
}

document.querySelectorAll(".tab[data-kind]").forEach(button => button.addEventListener("click", () => {
  showBrowseKind(button.dataset.kind);
}));
$("home-tab").addEventListener("click", showHome);
$("home-brand").addEventListener("click", event => {
  if ($("catalog-view").hidden) return;
  event.preventDefault();
  showHome();
});
$("favorites-tab").addEventListener("click", showFavoritesView);
$("favorites-shortcut").addEventListener("click", showFavoritesView);
$("category").addEventListener("change", () => { $("search").value = ""; state.globalSearch = false; state.items = state.localItems; if (state.sportsMode) loadSportsItems($("category").value); else loadItems($("category").value); });
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchCatalog($("search").value), 350);
});
$("search").addEventListener("focus", () => {
  if ($("home-tab").classList.contains("active")) showBrowseKind(state.kind || "live");
});
$("voice-search").addEventListener("click", () => {
  if (bridge()?.startVoiceSearch) bridge().startVoiceSearch();
  else setStatus("catalog-status", "La búsqueda por voz requiere la app Android YOS Xtream y un servicio de reconocimiento instalado.");
});
$("diagnostics-open").addEventListener("click", () => { $("diagnostics-dialog").showModal(); runDiagnostics(); });
applyYosTheme(readYosTheme());
applyYosDensity(readYosDensity());
$("theme-open").addEventListener("click", () => {
  $("theme-dialog").showModal();
  requestAnimationFrame(() => document.querySelector('[data-theme-choice][aria-pressed="true"]')?.focus());
});
$("theme-close").addEventListener("click", () => $("theme-dialog").close());
$("theme-dialog").addEventListener("click", event => { if (event.target === $("theme-dialog")) $("theme-dialog").close(); });
document.querySelectorAll("[data-theme-choice]").forEach(button => button.addEventListener("click", () => {
  applyYosTheme(button.dataset.themeChoice);
  try { localStorage.setItem(YOS_THEME_KEY, button.dataset.themeChoice); } catch { /* La apariencia también funciona sin almacenamiento local. */ }
}));
$("density-open").addEventListener("click", () => {
  $("density-dialog").showModal();
  requestAnimationFrame(() => document.querySelector('[data-density-choice][aria-pressed="true"]')?.focus());
});
$("density-close").addEventListener("click", () => $("density-dialog").close());
$("density-dialog").addEventListener("click", event => { if (event.target === $("density-dialog")) $("density-dialog").close(); });
document.querySelectorAll("[data-density-choice]").forEach(button => button.addEventListener("click", () => {
  applyYosDensity(button.dataset.densityChoice);
  try { localStorage.setItem(YOS_DENSITY_KEY, button.dataset.densityChoice); } catch { /* El tamaño también funciona sin almacenamiento local. */ }
}));
$("diagnostics-close").addEventListener("click", () => $("diagnostics-dialog").close());
$("diagnostics-run").addEventListener("click", runDiagnostics);
$("diagnostics-dialog").addEventListener("click", event => { if (event.target === $("diagnostics-dialog")) $("diagnostics-dialog").close(); });
document.querySelectorAll(".shortcut[data-kind]").forEach(button => button.addEventListener("click", () => showBrowseKind(button.dataset.kind)));
$("home-favorites").addEventListener("click", showFavoritesView);
$("clear-recent").addEventListener("click", () => { saveRecent([]); renderRecent(); });
$("load-more").addEventListener("click", loadNextPage);
if ("IntersectionObserver" in window) {
  const loadMoreObserver = new IntersectionObserver(entries => {
    if (document.body.classList.contains("tv-remote") || document.visibilityState === "hidden") return;
    if (entries.some(entry => entry.isIntersecting) && !$("load-more").hidden) loadNextPage();
  }, { rootMargin: "520px 0px" });
  loadMoreObserver.observe($("load-more"));
}
$("close-episodes").addEventListener("click", () => $("episodes-dialog").close());
$("season-picker").addEventListener("change", () => renderEpisodes($("season-picker").value));
$("episodes-dialog").addEventListener("click", event => { if (event.target === $("episodes-dialog")) $("episodes-dialog").close(); });
$("close-movie").addEventListener("click", () => $("movie-dialog").close());
$("movie-dialog").addEventListener("click", event => { if (event.target === $("movie-dialog")) $("movie-dialog").close(); });
$("movie-play").addEventListener("click", () => { if (activeMovie) { $("movie-dialog").close(); playItems([activeMovie], "movie"); } });
$("movie-favorite").addEventListener("click", () => { if (activeMovie) { toggleFavorite(activeMovie, "movie"); updateMovieFavoriteButton(); } });
$("parental-control").addEventListener("click", openParentalDialog);
$("close-parental").addEventListener("click", closeParentalDialog);
$("parental-lock-now").addEventListener("click", () => {
  state.parentalUnlocked = false;
  closeParentalDialog();
  refreshAfterParentalChange();
  setStatus("catalog-status", "Categorías restringidas bloqueadas.", "ok");
});
$("parental-dialog").addEventListener("click", event => { if (event.target === $("parental-dialog")) closeParentalDialog(); });
$("parental-form").addEventListener("submit", async event => {
  event.preventDefault();
  const current = $("parental-current").value.trim();
  const nextPin = $("parental-new").value.trim();
  if (state.parentalMode !== "setup" && Date.now() < state.parentalBlockedUntil) {
    setStatus("parental-status", "Espera un momento antes de volver a intentarlo.", "error");
    return;
  }
  try {
    if (state.parentalMode === "setup") {
      if (!/^\d{4,8}$/.test(nextPin)) throw new Error("El PIN debe tener entre 4 y 8 números.");
      const newHash = await hashPin(nextPin);
      localStorage.setItem(parentalStoreKey(), newHash);
      state.parentalHash = newHash;
      state.parentalUnlocked = false;
      state.parentalFailures = 0;
      closeParentalDialog();
      refreshAfterParentalChange();
      setStatus("catalog-status", "PIN guardado. Las categorías restringidas quedan ocultas.", "ok");
      return;
    }
    if (await hashPin(current) !== state.parentalHash) {
      state.parentalFailures++;
      if (state.parentalFailures >= 5) { state.parentalFailures = 0; state.parentalBlockedUntil = Date.now() + 30000; }
      throw new Error("El PIN no coincide.");
    }
    state.parentalFailures = 0;
    if (state.parentalMode === "unlock") {
      state.parentalUnlocked = true;
      closeParentalDialog();
      refreshAfterParentalChange();
      setStatus("catalog-status", "Categorías restringidas visibles durante esta sesión.", "ok");
      return;
    }
    if (!/^\d{4,8}$/.test(nextPin)) throw new Error("El nuevo PIN debe tener entre 4 y 8 números.");
    const newHash = await hashPin(nextPin);
    localStorage.setItem(parentalStoreKey(), newHash);
    state.parentalHash = newHash;
    state.parentalUnlocked = true;
    closeParentalDialog();
    refreshAfterParentalChange();
    setStatus("catalog-status", "PIN actualizado.", "ok");
  } catch (error) { setStatus("parental-status", error.message || "No se pudo guardar el PIN.", "error"); }
});
$("logout").addEventListener("click", () => {
  cancelPendingApiRequests();
  if (bridge()) bridge().clearSavedCredentials();
  state.credentials = null; state.items = []; state.filtered = []; state.globalSearch = false; state.sportsMode = false; searchSequence++;
  state.parentalHash = ""; state.parentalUnlocked = false; $("parental-control").hidden = true;
  categoryCache.clear(); itemCache.clear(); seriesCache.clear();
  fallbackCatalogCache.clear();
  guideCache.clear(); guidePending.clear(); state.showFavorites = false;
  $("catalog-view").hidden = true; $("logout").hidden = true; $("login-view").hidden = false;
  renderRecent();
  $("server").value = ""; $("username").value = ""; $("password").value = ""; $("m3u-url").value = "";
  $("remember").checked = shouldPersistSession(); $("clear-saved").hidden = true; setHttpWarning();
  setStatus("login-status", "Sesión cerrada y cuenta eliminada de este dispositivo."); $("server").focus();
});
window.yosHandleBack = () => {
  if ($("theme-dialog").open) { $("theme-dialog").close(); return true; }
  if ($("density-dialog").open) { $("density-dialog").close(); return true; }
  if ($("parental-dialog").open) { closeParentalDialog(); return true; }
  if ($("diagnostics-dialog").open) { $("diagnostics-dialog").close(); return true; }
  if ($("movie-dialog").open) { $("movie-dialog").close(); return true; }
  if ($("episodes-dialog").open) { $("episodes-dialog").close(); return true; }
  if (!$("catalog-view").hidden) {
    const search = $("search");
    if (search.value) {
      searchSequence++;
      if (state.globalSearch) state.items = state.localItems;
      state.globalSearch = false;
      search.value = "";
      applySearch();
    }
    if (document.body.classList.contains("tv-remote")) {
      const tab = state.showFavorites ? $("favorites-tab") : document.querySelector('.tab[data-kind="' + (state.sportsMode ? "sports" : state.kind) + '"]');
      if (tab && document.activeElement !== tab) {
        tab.focus({ preventScroll: true });
        tab.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return true;
      }
    }
  }
  return false;
};

try {
  // Migra el perfil más reciente al almacén cifrado de Android antes de borrar
  // los perfiles antiguos, que guardaban contraseñas en texto sin cifrar.
  const currentAccount = readAccount(bridge()?.getSavedCredentials());
  if (!currentAccount.saved) {
    const legacy = JSON.parse(localStorage.getItem("yos-xtream-account-profiles-v1") || "{}");
    const removedIds = new Set((Array.isArray(legacy.removed) ? legacy.removed : []).map(String));
    const profiles = Array.isArray(legacy.profiles) ? legacy.profiles : [];
    const profile = [...profiles].reverse().find(item => item && item.id && !removedIds.has(String(item.id)) && item.server && item.username && item.password);
    const native = bridge();
    if (profile && native?.saveCredentials) {
      native.saveCredentials(profile.server, profile.username, profile.password, profile.playlistUrl || "", true);
    }
  }
  localStorage.removeItem("yos-xtream-account-profiles-v1");
} catch { /* El almacenamiento local puede estar desactivado. */ }

function configurePersistentSessionOption() {
  const native = bridge();
  if (typeof native?.supportsPersistentSession !== "function" || !native.supportsPersistentSession()) return;
  const remember = $("remember");
  remember.checked = true;
  remember.disabled = true;
  const text = remember.closest("label")?.querySelector("span");
  if (text) text.textContent = "Sesión cifrada hasta que pulses CERRAR SESIÓN";
  $("clear-saved").hidden = true;
}

function restoreSavedSession() {
  if (sessionRestoreInProgress) return false;
  if (!$('catalog-view').hidden) return false;
  const saved = readAccount(bridge()?.getSavedCredentials());
  if (!saved.saved) return false;
  savedPlaylistUrl = saved.playlistUrl || "";
  if (savedPlaylistUrl && !saved.username && String(saved.server || "").startsWith("m3u:")) {
    $("m3u-url").value = savedPlaylistUrl;
    setLoginMode("m3u");
  } else {
    $("server").value = saved.server || "";
    $("username").value = saved.username || "";
    $("password").value = saved.password || "";
  }
  $("remember").checked = true;
  $("clear-saved").hidden = true;
  setHttpWarning();
  sessionRestoreInProgress = true;
  setStatus("login-status", "Reconectando con tu sesión guardada…");
  setTimeout(() => {
    if (sessionRestoreInProgress) $("login-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }, 0);
  return true;
}

window.yosResumeSession = restoreSavedSession;
window.addEventListener("online", restoreSavedSession);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") restoreSavedSession();
});
configurePersistentSessionOption();
restoreSavedSession();

try {
  const nativeBridge = bridge();
  if (nativeBridge?.isTelevision()) {
    document.body.classList.add("tv-remote");
  }
  if (nativeBridge) {
    document.addEventListener("keydown", event => {
      const modeButton = event.target?.closest?.(".source-option");
      if (document.body.classList.contains("tv-remote") && modeButton) {
        const keyCode = event.keyCode || event.which;
        const isLeft = event.key === "ArrowLeft" || event.key === "DPAD_LEFT" || keyCode === 21;
        const isRight = event.key === "ArrowRight" || event.key === "DPAD_RIGHT" || keyCode === 22;
        const isSelect = ["Enter", " ", "Spacebar", "Select", "DPAD_CENTER", "NumpadEnter"].includes(event.key) || [23, 62, 66, 160].includes(keyCode);
        if (isLeft || isRight) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const next = isRight ? $("source-m3u") : $("source-xtream");
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
          return;
        }
        if (isSelect) {
          event.preventDefault();
          event.stopImmediatePropagation();
          modeButton.click();
          return;
        }
      }
      const keyCode = event.keyCode || event.which;
      const remoteKey = ({ 19: "ArrowUp", 20: "ArrowDown", 21: "ArrowLeft", 22: "ArrowRight" }[keyCode] || event.key);
      const direction = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1]
      }[remoteKey];
      const active = document.activeElement;
      const editing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
      if (!document.body.classList.contains("tv-remote")) return;
      if (direction && !editing) {
        const [dx, dy] = direction;
        const origin = active && active !== document.body ? active.getBoundingClientRect() : null;
        const cx = origin ? origin.left + origin.width / 2 : innerWidth / 2;
        const cy = origin ? origin.top + origin.height / 2 : innerHeight / 2;
        const selector = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";
        const activeDialog = active?.closest("dialog[open]");
        const activeGrid = active?.closest(".content-grid, .episode-list, .browse-shortcuts, .recent-grid");
        const scope = activeDialog || activeGrid;
        const collect = root => [...root.querySelectorAll(selector)]
          .filter(element => element !== active && !element.closest("[hidden],[inert]") && getComputedStyle(element).visibility !== "hidden")
          .map(element => ({ element, rect: element.getBoundingClientRect() }))
          .filter(candidate => candidate.rect.width > 0 && candidate.rect.height > 0);
        let candidates = scope ? collect(scope) : collect(document);
        let best = null;
        let bestScore = Infinity;
        for (const candidate of candidates) {
          const x = candidate.rect.left + candidate.rect.width / 2;
          const y = candidate.rect.top + candidate.rect.height / 2;
          const primary = dx ? (x - cx) * dx : (y - cy) * dy;
          if (primary < 5) continue;
          const cross = dx ? Math.abs(y - cy) : Math.abs(x - cx);
          const score = primary + cross * 1.7;
          if (score < bestScore) { best = candidate.element; bestScore = score; }
        }
        if (!best && scope && !activeDialog) {
          candidates = collect(document);
          for (const candidate of candidates) {
            const x = candidate.rect.left + candidate.rect.width / 2;
            const y = candidate.rect.top + candidate.rect.height / 2;
            const primary = dx ? (x - cx) * dx : (y - cy) * dy;
            if (primary < 5) continue;
            const cross = dx ? Math.abs(y - cy) : Math.abs(x - cx);
            const score = primary + cross * 1.7;
            if (score < bestScore) { best = candidate.element; bestScore = score; }
          }
        }
        if (best) {
          event.preventDefault();
          event.stopImmediatePropagation();
          best.focus({ preventScroll: true });
          best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
          document.querySelectorAll(".remote-focus").forEach(element => element.classList.remove("remote-focus"));
          best.classList.add("remote-focus");
          setTimeout(() => best.classList.remove("remote-focus"), 1100);
          return;
        }
      }
      if (event.key === "ChannelUp" || event.key === "ChannelDown") {
        const cards = [...document.querySelectorAll(".content-card")];
        const index = cards.indexOf(document.activeElement);
        if (index >= 0) { event.preventDefault(); cards[Math.max(0, Math.min(cards.length - 1, index + (event.key === "ChannelUp" ? -1 : 1)))].focus(); }
      }
    }, true);
  }
} catch { /* No hay bridge nativo en navegador normal. */ }

try {
  const nativeBridge = bridge();
  const savedAccount = readAccount(nativeBridge?.getSavedCredentials());
  if (nativeBridge?.isTelevision() && !savedAccount.saved && !$('login-view').hidden) {
    requestAnimationFrame(() => $("source-xtream").focus({ preventScroll: true }));
  }
} catch { /* El navegador puede no tener puente Android. */ }
