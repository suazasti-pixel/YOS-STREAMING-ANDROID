"use strict";

(() => {
  const dialog = document.getElementById("install-dialog");
  const installButton = document.getElementById("install-app");
  let installPrompt = null;

  document.getElementById("open-install").addEventListener("click", () => dialog.showModal());

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installButton.classList.add("hidden");
    if (dialog.open) dialog.close();
  });

  const isAndroidAssetOrigin = location.hostname === "appassets.androidplatform.net";
  if (!isAndroidAssetOrigin && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("No se pudo activar el modo instalable:", error);
    }));
  }
})();
