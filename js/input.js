/* Entrada: teclado configurable (con repetición lateral), botones táctiles, gestos sobre el tablero y mando. */
window.BOTD = window.BOTD || {};

BOTD.Input = (() => {
  const C = BOTD.CONFIG;

  // Acciones configurables y sus teclas por defecto (códigos de KeyboardEvent.code)
  const ACTIONS = ['left', 'right', 'down', 'rotate', 'rotateCCW', 'drop', 'hold', 'pause', 'shop1', 'shop2', 'shop3', 'fullscreen'];
  const DEFAULT_KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    down: ['ArrowDown', 'KeyS'],
    rotate: ['ArrowUp', 'KeyW', 'KeyX'],
    rotateCCW: ['KeyZ', 'KeyQ'],
    drop: ['Space'],
    hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
    pause: ['KeyP', 'Escape'],
    shop1: ['Digit1', 'Numpad1'],
    shop2: ['Digit2', 'Numpad2'],
    shop3: ['Digit3', 'Numpad3'],
    fullscreen: ['KeyF']
  };

  let bindings = {};   // acción → [códigos]
  let KEYS = {};       // código → acción
  let h = {};
  let dir = 0, dasT = 0, arrT = 0;
  const held = { left: false, right: false };
  let capture = null;  // función que recibe la próxima tecla (configuración de teclas)

  function emit(name, arg) { if (h[name]) h[name](arg); }

  /* ---------- Teclas ---------- */
  // custom: { acción: [códigos] } guardado en ajustes; lo que falte usa el valor por defecto
  function setBindings(custom) {
    bindings = {};
    ACTIONS.forEach(a => {
      const c = custom && Array.isArray(custom[a]) ? custom[a] : DEFAULT_KEYS[a];
      bindings[a] = c.slice();
    });
    KEYS = {};
    ACTIONS.forEach(a => bindings[a].forEach(code => { if (!KEYS[code]) KEYS[code] = a; }));
    return bindings;
  }

  // Asigna una tecla a una acción (sustituye las suyas) y la quita de otra acción si la tenía.
  // Devuelve { bindings, movedFrom } — movedFrom es la acción que la perdió, o null.
  function rebind(current, action, code) {
    const next = {};
    let movedFrom = null;
    ACTIONS.forEach(a => {
      const list = (current[a] || DEFAULT_KEYS[a]).slice();
      if (a !== action && list.includes(code)) {
        movedFrom = a;
        next[a] = list.filter(c => c !== code);
      } else {
        next[a] = list;
      }
    });
    next[action] = [code];
    return { bindings: next, movedFrom };
  }

  function getBindings() { return bindings; }

  // Nombre legible de una tecla
  function keyLabel(code) {
    if (!code) return BOTD.t('key_none');
    const map = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Space: BOTD.t('key_space'), ShiftLeft: BOTD.t('key_shift'), ShiftRight: BOTD.t('key_shift'),
      Escape: BOTD.t('key_esc'), Enter: BOTD.t('key_enter'), Tab: BOTD.t('key_tab'), Backspace: BOTD.t('key_backspace'),
      ControlLeft: BOTD.t('key_ctrl'), ControlRight: BOTD.t('key_ctrl'), AltLeft: BOTD.t('key_alt'), AltRight: BOTD.t('key_alt')
    };
    if (map[code]) return map[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad\d$/.test(code)) return 'Num ' + code.slice(6);
    return code;
  }

  // La próxima tecla pulsada se entrega a fn (Esc la cancela con null)
  function captureNext(fn) { capture = fn; reset(); }

  /* ---------- Acciones ---------- */
  function press(a) {
    if (a === 'left' || a === 'right') {
      held[a] = true;
      dir = a === 'left' ? -1 : 1;
      dasT = 0; arrT = 0;
      emit('move', dir);
    } else if (a === 'down') {
      emit('soft', true);
    } else {
      emit(a);
    }
  }

  function release(a) {
    if (a === 'left' || a === 'right') {
      held[a] = false;
      dir = held.left ? -1 : held.right ? 1 : 0;
      dasT = 0; arrT = 0;
    } else if (a === 'down') {
      emit('soft', false);
    }
  }

  function reset() {
    held.left = held.right = false;
    dir = 0;
    emit('soft', false);
  }

  /* ---------- Mando (API Gamepad, mapeo estándar) ----------
     0 A girar · 1 B girar al revés · 2 X soltar · 3 Y guardar · 4 LB / 5 RB / 6 LT tienda
     9 Start pausa · 12 arriba girar · 13 abajo bajar · 14/15 izquierda/derecha · palanca izquierda */
  const PAD_BUTTONS = { 0: 'rotate', 1: 'rotateCCW', 2: 'drop', 3: 'hold', 4: 'shop1', 5: 'shop2', 6: 'shop3', 9: 'pause', 12: 'rotate' };
  const DEAD = 0.5;
  let padPrev = {};   // estado anterior de cada entrada virtual

  function padState(pad) {
    const b = i => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
    const ax = pad.axes || [];
    const s = {
      left: b(14) || (ax[0] || 0) < -DEAD,
      right: b(15) || (ax[0] || 0) > DEAD,
      down: b(13) || (ax[1] || 0) > DEAD
    };
    for (const i in PAD_BUTTONS) s['b' + i] = b(+i);
    return s;
  }

  // pads: lista como la de navigator.getGamepads() (se puede pasar una falsa en las pruebas)
  function pollPads(pads) {
    const now = { left: false, right: false, down: false };
    for (const i in PAD_BUTTONS) now['b' + i] = false;
    let any = false;
    for (const pad of pads || []) {
      if (!pad || !pad.connected) continue;
      any = true;
      const s = padState(pad);
      for (const k in s) now[k] = now[k] || s[k];
    }
    if (!any && !Object.keys(padPrev).length) return;
    // Cambios: pulsar / soltar
    ['left', 'right', 'down'].forEach(a => {
      if (now[a] && !padPrev[a]) press(a);
      if (!now[a] && padPrev[a]) release(a);
    });
    for (const i in PAD_BUTTONS) {
      const k = 'b' + i;
      if (now[k] && !padPrev[k]) press(PAD_BUTTONS[i]);
    }
    padPrev = any ? now : {};
  }

  /* ---------- Gestos sobre el tablero ---------- */
  function initGestures() {
    const cv = document.getElementById('game');
    let start = null;
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      BOTD.Audio.init();
      start = { x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, moved: false, dropped: false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
    });
    cv.addEventListener('pointermove', e => {
      if (!start) return;
      const step = cv.clientWidth / (C.COLS + 1) * 0.8;
      let dx = e.clientX - start.lastX;
      while (Math.abs(dx) >= step) {
        const d = Math.sign(dx);
        emit('move', d);
        start.lastX += d * step;
        dx = e.clientX - start.lastX;
        start.moved = true;
      }
      const dy = e.clientY - start.y;
      const quick = performance.now() - start.t < 350 && Math.abs(e.clientX - start.x) < step;
      if (!start.dropped && quick && dy > step * 2.5) {
        start.dropped = true;
        start.moved = true;
        emit('drop');
      } else if (!start.dropped && quick && dy < -step * 2.5) {
        start.dropped = true;   // deslizar hacia arriba: guardar pieza
        start.moved = true;
        emit('hold');
      }
    });
    cv.addEventListener('pointerup', e => {
      if (!start) return;
      const quick = performance.now() - start.t < 300;
      if (!start.moved && quick && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 12) emit('rotate');
      start = null;
    });
    cv.addEventListener('pointercancel', () => { start = null; });
  }

  function setHandlers(handlers) { h = handlers || {}; }

  function init(handlers, customKeys) {
    setHandlers(handlers);
    setBindings(customKeys);
    window.addEventListener('keydown', e => {
      if (capture) {
        e.preventDefault();
        const fn = capture;
        capture = null;
        fn(e.code === 'Escape' ? null : e.code);
        return;
      }
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      press(a);
    });
    window.addEventListener('keyup', e => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      release(a);
    });
    window.addEventListener('blur', reset);
    window.addEventListener('gamepadconnected', () => emit('padConnected', true));
    window.addEventListener('gamepaddisconnected', () => { padPrev = {}; reset(); emit('padConnected', false); });

    document.querySelectorAll('[data-action]').forEach(btn => {
      const a = btn.dataset.action;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
        btn.classList.add('pressed');
        BOTD.Audio.init();
        press(a);
      });
      const up = () => { btn.classList.remove('pressed'); release(a); };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, up));
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    initGestures();
  }

  // Cada fotograma: repetición lateral (teclado o mando) y lectura del mando
  function update(dt) {
    if (navigator.getGamepads) {
      try { pollPads(navigator.getGamepads()); } catch (e) { /* algunos navegadores lo bloquean */ }
    }
    if (!dir) return;
    dasT += dt;
    if (dasT < C.DAS) return;
    arrT += dt;
    while (arrT >= C.ARR) { arrT -= C.ARR; emit('move', dir); }
  }

  setBindings(null);

  return {
    ACTIONS, DEFAULT_KEYS, init, update, reset, setHandlers,
    setBindings, getBindings, rebind, keyLabel, captureNext, pollPads
  };
})();
