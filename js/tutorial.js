/* Tutorial guiado del nivel 1. Cada paso avanza cuando el jugador hace lo que se pide.
   Las oleadas esperan (g.holdWaves) hasta que el jugador suelta su primera pieza. */
window.BOTD = window.BOTD || {};

BOTD.Tutorial = (() => {
  // done(g, s, t): s = contadores al empezar el tutorial; t = segundos en el paso actual
  const STEPS = [
    { key: 'tut_move',    done: (g, s) => g.stats.moves - s.moves >= 2 },
    { key: 'tut_rotate',  done: (g, s) => g.stats.rotateTries - s.rotateTries >= 1 },
    { key: 'tut_drop',    done: (g, s) => g.stats.drops - s.drops >= 1, releaseWaves: true },
    { key: 'tut_defense', done: (g, s, t) => t >= 7 },
    { key: 'tut_line',    done: (g, s) => g.stats.lineClears - s.lineClears >= 1 },
    { key: 'tut_shop',    done: (g, s, t) => g.stats.buys - s.buys >= 1 || t >= 9 }
  ];

  let st = null;       // { g, idx, t, snap }
  let onFinish = null;

  function snapshot(g) { return Object.assign({}, g.stats); }

  function start(g, finish) {
    st = { g, idx: 0, t: 0, snap: snapshot(g) };
    onFinish = finish;
    g.holdWaves = true;
    show();
  }

  function show() {
    const s = STEPS[st.idx];
    BOTD.UI.showTip(BOTD.t(s.key), st.idx + 1, STEPS.length);
  }

  function finish(skipped) {
    if (!st) return;
    st.g.holdWaves = false;
    BOTD.UI.hideTip();
    if (!skipped) BOTD.Game.setBanner(st.g, BOTD.t('tut_done'), 1.8, '#8be36a');
    st = null;
    if (onFinish) onFinish(skipped);
  }

  function update(g, dt) {
    if (!st || st.g !== g) return;
    if (g.over) { cancel(); return; }   // si se pierde, el tutorial se repite la próxima vez
    st.t += dt;
    const s = STEPS[st.idx];
    if (s.done(g, st.snap, st.t)) {
      if (s.releaseWaves) g.holdWaves = false;
      st.idx++;
      st.t = 0;   // los contadores se comparan con el inicio del tutorial: hacer dos cosas rápido también cuenta
      if (st.idx >= STEPS.length) { finish(false); return; }
      BOTD.Audio.play('tip');
      show();
    }
  }

  function skip() { finish(true); }
  function active() { return !!st; }
  // Cancela sin marcarlo como visto (al salir del nivel a mitad)
  function cancel() { if (st) { st.g.holdWaves = false; st = null; BOTD.UI.hideTip(); } }

  return { start, update, skip, cancel, active, STEPS };
})();
