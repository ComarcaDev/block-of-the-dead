/* Progreso permanente: cobertizo de mejoras y logros.
   Solo trabaja con los datos de guardado (sin interfaz), así se puede probar fácilmente. */
window.BOTD = window.BOTD || {};

BOTD.Progress = (() => {
  const C = BOTD.CONFIG;
  const UPGRADE_KEYS = Object.keys(C.UPGRADES);

  /* ---------- Cobertizo ---------- */
  const maxLevel = k => C.UPGRADES[k].costs.length;
  const level = (data, k) => Math.max(0, Math.min(maxLevel(k), Math.floor(data.upgrades[k] || 0)));

  // Coste del siguiente nivel (null si ya está al máximo)
  function cost(data, k) {
    const l = level(data, k);
    return l >= maxLevel(k) ? null : C.UPGRADES[k].costs[l];
  }

  function canBuy(data, k) {
    const c = cost(data, k);
    return c != null && data.bank >= c;
  }

  function buy(data, k) {
    if (!canBuy(data, k)) return false;
    data.bank -= cost(data, k);
    data.upgrades[k] = level(data, k) + 1;
    return true;
  }

  // Efectos de las mejoras para una partida
  const NO_MODS = { pea: 1, wall: 1, mineRadius: 0, startBrains: 0, lives: 0, spareRollers: 0 };
  function mods(data) {
    const U = C.UPGRADES, l = k => level(data, k);
    return {
      pea: 1 + U.peaDamage.step * l('peaDamage'),
      wall: 1 + U.wallHp.step * l('wallHp'),
      mineRadius: U.mineRadius.step * l('mineRadius'),
      startBrains: U.startBrains.step * l('startBrains'),
      lives: U.extraLife.step * l('extraLife'),
      spareRollers: U.spareRoller.step * l('spareRoller')
    };
  }

  /* ---------- Logros ----------
     ctx: { event: 'end' | 'lines' | 'kill' | 'wave' | 'buy', ...datos del evento, totalKills } */
  const ACHIEVEMENTS = [
    { id: 'first_win',  test: c => c.event === 'end' && c.won },
    { id: 'tetra',      test: c => c.event === 'lines' && c.n >= 4 },
    { id: 'combo5',     test: c => c.event === 'lines' && c.combo >= 5 },
    { id: 'flawless',   test: c => c.event === 'end' && c.won && c.livesLost === 0 },
    { id: 'no_rollers', test: c => c.event === 'end' && c.won && c.rollersUsed === 0 },
    { id: 'kills100',   test: c => c.totalKills >= 100 },
    { id: 'kills1000',  test: c => c.totalKills >= 1000 },
    { id: 'giant',      test: c => c.event === 'kill' && c.type === 'boss' },
    { id: 'king',       test: c => c.event === 'kill' && c.type === 'boss2' },
    { id: 'world1',     test: c => c.event === 'end' && c.won && c.levelIndex === 4 },
    { id: 'world2',     test: c => c.event === 'end' && c.won && c.levelIndex === 9 },
    { id: 'survivor',   test: c => c.event === 'wave' && c.survival && c.n >= 10 },
    { id: 'handy',      test: c => c.event === 'buy' }
  ];

  // Marca y devuelve los logros nuevos que cumple este evento
  function evaluate(ctx, data) {
    const fresh = [];
    ACHIEVEMENTS.forEach(a => {
      if (data.achievements[a.id]) return;
      let ok = false;
      try { ok = !!a.test(ctx); } catch (e) { ok = false; }
      if (ok) { data.achievements[a.id] = true; fresh.push(a.id); }
    });
    return fresh;
  }

  return { UPGRADE_KEYS, maxLevel, level, cost, canBuy, buy, mods, NO_MODS, ACHIEVEMENTS, evaluate };
})();
