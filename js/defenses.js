/* Comportamiento de cada bloque-defensa: disparo (normal, de hielo y nenúfar), girasol de cerebros,
   mina, baba, cactus, lápidas y daño. En la piscina (Mundo 3), los bloques de los carriles de agua
   se transforman en su versión acuática: alga trampa, remolino y faro. */
window.BOTD = window.BOTD || {};

BOTD.Defenses = (() => {
  const C = BOTD.CONFIG;
  const H = C.ROWS + C.HIDDEN_ROWS;
  const GUNS = { shooter: true, ice: true, lily: true };   // defensas que disparan desde su bloque activo

  function update(g, dt) {
    if (g.lit) g.lit.clear();
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
            g.projectiles.push({ lane: y, x: x + 0.9, speed: D.peaSpeed, dmg, ice: c.type === 'ice', lily: c.type === 'lily', dead: false });
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
        } else if (c.type === 'whirl') {
          const D = C.DEFENSES.whirl;
          c.cd -= dt;
          if (c.cd <= 0 && whirlTargets(g, x, y).length) {
            c.cd = D.interval;
            c.recoil = 0.6;
            whirlPush(g, x, y);
          }
        } else if (c.type === 'lighthouse' && g.lit) {
          for (let l = y - 1; l <= y + 1; l++) g.lit.add(l);
        }
      }
    }
  }

  function hasTarget(g, lane, x) {
    return g.zombies.some(z => !z.dead && !z.underground && z.lane === lane && z.x > x + 0.5 && z.x < C.COLS + 0.2);
  }

  /* ---------- Piscina ---------- */
  const isWater = (g, y) => !!(g.water && g.water.has(y));

  // Transforma los bloques según estén en el agua o fuera (tras fijar una pieza y tras bajar las filas).
  // Conserva la proporción de vida. Devuelve los tipos acuáticos que han aparecido.
  function refreshWater(g) {
    const fresh = [];
    if (!g.water || !g.water.size) return fresh;
    const D = C.DEFENSES, AQ = C.POOL.aqua;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const c = g.grid[y][x];
        if (!c || c.type === 'grave') continue;
        const wet = isWater(g, y);
        c.wet = wet;
        let to = null;
        if (wet && AQ[c.type]) { c.land = c.type; to = AQ[c.type]; }
        else if (!wet && c.land) { to = c.land; c.land = null; }
        if (!to) continue;
        const ratio = c.maxHp ? Math.max(0, c.hp / c.maxHp) : 1;
        const d = D[to];
        c.type = to;
        c.maxHp = c.gun && d.gunHp ? d.gunHp : d.hp;
        c.hp = Math.max(1, Math.round(c.maxHp * ratio));
        c.cd = to === 'whirl' ? 1 : 0.3 + Math.random() * 0.4;
        if (wet) {
          fresh.push(to);
          if (BOTD.Game.splash) BOTD.Game.splash(g, x + 0.5, y + 0.8, 4);
        }
      }
    }
    return fresh;
  }

  // Zombies que nadan en el carril del remolino, a su derecha y a su alcance (los jefes no se mueven)
  function whirlTargets(g, x, y) {
    const R = C.DEFENSES.whirl.range;
    return g.zombies.filter(z => !z.dead && z.lane === y && z.jump <= 0 && !BOTD.Zombies.isBoss(z.type)
      && z.x > x + 0.5 && z.x < x + 1 + R);
  }

  function whirlPush(g, x, y) {
    const D = C.DEFENSES.whirl;
    whirlTargets(g, x, y).forEach(z => {
      z.x = Math.min(C.COLS + 0.5, z.x + D.push);
      z.biting = false;
      z.biteT = 0;
      if (BOTD.Game.splash) BOTD.Game.splash(g, z.x, y + 0.8, 6);
    });
    BOTD.Game.word(g, BOTD.t('fx_whirl'), x + 1.5, y + 0.2, 0.75);
    BOTD.Audio.play('splash');
  }

  // Alga trampa: agarra al zombie más cercano de su carril y lo hunde (a los jefes solo les hace daño)
  function kelpGrab(g, x, y) {
    const D = C.DEFENSES.kelp;
    g.grid[y][x] = null;
    let best = null;
    for (const z of g.zombies) {
      if (z.dead || z.lane !== y || z.jump > 0) continue;
      const d = Math.abs(z.x - (x + 0.5));
      if (d < 1.3 && (!best || d < Math.abs(best.x - (x + 0.5)))) best = z;
    }
    if (best) {
      const boss = BOTD.Zombies.isBoss(best.type);
      best.diving = false;
      BOTD.Zombies.damage(g, best, boss ? D.damage : 1e9, 'kelp');
      if (best.dead) best.drowned = true;
    }
    if (BOTD.Game.splash) BOTD.Game.splash(g, x + 0.5, y + 0.7, 14);
    BOTD.Game.word(g, BOTD.t('fx_gulp'), x + 0.5, y, 0.9);
    BOTD.Audio.play('splash');
  }

  function damageCell(g, x, y, amount) {
    const c = g.grid[y] && g.grid[y][x];
    if (!c || c.type === 'grave') return;
    if (c.type === 'mine') { explodeMine(g, x, y); return; }
    if (c.type === 'kelp') { kelpGrab(g, x, y); return; }
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

  return { update, damageCell, destroyCell, explodeMine, hasTarget, isWater, refreshWater, whirlPush, whirlTargets, kelpGrab };
})();
