const DEFAULT_M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";
const SOURCES_KEY = "yos-sources-v1";
const FAVORITES_KEY = "yos-favorites-v1";

const $ = id => document.getElementById(id);
const channelList = $("channel-list");
const channelCount = $("channel-count");
const searchInput = $("search");
const playlistInput = $("playlist-url");
const loadButton = $("load-playlist");
const video = $("video");
const placeholder = $("player-placeholder");
const title = $("channel-title");
const description = $("channel-description");
const message = $("load-message");
const playerMessage = $("player-message");
const favoritesList = $("favorites-list");
const countryFilter = $("country-filter");
const categoryFilter = $("category-filter");
const sortFilter = $("sort-filter");
const sourceStatus = $("source-status");
const adminDialog = $("admin-dialog");

let channels = [];
let hlsPlayer = null;
let currentChannel = null;
let activeSourceUrl = DEFAULT_M3U_URL;
let loadingMode = "replace";
let activeMediaType = "live";

function getFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveFavorites(value) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(value)); }

function getSources() {
  try {
    const value = JSON.parse(localStorage.getItem(SOURCES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveSources(sources) { localStorage.setItem(SOURCES_KEY, JSON.stringify(sources)); }

function detectMediaType(name, category, url, forcedType = "auto") {
  if (["live", "movie", "series"].includes(forcedType)) return forcedType;
  const haystack = `${name} ${category} ${url}`.toLocaleLowerCase();
  if (/\b(series|serie|series tv|tv shows|season|temporada|episodio|episode|s\d{1,2}\s?e\d{1,2})\b/.test(haystack)) return "series";
  if (/\b(movie|movies|pelicula|peliculas|película|películas|film|films|vod|cinema|cine)\b/.test(haystack)) return "movie";
  // Enlaces de vídeo bajo demanda suelen tener extensiones de archivo; .m3u8 se mantiene como TV por defecto.
  if (/\.(mp4|mkv|avi|mov|wmv)(\?|$)/i.test(url)) return "movie";
  return "live";
}

function parseM3U(text, forcedType = "auto") {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const result = [];
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const comma = line.indexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : "";
      const attrsPart = comma >= 0 ? line.slice(0, comma) : line;
      const attrs = {};
      const regex = /([\w-]+)="([^"]*)"/g;
      let match;
      while ((match = regex.exec(attrsPart)) !== null) attrs[match[1]] = match[2];
      pending = {
        name: name || attrs["tvg-name"] || "Contenido sin nombre",
        logo: attrs["tvg-logo"] || "",
        country: attrs["tvg-country"] || attrs["country"] || "Internacional",
        category: attrs["group-title"] || attrs["category"] || "General",
        url: "",
        contentType: "live"
      };
    } else if (line.startsWith("#")) {
      continue;
    } else if (pending && /^https?:\/\//i.test(line)) {
      pending.url = line;
      pending.contentType = detectMediaType(pending.name, pending.category, line, forcedType);
      pending.id = `${pending.name}::${line}`;
      result.push(pending);
      pending = null;
    }
  }
  return result;
}

function setStatus(kind, text) {
  sourceStatus.className = `source-status ${kind || ""}`;
  sourceStatus.innerHTML = `<i></i>${escapeHtml(text)}`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function fillSelect(select, values, defaultLabel) {
  const previous = select.value;
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = defaultLabel;
  select.appendChild(all);
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if (values.includes(previous)) select.value = previous;
}
function updateFilters() {
  const countries = [...new Set(channels.map(c => c.country).filter(v => v && v !== "Internacional"))].sort((a,b)=>a.localeCompare(b));
  const categories = [...new Set(channels.map(c => c.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  fillSelect(countryFilter, countries, "Todos los países");
  fillSelect(categoryFilter, categories, "Todas las categorías");
  countryFilter.disabled = !channels.length;
  categoryFilter.disabled = !channels.length;
  searchInput.disabled = !channels.length;
}

async function loadPlaylist(urlOverride, mode = "replace", typeOverride = "auto") {
  const url = (urlOverride || playlistInput.value).trim();
  loadingMode = mode;
  if (!url) { message.textContent = "Escribe la dirección de una lista M3U."; return; }
  try {
    new URL(url);
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("La dirección debe comenzar con http:// o https://.");
  } catch (error) {
    message.textContent = error.message || "La dirección de la lista no es válida.";
    return;
  }
  loadButton.disabled = true;
  $("append-playlist").disabled = true;
  loadButton.textContent = "Cargando…";
  $("append-playlist").textContent = "Cargando…";
  message.textContent = mode === "append" ? "Añadiendo canales de la nueva lista…" : "Descargando y procesando la lista M3U…";
  if (!channels.length) {
    channelCount.textContent = "…";
    channelList.innerHTML = '<p class="empty-message">Cargando canales…</p>';
  }
  setStatus("", "Conectando");
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`El servidor respondió HTTP ${response.status}.`);
    const text = await response.text();
    if (!text.trim().startsWith("#EXTM3U") && !text.includes("#EXTINF:")) {
      throw new Error("La respuesta no parece ser una lista M3U válida.");
    }
    const parsed = parseM3U(text, typeOverride);
    if (!parsed.length) throw new Error("No se encontraron canales con direcciones HTTP en la lista.");
    if (mode === "append") {
      const existing = new Set(channels.map(channel => `${channel.name}||${channel.url}`));
      const additions = parsed.filter(channel => !existing.has(`${channel.name}||${channel.url}`));
      channels = [...channels, ...additions];
      message.textContent = `Añadidos ${additions.length.toLocaleString("es-CO")} canales nuevos. Total: ${channels.length.toLocaleString("es-CO")}.`;
    } else {
      channels = parsed;
      message.textContent = `Lista cargada: ${channels.length.toLocaleString("es-CO")} canales encontrados.`;
    }
    activeSourceUrl = url;
    playlistInput.value = url;
    updateFilters();
    renderChannels();
    renderFavorites();
    playerMessage.textContent = "Selecciona un canal para reproducirlo.";
    $("last-updated").textContent = `Actualizada: ${new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}`;
    setStatus("online", "Lista cargada");
    renderSavedSources();
  } catch (error) {
    console.error("YOS: error al cargar M3U:", error);
    const errorText = error instanceof TypeError
      ? "No se pudo descargar la lista desde el navegador. Puede ser un bloqueo CORS o un problema de red. Revisa F12 > Console."
      : error.message;
    if (mode === "append" && channels.length) {
      renderChannels();
      message.textContent = `No se pudo añadir esa fuente. Se conservan los ${channels.length.toLocaleString("es-CO")} canales que ya estaban cargados. ${errorText}`;
    } else {
      channelList.replaceChildren();
      const notice = document.createElement("p");
      notice.className = "empty-message";
      notice.textContent = errorText;
      channelList.appendChild(notice);
      channelCount.textContent = "Error";
      message.textContent = notice.textContent;
    }
    setStatus("error", "No se pudo cargar");
  } finally {
    loadButton.disabled = false;
    $("append-playlist").disabled = false;
    loadButton.textContent = "↻ Reemplazar lista";
    $("append-playlist").textContent = "＋ Añadir canales";
  }
}

function filteredChannels() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let list = channels.filter(channel => {
    const matchesMedia = activeMediaType === "all" || (channel.contentType || "live") === activeMediaType;
    const matchesQuery = `${channel.name} ${channel.country} ${channel.category}`.toLocaleLowerCase().includes(query);
    const matchesCountry = !countryFilter.value || channel.country === countryFilter.value;
    const matchesCategory = !categoryFilter.value || channel.category === categoryFilter.value;
    return matchesMedia && matchesQuery && matchesCountry && matchesCategory;
  });
  const sort = sortFilter.value;
  list.sort((a,b) => {
    const av = (a[sort] || a.name || "").toLocaleLowerCase();
    const bv = (b[sort] || b.name || "").toLocaleLowerCase();
    return av.localeCompare(bv);
  });
  return list;
}

function renderChannels() {
  const filtered = filteredChannels();
  channelCount.textContent = filtered.length.toLocaleString("es-CO");
  channelList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = channels.length ? "No hay contenido de este tipo en las listas cargadas. Prueba “Todo” o guarda una lista como Películas o Series." : "Carga una lista M3U para ver el contenido.";
    channelList.appendChild(empty);
    return;
  }
  const favorites = getFavorites();
  const fragment = document.createDocumentFragment();
  for (const channel of filtered.slice(0, 400)) {
    const item = document.createElement("div");
    item.className = "channel-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Reproducir ${channel.name}`);
    if (currentChannel?.id === channel.id) item.classList.add("active");

    const icon = document.createElement("div");
    icon.className = "channel-icon";
    if (channel.logo) {
      const img = document.createElement("img");
      img.src = channel.logo; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.onerror = () => { icon.replaceChildren(); icon.textContent = channel.name.slice(0,2).toUpperCase(); };
      icon.appendChild(img);
    } else icon.textContent = channel.name.slice(0,2).toUpperCase();

    const details = document.createElement("div");
    details.className = "channel-details";
    const name = document.createElement("strong"); name.textContent = channel.name;
    const meta = document.createElement("small"); meta.textContent = `${channel.country} · ${channel.category}`;
    details.append(name, meta);

    const fav = document.createElement("button");
    fav.type = "button"; fav.className = "favorite-button";
    fav.textContent = favorites.includes(channel.id) ? "★" : "☆";
    fav.classList.toggle("selected", favorites.includes(channel.id));
    fav.setAttribute("aria-label", `Favorito: ${channel.name}`);
    fav.addEventListener("click", event => {
      event.stopPropagation();
      const current = getFavorites();
      const idx = current.indexOf(channel.id);
      if (idx >= 0) current.splice(idx,1); else current.push(channel.id);
      saveFavorites(current); renderChannels(); renderFavorites();
    });
    const choose = () => playChannel(channel);
    item.addEventListener("click", choose);
    item.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); } });
    item.append(icon, details, fav);
    fragment.appendChild(item);
  }
  channelList.appendChild(fragment);
  if (filtered.length > 400) {
    const notice = document.createElement("p");
    notice.className = "empty-message";
    notice.textContent = `Mostrando 400 de ${filtered.length.toLocaleString("es-CO")} canales. Usa los filtros para localizar otros.`;
    channelList.appendChild(notice);
  }
}

function stopPlayer() {
  if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
  video.pause(); video.removeAttribute("src"); video.load();
}
function playChannel(channel) {
  currentChannel = channel;
  title.textContent = channel.name;
  description.textContent = `${channel.country} · ${channel.category}`;
  const icon = $("current-icon");
  icon.textContent = channel.name.slice(0,1).toUpperCase();
  icon.style.backgroundImage = "";
  if (channel.logo) {
    icon.textContent = "";
    icon.style.backgroundImage = `url("${channel.logo.replace(/["\\]/g,"")}")`;
    icon.style.backgroundSize = "contain";
    icon.style.backgroundPosition = "center";
    icon.style.backgroundRepeat = "no-repeat";
  }
  stopPlayer();
  placeholder.style.display = "none";
  video.style.display = "block";
  playerMessage.textContent = "Conectando con el canal…";

  if (window.Hls && Hls.isSupported()) {
    hlsPlayer = new Hls({ enableWorker: true });
    hlsPlayer.loadSource(channel.url);
    hlsPlayer.attachMedia(video);
    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
      playerMessage.textContent = "Transmisión preparada. Pulsa reproducir si no inicia automáticamente.";
      video.play().catch(() => {});
    });
    hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        playerMessage.textContent = "No se pudo reproducir este canal. El enlace puede estar caído, restringido o no permitir reproducción en navegador.";
        stopPlayer();
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = channel.url;
    video.addEventListener("error", () => {
      playerMessage.textContent = "No se pudo reproducir este canal. Comprueba la disponibilidad de la fuente.";
    }, { once: true });
  } else {
    playerMessage.textContent = "No se pudo iniciar el reproductor HLS en este navegador.";
  }
  renderChannels();
}

function renderFavorites() {
  const favorites = getFavorites();
  $("fav-nav-count").textContent = favorites.length;
  favoritesList.replaceChildren();
  const saved = channels.filter(channel => favorites.includes(channel.id));
  if (!saved.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = favorites.length ? "Tus favoritos guardados aparecerán cuando cargues la fuente que los contiene." : "Todavía no tienes favoritos.";
    favoritesList.appendChild(empty);
    return;
  }
  for (const channel of saved) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "favorite-card";
    const icon = document.createElement("span"); icon.className = "channel-icon"; icon.textContent = channel.name.slice(0,2).toUpperCase();
    if (channel.logo) {
      const img = document.createElement("img"); img.src = channel.logo; img.alt = ""; img.loading = "lazy";
      img.onerror = () => { icon.replaceChildren(); icon.textContent = channel.name.slice(0,2).toUpperCase(); };
      icon.replaceChildren(img);
    }
    const text = document.createElement("span");
    const strong = document.createElement("strong"); strong.textContent = channel.name;
    const small = document.createElement("small"); small.textContent = `${channel.country} · ${channel.category}`;
    text.append(strong,small); button.append(icon,text);
    button.addEventListener("click", () => playChannel(channel));
    favoritesList.appendChild(button);
  }
}

function renderQuickSources() {
  const container = $("quick-sources");
  if (!container) return;
  container.replaceChildren();
  const sources = getSources();
  if (!sources.length) {
    const hint = document.createElement("span");
    hint.className = "quick-source-hint";
    hint.textContent = "Aún no hay listas guardadas. Usa “Mis listas” para añadirlas.";
    container.appendChild(hint);
    return;
  }
  sources.forEach(source => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-source";
    button.textContent = source.name;
    button.title = source.url;
    button.addEventListener("click", () => {
      playlistInput.value = source.url;
      loadPlaylist(source.url, "replace", source.type || "auto");
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "quick-source-add";
    add.textContent = "+";
    add.title = `Añadir canales de ${source.name}`;
    add.addEventListener("click", () => {
      playlistInput.value = source.url;
      loadPlaylist(source.url, "append", source.type || "auto");
    });
    const group = document.createElement("span");
    group.className = "quick-source-group";
    group.append(button, add);
    container.appendChild(group);
  });
}

function renderSavedSources() {
  const container = $("saved-sources");
  container.replaceChildren();
  const sources = getSources();
  if (!sources.length) {
    const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = "Todavía no has guardado fuentes personalizadas.";
    container.appendChild(empty); return;
  }
  sources.forEach((source,index) => {
    const row = document.createElement("div"); row.className = "saved-source";
    const info = document.createElement("div"); info.className = "saved-source-info";
    const name = document.createElement("strong"); name.textContent = source.name;
    const url = document.createElement("small"); url.textContent = `${source.url} · ${({auto:"Automático",live:"TV en vivo",movie:"Películas",series:"Series"}[source.type || "auto"])}`;
    info.append(name,url);
    const load = document.createElement("button"); load.type = "button"; load.className = "small-button"; load.textContent = "Reemplazar";
    load.addEventListener("click", () => { playlistInput.value = source.url; adminDialog.close(); loadPlaylist(source.url, "replace", source.type || "auto"); });
    const append = document.createElement("button"); append.type = "button"; append.className = "small-button"; append.textContent = "＋ Añadir";
    append.addEventListener("click", () => { playlistInput.value = source.url; adminDialog.close(); loadPlaylist(source.url, "append", source.type || "auto"); });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "small-button danger"; remove.textContent = "Eliminar";
    remove.addEventListener("click", () => { const next=getSources(); next.splice(index,1); saveSources(next); renderSavedSources(); renderQuickSources(); });
    row.append(info,load,append,remove); container.appendChild(row);
  });
}

function openSourcesDialog() { renderSavedSources(); adminDialog.showModal(); }
$("open-admin").addEventListener("click", openSourcesDialog);
$("open-admin-inline").addEventListener("click", openSourcesDialog);
$("save-source").addEventListener("click", () => {
  const name = $("source-name").value.trim();
  const url = $("source-url").value.trim();
  const type = $("source-type").value || "auto";
  if (!name || !url) { alert("Escribe un nombre y una URL M3U."); return; }
  try {
    const parsed = new URL(url);
    if (!["http:","https:"].includes(parsed.protocol)) throw new Error();
  } catch { alert("Introduce una URL válida que comience con http:// o https://."); return; }
  const sources = getSources().filter(item => item.url !== url);
  sources.push({ name, url, type });
  saveSources(sources);
  $("source-name").value = ""; $("source-url").value = ""; $("source-type").value = "auto";
  renderSavedSources();
  renderQuickSources();
});
$("load-default").addEventListener("click", () => { playlistInput.value = DEFAULT_M3U_URL; adminDialog.close(); loadPlaylist(DEFAULT_M3U_URL); });
loadButton.addEventListener("click", () => loadPlaylist(undefined, "replace"));
$("append-playlist").addEventListener("click", () => loadPlaylist(undefined, "append"));
searchInput.addEventListener("input", renderChannels);
countryFilter.addEventListener("change", renderChannels);
categoryFilter.addEventListener("change", renderChannels);
sortFilter.addEventListener("change", renderChannels);
$("clear-filters").addEventListener("click", () => {
  searchInput.value = ""; countryFilter.value = ""; categoryFilter.value = ""; sortFilter.value = "name"; renderChannels();
});

document.querySelectorAll(".media-tab").forEach(button => {
  button.addEventListener("click", () => {
    activeMediaType = button.dataset.media || "live";
    document.querySelectorAll(".media-tab").forEach(tab => {
      const selected = tab === button;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    const labels = {live:"Canales", movie:"Películas", series:"Series", all:"Contenido"};
    document.querySelector(".channel-panel-header h3").textContent = labels[activeMediaType] || "Contenido";
    renderChannels();
  });
});

$("fullscreen-button").addEventListener("click", async () => {
  const target = $("video").style.display !== "none" ? video : $("player-placeholder");
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen();
  } catch { playerMessage.textContent = "El navegador no permitió activar pantalla completa."; }
});
playlistInput.addEventListener("keydown", event => { if (event.key === "Enter") loadPlaylist(); });

renderFavorites();
renderSavedSources();
renderQuickSources();
loadPlaylist();
