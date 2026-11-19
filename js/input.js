/* Entrada: teclado (con repetición lateral), botones táctiles y gestos sobre el tablero. */
window.BOTD = window.BOTD || {};

BOTD.Input = (() => {
  const C = BOTD.CONFIG;
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'rotate', KeyW: 'rotate', KeyX: 'rotate',
    KeyZ: 'rotateCCW', KeyQ: 'rotateCCW',
    KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
    Space: 'drop',
    KeyP: 'pause', Escape: 'pause', KeyF: 'fullscreen',
    Digit1: 'shop1', Digit2: 'shop2', Digit3: 'shop3',
    Numpad1: 'shop1', Numpad2: 'shop2', Numpad3: 'shop3'
  };

  let h = {};
  let dir = 0, dasT = 0, arrT = 0;
  const held = { left: false, right: false };

  function emit(name, arg) { if (h[name]) h[name](arg); }

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

  function init(handlers) {
    h = handlers;
    window.addEventListener('keydown', e => {
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

  // Repetición del movimiento lateral mientras se mantiene pulsado
  function update(dt) {
    if (!dir) return;
    dasT += dt;
    if (dasT < C.DAS) return;
    arrT += dt;
    while (arrT >= C.ARR) { arrT -= C.ARR; emit('move', dir); }
  }

  return { init, update, reset };
})();
