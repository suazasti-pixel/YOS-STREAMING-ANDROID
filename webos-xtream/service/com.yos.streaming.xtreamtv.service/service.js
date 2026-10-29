"use strict";

var Service = require("webos-service");
var http = require("http");
var https = require("https");
var zlib = require("zlib");
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
