"use strict";

var Service = require("webos-service");
var http = require("http");
var https = require("https");
var zlib = require("zlib");
var crypto = require("crypto");
var service = new Service("com.yos.streaming.xtreamtv.service");
var ACTIONS = {
  "": true,
  get_live_categories: true,
  get_live_streams: true,
  get_vod_categories: true,
  get_vod_streams: true,
  get_series_categories: true,
  get_series: true,
  get_series_info: true,
  get_short_epg: true
};
var MAX_BYTES = 20 * 1024 * 1024;
var MAX_M3U_BYTES = 10 * 1024 * 1024;
var M3U_CHUNK_CHARS = 262144;
var m3uPlaylists = Object.create(null);

function errorPayload(error) {
  var message = error && error.message ? error.message : "No se pudo conectar con el proveedor.";
  return JSON.stringify({ _error: message.replace(/(username|password)=[^&\s]+/ig, "$1=••••") });
}

function buildApiUrl(input) {
  if (!ACTIONS[input.action]) throw new Error("Acción API no permitida.");
  var base;
  try { base = new URL(String(input.server || "")); }
  catch (_) { throw new Error("Escribe el servidor como http://dominio:puerto o https://dominio:puerto."); }
  if ((base.protocol !== "http:" && base.protocol !== "https:") || !base.hostname || base.username || base.password || base.search || base.hash) {
    throw new Error("Escribe el servidor como http://dominio:puerto o https://dominio:puerto.");
  }
  if (!input.username || !input.password) throw new Error("Escribe usuario y contraseña.");
  base.pathname = base.pathname.replace(/\/+$/, "") + "/player_api.php";
  base.searchParams.set("username", String(input.username));
  base.searchParams.set("password", String(input.password));
  if (input.action) base.searchParams.set("action", input.action);
  if (input.categoryId) base.searchParams.set("category_id", String(input.categoryId));
  if (input.action === "get_series_info" && input.itemId) base.searchParams.set("series_id", String(input.itemId));
  if (input.action === "get_short_epg" && input.itemId) {
    base.searchParams.set("stream_id", String(input.itemId));
    base.searchParams.set("limit", "2");
  }
  return base;
}

function fetchJson(url, callback, redirects) {
  var transport = url.protocol === "https:" ? https : http;
  var request = transport.get(url, {
    headers: {
      Accept: "application/json, */*",
      "Accept-Encoding": "gzip",
      "User-Agent": "YOS-Xtream-webOS/1.0"
    },
    timeout: 25000
  }, function (response) {
    var status = response.statusCode || 0;
    if ([301, 302, 303, 307, 308].indexOf(status) >= 0 && response.headers.location && redirects < 3) {
      response.resume();
      var target;
      try { target = new URL(response.headers.location, url); }
      catch (_) { return callback(new Error("El proveedor devolvió una redirección inválida.")); }
      if (target.protocol !== "https:" && target.protocol !== "http:") return callback(new Error("Redirección no compatible."));
      return fetchJson(target, callback, redirects + 1);
    }
    if (status < 200 || status >= 300) {
      response.resume();
      return callback(new Error("El servidor respondió HTTP " + status + "."));
    }
    var stream = response;
    if (/^gzip$/i.test(response.headers["content-encoding"] || "")) {
      try { stream = response.pipe(zlib.createGunzip()); }
      catch (_) { return callback(new Error("No se pudo descomprimir la respuesta del servidor.")); }
    }
    var chunks = [];
    var length = 0;
    stream.on("data", function (chunk) {
      length += chunk.length;
      if (length > MAX_BYTES) {
        request.destroy();
        return callback(new Error("La respuesta supera el límite de 20 MB."));
      }
      chunks.push(chunk);
    });
    stream.on("error", function () { callback(new Error("Error al leer la respuesta del proveedor.")); });
    stream.on("end", function () {
      var text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) return callback(new Error("El servidor devolvió una respuesta vacía."));
      if (text.charAt(0) !== "{" && text.charAt(0) !== "[") return callback(new Error("El servidor no devolvió datos JSON Xtream."));
      callback(null, text);
    });
  });
  request.on("timeout", function () { request.destroy(new Error("El servidor tardó demasiado en responder.")); });
  request.on("error", function (error) { callback(error); });
}

function pruneM3uPlaylists() {
  var now = Date.now();
  Object.keys(m3uPlaylists).forEach(function (id) {
    if (m3uPlaylists[id].expiresAt <= now) delete m3uPlaylists[id];
  });
  var ids = Object.keys(m3uPlaylists);
  while (ids.length >= 3) delete m3uPlaylists[ids.shift()];
}

function validateM3uUrl(raw) {
  if (typeof raw !== "string" || raw.length > 8192) throw new Error("El enlace M3U no es válido.");
  var url;
  try { url = new URL(raw); }
  catch (_) { throw new Error("Pega un enlace M3U completo que empiece por http:// o https://."); }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.username || url.password) {
    throw new Error("El enlace debe usar HTTP o HTTPS y no incluir credenciales dentro del servidor.");
  }
  return url;
}

function fetchM3u(url, callback, redirects) {
  var transport = url.protocol === "https:" ? https : http;
  var settled = false;
  function finish(error, value) {
    if (settled) return;
    settled = true;
    callback(error, value);
  }
  var request = transport.get(url, {
    headers: {
      Accept: "application/vnd.apple.mpegurl, audio/mpegurl, application/x-mpegURL, text/plain, */*",
      "Accept-Encoding": "identity",
      "User-Agent": "YOS-Xtream-webOS/1.0"
    },
    timeout: 30000
  }, function (response) {
    var status = response.statusCode || 0;
    if ([301, 302, 303, 307, 308].indexOf(status) >= 0 && response.headers.location) {
      response.resume();
      if (redirects >= 3) return finish(new Error("El enlace M3U superó el límite de redirecciones."));
      var target;
      try { target = new URL(response.headers.location, url); }
      catch (_) { return finish(new Error("El proveedor devolvió una redirección inválida.")); }
      if ((target.protocol !== "http:" && target.protocol !== "https:") || target.hostname !== url.hostname || (url.protocol === "https:" && target.protocol !== "https:")) {
        return finish(new Error("La redirección del enlace M3U no es segura o cambia de servidor."));
      }
      return fetchM3u(target, callback, redirects + 1);
    }
    if (status < 200 || status >= 300) {
      response.resume();
      return finish(new Error("El servidor M3U respondió HTTP " + status + "."));
    }
    var chunks = [];
    var length = 0;
    response.on("data", function (chunk) {
      if (settled) return;
      length += chunk.length;
      if (length > MAX_M3U_BYTES) {
        request.destroy();
        return finish(new Error("La lista M3U supera el límite de 10 MB."));
      }
      chunks.push(chunk);
    });
    response.on("error", function () { finish(new Error("Error al leer la lista M3U.")); });
    response.on("end", function () {
      var text = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
      if (text.indexOf("#EXTINF:") < 0) return finish(new Error("El servidor no devolvió una lista M3U válida."));
      finish(null, text);
    });
  });
  request.on("timeout", function () { request.destroy(new Error("El servidor M3U tardó demasiado en responder.")); });
  request.on("error", function () { finish(new Error("No se pudo descargar la lista M3U. Revisa el enlace y la conexión.")); });
}

service.register("downloadM3u", function (message) {
  var input = message.payload || {};
  try {
    var url = validateM3uUrl(input.url);
    fetchM3u(url, function (error, text) {
      if (error) {
        message.respond({ returnValue: true, ok: false, error: error.message });
        return;
      }
      pruneM3uPlaylists();
      var playlistId = crypto.randomBytes(12).toString("hex");
      m3uPlaylists[playlistId] = { text: text, expiresAt: Date.now() + 120000 };
      message.respond({ returnValue: true, ok: true, playlistId: playlistId, length: text.length });
    }, 0);
  } catch (error) {
    message.respond({ returnValue: true, ok: false, error: error.message });
  }
});

service.register("readM3uChunk", function (message) {
  var input = message.payload || {};
  var entry = m3uPlaylists[String(input.playlistId || "")];
  var offset = Math.max(0, Math.floor(Number(input.offset) || 0));
  var limit = Math.min(M3U_CHUNK_CHARS, Math.max(1, Math.floor(Number(input.limit) || M3U_CHUNK_CHARS)));
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) delete m3uPlaylists[String(input.playlistId)];
    message.respond({ returnValue: true, ok: false, error: "La lista M3U temporal expiró. Intenta actualizarla otra vez." });
    return;
  }
  if (offset > entry.text.length) {
    message.respond({ returnValue: true, ok: false, error: "La posición de lectura de la lista M3U no es válida." });
    return;
  }
  var text = entry.text.slice(offset, offset + limit);
  message.respond({ returnValue: true, ok: true, text: text, length: text.length, done: offset + text.length >= entry.text.length });
});

service.register("requestApi", function (message) {
  var input = message.payload || {};
  var requestId = String(input.requestId || "").slice(0, 80);
  try {
    var url = buildApiUrl(input);
    fetchJson(url, function (error, text) {
      var responseText = error ? errorPayload(error) : text;
      message.respond({ returnValue: true, requestId: requestId, responseText: responseText });
    }, 0);
  } catch (error) {
    message.respond({ returnValue: true, requestId: requestId, responseText: errorPayload(error) });
  }
});
