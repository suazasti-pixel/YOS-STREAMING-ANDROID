"use strict";

(function () {
  var pending = Object.create(null);
  var sequence = 0;

  function apiRequest(requestId, server, username, password, action, categoryId, itemId) {
    if (!window.webOS || !window.webOS.service) {
      window.yosXtreamResponse(requestId, JSON.stringify({ _error: "El servicio webOS no está disponible." }));
      return;
    }
    pending[requestId] = true;
    window.webOS.service.request("luna://com.yos.streaming.xtreamtv.service/", {
      method: "requestApi",
      parameters: {
        requestId: requestId,
        server: server,
        username: username,
        password: password,
        action: action || "",
        categoryId: categoryId || "",
        itemId: itemId || ""
      },
      onSuccess: function (result) {
        if (!pending[requestId]) return;
        delete pending[requestId];
        window.yosXtreamResponse(requestId, result.responseText || JSON.stringify({ _error: "Respuesta vacía del servidor." }));
      },
      onFailure: function () {
        if (!pending[requestId]) return;
        delete pending[requestId];
        window.yosXtreamResponse(requestId, JSON.stringify({ _error: "No se pudo conectar con el servicio webOS." }));
      }
    });
  }

  function ensurePlayer() {
    var overlay = document.getElementById("yos-lg-player");
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = "yos-lg-player";
    overlay.className = "yos-lg-player";
    overlay.setAttribute("aria-label", "Reproductor");
    overlay.innerHTML = '<header><strong id="yos-lg-title"></strong><button id="yos-lg-close" type="button">CERRAR <span>✕</span></button></header><video id="yos-lg-video" controls autoplay playsinline></video><footer><button id="yos-lg-prev" type="button">◀ ANTERIOR</button><span id="yos-lg-state">Conectando…</span><button id="yos-lg-next" type="button">SIGUIENTE ▶</button></footer>';
    document.body.appendChild(overlay);
    overlay.querySelector("#yos-lg-close").addEventListener("click", closePlayer);
    overlay.querySelector("#yos-lg-prev").addEventListener("click", function () { step(-1); });
    overlay.querySelector("#yos-lg-next").addEventListener("click", function () { step(1); });
    var video = overlay.querySelector("video");
    video.addEventListener("waiting", function () { overlay.querySelector("#yos-lg-state").textContent = "Cargando transmisión…"; });
    video.addEventListener("playing", function () { overlay.querySelector("#yos-lg-state").textContent = "Reproduciendo"; });
    video.addEventListener("error", function () { overlay.querySelector("#yos-lg-state").textContent = "No se pudo reproducir este formato o transmisión."; });
    return overlay;
  }

  function closePlayer() {
    var overlay = document.getElementById("yos-lg-player");
    if (!overlay) return;
    var video = overlay.querySelector("video");
    video.pause();
    video.removeAttribute("src");
    video.load();
    overlay.hidden = true;
    document.body.classList.remove("player-open");
    var focused = document.querySelector(".content-card:focus") || document.getElementById("catalog-title");
    if (focused && focused.focus) focused.focus();
  }

  function step(delta) {
    if (!window.YOSXtream.queue.length) return;
    window.YOSXtream.index = Math.max(0, Math.min(window.YOSXtream.queue.length - 1, window.YOSXtream.index + delta));
    playCurrent();
  }

  function playCurrent() {
    var overlay = ensurePlayer();
    var item = window.YOSXtream.queue[window.YOSXtream.index];
    if (!item) return;
    overlay.hidden = false;
    document.body.classList.add("player-open");
    overlay.querySelector("#yos-lg-title").textContent = item.name || "YOS Xtream";
    overlay.querySelector("#yos-lg-state").textContent = "Conectando…";
    var video = overlay.querySelector("video");
    video.src = item.url;
    video.load();
    var promise = video.play();
    if (promise && promise.catch) promise.catch(function () { overlay.querySelector("#yos-lg-state").textContent = "Pulsa OK para iniciar la reproducción."; });
    overlay.querySelector("#yos-lg-close").focus();
  }

  window.YOSXtream = {
    requestApi: apiRequest,
    isTelevision: function () { return true; },
    saveCredentials: function (_server, _username, _password, remember) {
      return JSON.stringify(remember ? { ok: false, error: "Esta edición no guarda credenciales en el televisor. Deja desmarcada la opción de recordar cuenta." } : { ok: true });
    },
    getSavedCredentials: function () { return JSON.stringify({ saved: false }); },
    clearSavedCredentials: function () {},
    playNative: function (url, title, queueJson, index) {
      var queue = [];
      try { queue = JSON.parse(queueJson || "[]"); } catch (_) {}
      window.YOSXtream.queue = queue.length ? queue : [{ url: url, name: title }];
      window.YOSXtream.index = Math.max(0, Math.min(window.YOSXtream.queue.length - 1, Number(index) || 0));
      playCurrent();
    },
    queue: [],
    index: 0
  };

  document.addEventListener("DOMContentLoaded", function () {
    var remember = document.getElementById("remember");
    if (remember) {
      remember.checked = false;
      remember.disabled = true;
      var label = remember.closest("label");
      if (label) label.hidden = true;
    }
    var message = document.createElement("p");
    message.className = "tv-lg-private-note";
    message.textContent = "Por seguridad, esta app no guarda usuario ni contraseña en el televisor.";
    var form = document.getElementById("login-form");
    if (form) form.appendChild(message);
    setTimeout(function () { document.getElementById("server")?.focus(); }, 250);
    document.getElementById("login-form")?.addEventListener("submit", function () {
      var timer = setInterval(function () {
        var catalog = document.getElementById("catalog-view");
        if (catalog && !catalog.hidden) {
          clearInterval(timer);
          setTimeout(function () { document.getElementById("category")?.focus(); }, 150);
        }
      }, 150);
      setTimeout(function () { clearInterval(timer); }, 20000);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Backspace" || event.keyCode === 461 || event.keyCode === 10009) {
        var player = document.getElementById("yos-lg-player");
        if (player && !player.hidden) { event.preventDefault(); closePlayer(); }
      } else if (event.key === "ChannelUp") {
        event.preventDefault(); step(-1);
      } else if (event.key === "ChannelDown") {
        event.preventDefault(); step(1);
      }
    }, true);
  });
})();
