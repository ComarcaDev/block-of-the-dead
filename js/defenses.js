/* Comportamiento de cada bloque-defensa: disparo (normal y de hielo), girasol de cerebros,
   mina, baba, cactus, lápidas y daño. */
window.BOTD = window.BOTD || {};

BOTD.Defenses = (() => {
  const C = BOTD.CONFIG;
  const H = C.ROWS + C.HIDDEN_ROWS;
  const GUNS = { shooter: true, ice: true };   // defensas que disparan desde su bloque activo

  function update(g, dt) {
    for (let y = C.HIDDEN_ROWS; y < H; y++) {
      const row = g.grid[y];
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const c = row[x];
        if (!c) continue;
        if (c.flash > 0) c.flash -= dt;
        if (c.recoil > 0) c.recoil -= dt;
        if (c.hitT > 0) c.hitT -= dt;
        if (!c.gun) continue;
        if (GUNS[c.type]) {
          const D = C.DEFENSES[c.type];
          c.cd -= dt;
          if (c.cd <= 0 && g.projectiles.length < C.FX_LIMITS.projectiles && hasTarget(g, y, x)) {
            c.cd = D.fireInterval;
            c.recoil = 0.12;
            const dmg = D.damage * (g.mods ? g.mods.pea : 1);
            g.projectiles.push({ lane: y, x: x + 0.9, speed: D.peaSpeed, dmg, ice: c.type === 'ice', dead: false });
            BOTD.Audio.play('shoot');
          }
        } else if (c.type === 'sunflower') {
          const D = C.DEFENSES.sunflower;
          c.cd -= dt;
          if (c.cd <= 0) {
            c.cd = D.interval;
            c.recoil = 0.5;   // brillo al producir
            BOTD.Game.addBrains(g, D.brains, x + 0.5, y + 0.1);
            BOTD.Audio.play('tip');
          }
        }
      }
    }
  }

  function hasTarget(g, lane, x) {
    return g.zombies.some(z => !z.dead && !z.underground && z.lane === lane && z.x > x + 0.5 && z.x < C.COLS + 0.2);
  }

  function damageCell(g, x, y, amount) {
    const c = g.grid[y] && g.grid[y][x];
    if (!c || c.type === 'grave') return;
    if (c.type === 'mine') { explodeMine(g, x, y); return; }
    c.hp -= amount;
    c.flash = 0.12;
    c.hitT = 0.25;
    if (c.hp <= 0) destroyCell(g, x, y);
  }

  function destroyCell(g, x, y) {
    const c = g.grid[y][x];
    if (!c) return;
    g.grid[y][x] = null;
    BOTD.Game.burst(g, x + 0.5, y + 0.5, BOTD.Game.COLORS[c.type], 12, 4);
    BOTD.Audio.play('hit');
  }

  function explodeMine(g, x, y) {
    const M = C.DEFENSES.mine;
    const radius = M.radius + (g.mods ? g.mods.mineRadius : 0);
    g.grid[y][x] = null;
    g.zombies.forEach(z => {
      if (z.dead) return;
      const dl = Math.abs(z.lane - y);
      if (dl > 1 || Math.abs(z.x - (x + 0.5)) > radius) return;
      BOTD.Zombies.damage(g, z, dl === 0 ? M.damage : M.damage * 0.5);
    });
    BOTD.Game.boom(g, x + 0.5, y + 0.5, 1, BOTD.t('fx_boom'));
    g.shake = Math.max(g.shake, 0.3);
    BOTD.Audio.play('mine');
  }

  return { update, damageCell, destroyCell, explodeMine, hasTarget };
})();
