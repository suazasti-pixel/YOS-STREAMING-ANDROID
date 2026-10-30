"use strict";

const $ = id => document.getElementById(id);
const PAGE_SIZE = 60;
const ITEM_CACHE_LIMIT = 3;
const state = { credentials: null, kind: "live", categories: [], items: [], localItems: [], filtered: [], limit: PAGE_SIZE, series: null, movie: null, showFavorites: false, globalSearch: false };
const kinds = {
  live: { title: "Canales en vivo", categories: "get_live_categories", items: "get_live_streams", singular: "live" },
  movie: { title: "Películas", categories: "get_vod_categories", items: "get_vod_streams", singular: "movie" },
  series: { title: "Series", categories: "get_series_categories", items: "get_series", singular: "series" }
};
let requestSequence = 0;
let categoryRequestSequence = 0;
let itemRequestSequence = 0;
let searchTimer = 0;
let searchSequence = 0;
let guideTimer = 0;
let guideRequestSequence = 0;
const pending = new Map();
const categoryCache = new Map();
const itemCache = new Map();
const seriesCache = new Map();
const guideCache = new Map();
const guidePending = new Map();

function cacheItems(key, rows) {
  itemCache.delete(key);
  itemCache.set(key, rows);
  while (itemCache.size > ITEM_CACHE_LIMIT) itemCache.delete(itemCache.keys().next().value);
}

function providerStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-favorites-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function historyStoreKey() {
  const account = state.credentials;
  return account ? "yos-xtream-recent-v1:" + encodeURIComponent(account.server + "|" + account.username) : "";
}

function readRecent() {
  try {
    const key = historyStoreKey();
    const rows = key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function saveRecent(rows) {
  try { const key = historyStoreKey(); if (key) localStorage.setItem(key, JSON.stringify(rows.slice(0, 16))); }
  catch { /* El historial es opcional si el almacenamiento está lleno. */ }
}

function renderRecent() {
  const rows = readRecent();
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
  const kind = row.kind || "live";
  const item = {
    id: row.id, stream_id: row.id, name: row.title, title: row.title,
    container_extension: row.extension, category_name: row.category,
    stream_icon: row.cover, cover: row.cover, _kind: kind
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
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function saveFavorites(rows) {
  const key = providerStoreKey();
  try { if (key) localStorage.setItem(key, JSON.stringify(rows)); }
  catch { setStatus("catalog-status", "No se pudieron guardar los favoritos en este dispositivo.", "error"); }
}

function makeFavorite(item, kind) {
  return {
    favoriteId: favoriteId(item, kind), _kind: kind,
    stream_id: item.stream_id, series_id: item.series_id, id: item.id,
    container_extension: item.container_extension, name: item.name || item.title || "Sin título",
    category_name: item.category_name, stream_icon: item.stream_icon, cover: item.cover
  };
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
  searchSequence++;
  state.showFavorites = true;
  state.globalSearch = false;
  state.items = [];
  state.filtered = readFavorites();
  state.limit = PAGE_SIZE;
  $("search").value = "";
  $("favorites-tab").classList.add("active");
  document.querySelectorAll(".tab[data-kind]").forEach(tab => tab.classList.remove("active"));
  $("category").closest(".filters").classList.add("favorites-mode");
  $("catalog-title").textContent = "Favoritos";
  $("guide-panel").hidden = true;
  setStatus("catalog-status", state.filtered.length ? "Tus canales, películas y series guardados." : "Agrega favoritos con ☆ en una tarjeta.");
  applySearch();
}

function showBrowseKind(kind) {
  document.querySelectorAll(".tab[data-kind]").forEach(tab => tab.classList.toggle("active", tab.dataset.kind === kind));
  loadCategories(kind);
  document.querySelector(".tabs")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

function readAccount(raw) {
  try { return JSON.parse(raw || "{}"); }
  catch { return {}; }
}

function setHttpWarning() {
  const value = $("server").value.trim();
  $("http-warning").hidden = !/^http:\/\//i.test(value);
}

function readConnectionFields() {
  let server = $("server").value.trim().replace(/\/+$/, "");
  let username = $("username").value.trim();
  let password = $("password").value;
  try {
    const parsed = new URL(server);
    if (/\/get\.php\/?$/i.test(parsed.pathname)) {
      const linkUsername = parsed.searchParams.get("username");
      const linkPassword = parsed.searchParams.get("password");
      if (!linkUsername || !linkPassword) {
        throw new Error("El enlace get.php debe incluir username y password.");
      }
      const basePath = parsed.pathname.replace(/\/get\.php\/?$/i, "").replace(/\/+$/, "");
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
  return { server, username, password };
}

$("server").addEventListener("input", setHttpWarning);

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  let connection;
  try { connection = readConnectionFields(); }
  catch (error) { setStatus("login-status", error.message, "error"); return; }
  const { server, username, password } = connection;
  if (!/^https?:\/\/[^/]+(?::\d+)?(?:\/[^?#]*)?$/i.test(server)) {
    setStatus("login-status", "Escribe el servidor con http:// o https:// y su puerto si aplica.", "error");
    return;
  }
  if (!username || !password) return;
  const button = $("login-button");
  button.disabled = true;
  setStatus("login-status", "Conectando con el proveedor…");
  state.credentials = { server, username, password };
  try {
    const auth = await callApi();
    const info = auth && auth.user_info;
    if (!info || String(info.auth) !== "1") throw new Error("El proveedor no autenticó esta cuenta o no ofrece una API Xtream compatible.");
    if (info.status && !/^active$/i.test(String(info.status))) throw new Error("La cuenta aparece como " + info.status + ".");
    const stored = bridge().saveCredentials(server, username, password, $("remember").checked);
    const storageResult = readAccount(stored);
    if (!storageResult.ok) throw new Error(storageResult.error || "No se pudieron guardar las credenciales.");
    categoryCache.clear();
    itemCache.clear();
    seriesCache.clear();
    guideCache.clear();
    guidePending.clear();
    $("login-view").hidden = true;
    $("catalog-view").hidden = false;
    $("logout").hidden = false;
    const exp = info.exp_date && /^\d+$/.test(String(info.exp_date)) ? new Date(Number(info.exp_date) * 1000).toLocaleDateString() : "";
    $("account-summary").textContent = "Cuenta conectada" + (exp ? " · Vence " + exp : "");
    renderRecent();
    setStatus("login-status", "");
    await loadCategories("live");
  } catch (error) {
    state.credentials = null;
    setStatus("login-status", error.message || "No se pudo conectar. Revisa servidor, usuario y contraseña.", "error");
  } finally { button.disabled = false; }
});

async function loadCategories(kind) {
  searchSequence++;
  const requestId = ++categoryRequestSequence;
  itemRequestSequence++;
  state.kind = kind;
  state.showFavorites = false;
  state.globalSearch = false;
  $("favorites-tab").classList.remove("active");
  $("category").closest(".filters").classList.remove("favorites-mode");
  $("guide-panel").hidden = true;
  state.categories = [];
  state.items = [];
  state.localItems = [];
  state.filtered = [];
  state.limit = PAGE_SIZE;
  $("catalog-title").textContent = kinds[kind].title;
  $("content-grid").replaceChildren();
  $("catalog-count").textContent = "";
  $("load-more").hidden = true;
  $("search").value = "";
  $("category").disabled = false;
  const cachedRows = categoryCache.get(kind);
  if (cachedRows) {
    showCategories(kind, cachedRows);
    setStatus("catalog-status", cachedRows.length ? "Elige una categoría para cargar el contenido." : "El proveedor no devolvió categorías para esta sección.");
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
    setStatus("catalog-status", rows.length ? "Elige una categoría para cargar el contenido." : "El proveedor no devolvió categorías para esta sección.");
  } catch (error) {
    if (requestId !== categoryRequestSequence) return;
    $("category").innerHTML = '<option value="">Sin categorías</option>';
    setStatus("catalog-status", error.message, "error");
  }
}

function showCategories(kind, rows) {
  state.categories = rows;
  $("category").innerHTML = '<option value="">Selecciona una categoría</option>';
  for (const row of rows) {
    if (!row || row.category_id == null) continue;
    const option = document.createElement("option");
    option.value = String(row.category_id);
    option.textContent = row.category_name || "Categoría";
    $("category").append(option);
  }
  if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => $("category").focus());
}

async function loadItems(categoryId) {
  searchSequence++;
  if (!categoryId) {
    state.items = [];
    state.localItems = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", "Elige una categoría para cargar el contenido.");
    return;
  }
  const kind = state.kind;
  const requestId = ++itemRequestSequence;
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
  try {
    const rows = await callApi(kinds[kind].items, categoryId);
    if (requestId !== itemRequestSequence || state.kind !== kind || $("category").value !== String(categoryId)) return;
    if (!Array.isArray(rows)) throw new Error("El proveedor devolvió contenido con formato no reconocido.");
    cacheItems(cacheKey, rows);
    state.items = rows;
    state.localItems = rows;
    state.limit = PAGE_SIZE;
    applySearch();
    setStatus("catalog-status", rows.length ? "Selecciona un elemento para reproducir." : "Esta categoría no tiene contenido.", rows.length ? "ok" : "");
    if (rows.length && document.body.classList.contains("tv-remote")) {
      requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
    }
  } catch (error) {
    if (requestId !== itemRequestSequence || state.kind !== kind) return;
    state.items = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", error.message, "error");
  } finally { if (requestId === itemRequestSequence) $("category").disabled = false; }
}

function applySearch() {
  const q = $("search").value.trim().toLocaleLowerCase();
  const source = state.showFavorites ? readFavorites() : state.items;
  state.filtered = q ? source.filter(item => String(item.name || "").toLocaleLowerCase().includes(q)) : [...source];
  state.limit = PAGE_SIZE;
  renderItems();
}

async function searchCatalog(query) {
  const requestId = ++searchSequence;
  const kind = state.kind;
  const q = query.trim().toLocaleLowerCase();
  if (q.length < 2 || state.showFavorites) {
    if (state.globalSearch && !state.showFavorites) state.items = state.localItems;
    state.globalSearch = false;
    applySearch();
    if (q.length === 1 && !state.showFavorites) setStatus("catalog-status", "Escribe al menos 2 caracteres para buscar en todo el catálogo.");
    return;
  }
  if (!state.categories.length) { setStatus("catalog-status", "Espera a que carguen las categorías para buscar."); return; }
  state.globalSearch = true;
  state.items = [];
  state.filtered = [];
  state.limit = PAGE_SIZE;
  renderItems();
  const categories = state.categories.filter(row => row && row.category_id != null);
  let next = 0;
  let checked = 0;
  const found = new Map();
  setStatus("catalog-status", "Buscando en " + categories.length + " categorías…");
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
        for (const item of items) {
          if (String(item.name || item.title || "").toLocaleLowerCase().includes(q)) {
            const id = kind === "series" ? (item.series_id || item.id) : item.stream_id;
            if (id != null) found.set(String(id), { ...item, _kind: kind, category_name: item.category_name || row.category_name });
          }
        }
      } catch { /* Una categoría caída no impide buscar en las demás. */ }
      checked++;
      if (requestId === searchSequence) setStatus("catalog-status", "Revisando " + checked + " de " + categories.length + " categorías… " + found.size + " resultados.");
    }
  };
  await Promise.all([worker(), worker()]);
  if (requestId !== searchSequence || state.kind !== kind) return;
  state.items = [...found.values()];
  state.filtered = state.items;
  state.limit = PAGE_SIZE;
  renderItems();
  setStatus("catalog-status", state.filtered.length ? "Resultados en todo el catálogo." : "No encontramos coincidencias en este tipo de contenido.", state.filtered.length ? "ok" : "");
  if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
}

function renderItems() {
  const box = $("content-grid");
  box.replaceChildren();
  const page = state.filtered.slice(0, state.limit);
  const favoriteIds = new Set(readFavorites().map(row => row.favoriteId));
  if (!page.length) {
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
    const posterUrl = item.stream_icon || item.cover || "";
    let poster;
    if (/^https?:\/\//i.test(posterUrl)) {
      const img = document.createElement("img");
      img.className = "poster";
      img.loading = "lazy";
      img.decoding = "async";
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
    meta.textContent = item.category_name || (kind === "live" ? "TV en vivo" : kind === "movie" ? "Película" : "Serie");
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
    box.append(wrapper);
  }
  $("catalog-count").textContent = state.filtered.length ? state.filtered.length + " elementos" : "";
  $("load-more").hidden = page.length >= state.filtered.length;
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
  } catch {
    if (requestId !== guideRequestSequence) return;
    $("guide-now").textContent = "Guía no disponible para este canal.";
    $("guide-next").textContent = "La reproducción del canal sigue disponible.";
  }
}

function streamUrl(kind, item) {
  const c = state.credentials;
  const route = kind === "live" ? "live" : kind === "movie" ? "movie" : "series";
  const id = kind === "live" ? item.stream_id : kind === "movie" ? item.stream_id : item.id;
  let extension = String(item.container_extension || (kind === "live" ? "m3u8" : "mp4")).replace(/^\./, "");
  if (!/^[a-z0-9]{1,8}$/i.test(extension)) extension = kind === "live" ? "m3u8" : "mp4";
  return c.server + "/" + route + "/" + encodeURIComponent(c.username) + "/" + encodeURIComponent(c.password) + "/" + encodeURIComponent(String(id)) + "." + extension;
}

function playItems(items, kind, index = 0, resumePosition = 0) {
  const queue = items.map(item => {
    const id = kind === "series" ? (item.id || item.stream_id || item.series_id) : item.stream_id;
    return {
      url: streamUrl(kind, item), name: item.title || item.name || "YOS Xtream", kind,
      id: String(id == null ? "" : id), category: item.category_name || "",
      extension: item.container_extension || (kind === "live" ? "m3u8" : "mp4"),
      cover: item.stream_icon || item.cover || ""
    };
  });
  if (!queue.length) return;
  const selected = queue[Math.max(0, Math.min(index, queue.length - 1))];
  const recent = readRecent().find(row => row.kind === kind && row.id === selected.id);
  const startAt = resumePosition || (kind !== "live" && recent ? Number(recent.position) || 0 : 0);
  if (bridge()) bridge().playNative(selected.url, selected.name, JSON.stringify(queue), Math.max(0, Math.min(index, queue.length - 1)), startAt);
  else setStatus("catalog-status", "La reproducción está disponible en el APK Android/TV Box.");
}

window.yosPlaybackFinished = raw => {
  try {
    const playback = JSON.parse(raw || "{}");
    if (!playback.id || !playback.title) return;
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
  } catch { /* Los datos del player no son necesarios para seguir navegando. */ }
};

async function selectItem(item) {
  const kind = item._kind || state.kind;
  if (kind === "live") showProgramGuide(item);
  if (kind === "series") return showEpisodes(item);
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
    renderEpisodes(episodes);
    $("episodes-title").textContent = series.name || "Episodios";
    $("episodes-dialog").showModal();
    if (document.body.classList.contains("tv-remote")) requestAnimationFrame(() => $("episode-list").querySelector("button")?.focus());
    setStatus("catalog-status", "");
  } catch (error) { setStatus("catalog-status", error.message, "error"); }
}

function renderEpisodes(episodes) {
  const box = $("episode-list");
  box.replaceChildren();
  let lastSeason = null;
  episodes.forEach((episode, index) => {
    if (episode._season !== lastSeason) {
      lastSeason = episode._season;
      if (lastSeason != null) {
        const label = document.createElement("div"); label.className = "season-title"; label.textContent = "TEMPORADA " + lastSeason; box.append(label);
      }
    }
    const button = document.createElement("button");
    button.type = "button"; button.className = "episode-button";
    button.textContent = (episode.episode_num ? "E" + episode.episode_num + " · " : "") + (episode.title || episode.name || "Episodio " + (index + 1));
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
$("favorites-tab").addEventListener("click", showFavoritesView);
$("category").addEventListener("change", () => { $("search").value = ""; state.globalSearch = false; state.items = state.localItems; loadItems($("category").value); });
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchCatalog($("search").value), 350);
});
document.querySelectorAll(".shortcut[data-kind]").forEach(button => button.addEventListener("click", () => showBrowseKind(button.dataset.kind)));
$("home-favorites").addEventListener("click", showFavoritesView);
$("clear-recent").addEventListener("click", () => { saveRecent([]); renderRecent(); });
$("load-more").addEventListener("click", () => { state.limit += PAGE_SIZE; renderItems(); });
$("close-episodes").addEventListener("click", () => $("episodes-dialog").close());
$("episodes-dialog").addEventListener("click", event => { if (event.target === $("episodes-dialog")) $("episodes-dialog").close(); });
$("close-movie").addEventListener("click", () => $("movie-dialog").close());
$("movie-dialog").addEventListener("click", event => { if (event.target === $("movie-dialog")) $("movie-dialog").close(); });
$("movie-play").addEventListener("click", () => { if (activeMovie) { $("movie-dialog").close(); playItems([activeMovie], "movie"); } });
$("movie-favorite").addEventListener("click", () => { if (activeMovie) { toggleFavorite(activeMovie, "movie"); updateMovieFavoriteButton(); } });
$("logout").addEventListener("click", () => {
  state.credentials = null; state.items = []; state.filtered = []; state.globalSearch = false; searchSequence++;
  categoryCache.clear(); itemCache.clear(); seriesCache.clear();
  guideCache.clear(); guidePending.clear(); state.showFavorites = false;
  $("catalog-view").hidden = true; $("logout").hidden = true; $("login-view").hidden = false;
  renderRecent();
  $("password").value = ""; setStatus("login-status", "Sesión cerrada."); $("server").focus();
});
$("clear-saved").addEventListener("click", () => {
  if (bridge()) bridge().clearSavedCredentials();
  $("server").value = ""; $("username").value = ""; $("password").value = "";
  $("remember").checked = false; $("clear-saved").hidden = true; setHttpWarning();
  setStatus("login-status", "Cuenta guardada eliminada.");
});

window.yosHandleBack = () => {
  if ($("movie-dialog").open) { $("movie-dialog").close(); return true; }
  if ($("episodes-dialog").open) { $("episodes-dialog").close(); return true; }
  if (!$("catalog-view").hidden) { $("logout").click(); return true; }
  return false;
};

try {
  const saved = readAccount(bridge()?.getSavedCredentials());
  if (saved.saved) {
    $("server").value = saved.server || "";
    $("username").value = saved.username || "";
    $("password").value = saved.password || "";
    $("remember").checked = true;
    $("clear-saved").hidden = false;
    setHttpWarning();
    setStatus("login-status", "Cuenta recordada en este dispositivo.");
  }
} catch { /* La versión web sin puente nativo no restaura credenciales. */ }

try {
  if (bridge()?.isTelevision()) {
    document.body.classList.add("tv-remote");
    document.addEventListener("keydown", event => {
      const direction = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1]
      }[event.key];
      const active = document.activeElement;
      const editing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
      if (direction && !editing) {
        const [dx, dy] = direction;
        const origin = active && active !== document.body ? active.getBoundingClientRect() : null;
        const cx = origin ? origin.left + origin.width / 2 : innerWidth / 2;
        const cy = origin ? origin.top + origin.height / 2 : innerHeight / 2;
        const candidates = [...document.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])")]
          .filter(element => element !== active && !element.closest("[hidden],[inert]") && getComputedStyle(element).visibility !== "hidden")
          .map(element => ({ element, rect: element.getBoundingClientRect() }))
          .filter(candidate => candidate.rect.width > 0 && candidate.rect.height > 0);
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
