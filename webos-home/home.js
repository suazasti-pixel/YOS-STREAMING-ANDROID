(function () {
  'use strict';
  var STORAGE_KEY = 'yosHome.shortcuts.v1';
  var builtIns = [
    { name: 'YOS Streaming', id: 'com.yos.streaming.tv', icon: '▶', description: 'Tu TV en vivo y biblioteca', fixed: true },
    { name: 'YOS Xtream', id: 'com.yos.streaming.xtreamtv', icon: 'Y', description: 'Canales, películas y series', fixed: true }
  ];
  var grid = document.getElementById('app-grid');
  var status = document.getElementById('status');
  function customItems() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.filter(function (x) { return x && x.name && x.id; }) : [];
    } catch (_) { return []; }
  }
  function launch(item) {
    status.className = 'status';
    status.textContent = 'Abriendo ' + item.name + '…';
    if (window.webOS && window.webOS.service && window.webOS.service.request) {
      window.webOS.service.request('luna://com.webos.applicationManager', {
        method: 'launch', parameters: { id: item.id },
        onSuccess: function () { status.textContent = item.name + ' se está iniciando.'; },
        onFailure: function (err) { status.className = 'status error'; status.textContent = 'No se pudo abrir. Revisa que esté instalada y que el ID sea correcto.'; console.warn('webOS launch failed', err); }
      });
    } else {
      status.className = 'status error';
      status.textContent = 'La apertura de apps solo está disponible al ejecutar YOS Home en un TV LG webOS.';
    }
  }
  function render() {
    grid.replaceChildren();
    builtIns.concat(customItems()).forEach(function (item, index) {
      var card = document.createElement('article'); card.className = 'app-card';
      var open = document.createElement('button'); open.type = 'button'; open.className = 'app-open';
      open.setAttribute('aria-label', 'Abrir ' + item.name);
      open.innerHTML = '<span class="app-icon" aria-hidden="true"></span><span><strong></strong><small></small></span>';
      open.querySelector('.app-icon').textContent = item.icon || (item.name.slice(0, 1).toUpperCase());
      open.querySelector('strong').textContent = item.name;
      open.querySelector('small').textContent = item.description || item.id;
      open.addEventListener('click', function () { launch(item); });
      card.appendChild(open);
      if (!item.fixed) {
        var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = 'Quitar'; remove.setAttribute('aria-label', 'Quitar ' + item.name);
        remove.addEventListener('click', function (event) { event.stopPropagation(); localStorage.setItem(STORAGE_KEY, JSON.stringify(customItems().filter(function (x) { return x.id !== item.id; }))); render(); status.textContent = 'Acceso eliminado.'; });
        card.appendChild(remove);
      }
      grid.appendChild(card);
    });
  }
  document.getElementById('shortcut-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = document.getElementById('shortcut-name').value.trim();
    var id = document.getElementById('shortcut-id').value.trim();
    if (!name || !/^[A-Za-z0-9_.-]+$/.test(id)) { status.className = 'status error'; status.textContent = 'Usa un ID de aplicación webOS válido, por ejemplo com.ejemplo.app.'; return; }
    var items = customItems().filter(function (x) { return x.id !== id; });
    items.push({ name: name, id: id, icon: name.charAt(0).toUpperCase(), description: id });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.reset(); render(); status.className = 'status'; status.textContent = 'Acceso guardado en este televisor.';
  });
  function updateClock() { var el = document.getElementById('clock'); el.textContent = new Intl.DateTimeFormat('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date()); }
  updateClock(); setInterval(updateClock, 30000); render();
  window.addEventListener('load', function () { var first = grid.querySelector('button'); if (first) first.focus(); });
}());
