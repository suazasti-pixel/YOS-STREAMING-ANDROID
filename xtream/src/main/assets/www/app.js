"use strict";

const $ = id => document.getElementById(id);
const state = { credentials: null, kind: "live", categories: [], items: [], filtered: [], limit: 100, series: null };
const kinds = {
  live: { title: "Canales en vivo", categories: "get_live_categories", items: "get_live_streams", singular: "live" },
  movie: { title: "Películas", categories: "get_vod_categories", items: "get_vod_streams", singular: "movie" },
  series: { title: "Series", categories: "get_series_categories", items: "get_series", singular: "series" }
};
let requestSequence = 0;
const pending = new Map();

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

$("server").addEventListener("input", setHttpWarning);

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const server = $("server").value.trim().replace(/\/+$/, "");
  const username = $("username").value.trim();
  const password = $("password").value;
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
    $("login-view").hidden = true;
    $("catalog-view").hidden = false;
    $("logout").hidden = false;
    const exp = info.exp_date && /^\d+$/.test(String(info.exp_date)) ? new Date(Number(info.exp_date) * 1000).toLocaleDateString() : "";
    $("account-summary").textContent = "Cuenta conectada" + (exp ? " · Vence " + exp : "");
    setStatus("login-status", "");
    await loadCategories("live");
  } catch (error) {
    state.credentials = null;
    setStatus("login-status", error.message || "No se pudo conectar. Revisa servidor, usuario y contraseña.", "error");
  } finally { button.disabled = false; }
});

async function loadCategories(kind) {
  state.kind = kind;
  state.categories = [];
  state.items = [];
  state.filtered = [];
  state.limit = 100;
  $("catalog-title").textContent = kinds[kind].title;
  $("content-grid").replaceChildren();
  $("catalog-count").textContent = "";
  $("load-more").hidden = true;
  $("search").value = "";
  $("category").innerHTML = '<option value="">Cargando categorías…</option>';
  setStatus("catalog-status", "Cargando categorías…");
  try {
    const rows = await callApi(kinds[kind].categories);
    if (!Array.isArray(rows)) throw new Error("El proveedor devolvió categorías con formato no reconocido.");
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
    setStatus("catalog-status", rows.length ? "Elige una categoría para cargar el contenido." : "El proveedor no devolvió categorías para esta sección.");
  } catch (error) {
    $("category").innerHTML = '<option value="">Sin categorías</option>';
    setStatus("catalog-status", error.message, "error");
  }
}

async function loadItems(categoryId) {
  if (!categoryId) {
    state.items = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", "Elige una categoría para cargar el contenido.");
    return;
  }
  $("category").disabled = true;
  $("content-grid").replaceChildren();
  setStatus("catalog-status", "Cargando " + kinds[state.kind].title.toLowerCase() + "…");
  try {
    const rows = await callApi(kinds[state.kind].items, categoryId);
    if (!Array.isArray(rows)) throw new Error("El proveedor devolvió contenido con formato no reconocido.");
    state.items = rows;
    state.limit = 100;
    applySearch();
    setStatus("catalog-status", rows.length ? "Selecciona un elemento para reproducir." : "Esta categoría no tiene contenido.", rows.length ? "ok" : "");
    if (rows.length && document.body.classList.contains("tv-remote")) {
      requestAnimationFrame(() => document.querySelector(".content-card")?.focus());
    }
  } catch (error) {
    state.items = [];
    state.filtered = [];
    renderItems();
    setStatus("catalog-status", error.message, "error");
  } finally { $("category").disabled = false; }
}

function applySearch() {
  const q = $("search").value.trim().toLocaleLowerCase();
  state.filtered = q ? state.items.filter(item => String(item.name || "").toLocaleLowerCase().includes(q)) : [...state.items];
  state.limit = 100;
  renderItems();
}

function renderItems() {
  const box = $("content-grid");
  box.replaceChildren();
  const page = state.filtered.slice(0, state.limit);
  for (const item of page) {
    const button = document.createElement("button");
    button.className = "content-card";
    button.type = "button";
    const img = document.createElement("img");
    img.className = "poster";
    img.loading = "lazy";
    img.alt = "";
    img.src = item.stream_icon || item.cover || "";
    img.onerror = () => { const fallback = document.createElement("div"); fallback.className = "poster"; fallback.textContent = "Y"; img.replaceWith(fallback); };
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.name || "Sin título";
    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = item.category_name || (state.kind === "live" ? "TV en vivo" : state.kind === "movie" ? "Película" : "Serie");
    body.append(title, meta);
    button.append(img, body);
    button.addEventListener("click", () => selectItem(item));
    box.append(button);
  }
  $("catalog-count").textContent = state.filtered.length ? state.filtered.length + " elementos" : "";
  $("load-more").hidden = page.length >= state.filtered.length;
}

function streamUrl(kind, item) {
  const c = state.credentials;
  const route = kind === "live" ? "live" : kind === "movie" ? "movie" : "series";
  const id = kind === "live" ? item.stream_id : kind === "movie" ? item.stream_id : item.id;
  let extension = String(item.container_extension || (kind === "live" ? "m3u8" : "mp4")).replace(/^\./, "");
  if (!/^[a-z0-9]{1,8}$/i.test(extension)) extension = kind === "live" ? "m3u8" : "mp4";
  return c.server + "/" + route + "/" + encodeURIComponent(c.username) + "/" + encodeURIComponent(c.password) + "/" + encodeURIComponent(String(id)) + "." + extension;
}

function playItems(items, kind, index = 0) {
  const queue = items.map(item => ({ url: streamUrl(kind, item), name: item.title || item.name || "YOS Xtream" }));
  if (!queue.length) return;
  const selected = queue[Math.max(0, Math.min(index, queue.length - 1))];
  if (bridge()) bridge().playNative(selected.url, selected.name, JSON.stringify(queue), Math.max(0, Math.min(index, queue.length - 1)));
  else setStatus("catalog-status", "La reproducción está disponible en el APK Android/TV Box.");
}

async function selectItem(item) {
  if (state.kind === "series") return showEpisodes(item);
  const streamKey = state.kind === "live" ? "stream_id" : "stream_id";
  const queueItems = state.filtered.filter(row => row[streamKey] != null);
  const index = queueItems.findIndex(row => String(row[streamKey]) === String(item[streamKey]));
  playItems(queueItems, state.kind, Math.max(0, index));
}

async function showEpisodes(series) {
  setStatus("catalog-status", "Cargando episodios…");
  try {
    const info = await callApi("get_series_info", "", series.series_id || series.id);
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
    button.addEventListener("click", () => { $("episodes-dialog").close(); playItems(episodes, "series", index); });
    box.append(button);
  });
}

document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
  loadCategories(button.dataset.kind);
}));
$("category").addEventListener("change", () => loadItems($("category").value));
$("search").addEventListener("input", applySearch);
$("load-more").addEventListener("click", () => { state.limit += 100; renderItems(); });
$("close-episodes").addEventListener("click", () => $("episodes-dialog").close());
$("episodes-dialog").addEventListener("click", event => { if (event.target === $("episodes-dialog")) $("episodes-dialog").close(); });
$("logout").addEventListener("click", () => {
  state.credentials = null; state.items = []; state.filtered = [];
  $("catalog-view").hidden = true; $("logout").hidden = true; $("login-view").hidden = false;
  $("password").value = ""; setStatus("login-status", "Sesión cerrada."); $("server").focus();
});
$("clear-saved").addEventListener("click", () => {
  if (bridge()) bridge().clearSavedCredentials();
  $("server").value = ""; $("username").value = ""; $("password").value = "";
  $("remember").checked = false; $("clear-saved").hidden = true; setHttpWarning();
  setStatus("login-status", "Cuenta guardada eliminada.");
});

window.yosHandleBack = () => {
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
