/* App instalable (PWA): registra el service worker, avisa de versiones nuevas y gestiona el botón "Instalar".
   Solo funciona desde la web (http/https); abriendo index.html con doble clic se juega igual, sin instalar. */
self.BOTD = self.BOTD || {};

BOTD.PWA = (() => {
  let deferredPrompt = null;
  let waitingReg = null;
  const listeners = {};

  function on(evt, fn) { listeners[evt] = fn; }
  function emit(evt, arg) { if (listeners[evt]) listeners[evt](arg); }

  const supported = () => 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);

  function register() {
    // El botón "Instalar" solo aparece cuando el navegador lo permite (Chrome, Edge, Android…)
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      emit('installable', true);
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      emit('installable', false);
    });
    if (!supported()) return;

    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const notify = () => {
        if (reg.waiting && navigator.serviceWorker.controller) { waitingReg = reg; emit('update', true); }
      };
      notify();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state !== 'installed') return;
          if (navigator.serviceWorker.controller) notify();
          else emit('offlineReady', true);   // primera instalación: ya se puede jugar sin conexión
        });
      });
    }).catch(err => console.warn('[Block of the Dead] No se pudo registrar el service worker:', err));

    // Tras pulsar "Actualizar", la nueva versión toma el control y se recarga la página
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloading) { reloading = true; location.reload(); }
    });
  }

  function applyUpdate() {
    if (waitingReg && waitingReg.waiting) waitingReg.waiting.postMessage('skipWaiting');
  }

  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve(false);
    const p = deferredPrompt;
    deferredPrompt = null;
    emit('installable', false);
    p.prompt();
    return p.userChoice.then(c => c.outcome === 'accepted').catch(() => false);
  }

  return { register, on, applyUpdate, promptInstall, supported, get canInstall() { return !!deferredPrompt; } };
})();
