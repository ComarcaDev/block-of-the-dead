/* Guisantes disparados por los lanzaguisantes. Pasan por encima de los bloques. */
window.BOTD = window.BOTD || {};

BOTD.Projectiles = (() => {
  const C = BOTD.CONFIG;

  function update(g, dt) {
    for (const p of g.projectiles) {
      if (p.dead) continue;
      p.x += p.speed * dt;
      for (const z of g.zombies) {
        if (z.dead || z.lane !== p.lane || z.jump > 0 || z.underground) continue;
        if (Math.abs(z.x - p.x) < 0.35) {
          BOTD.Zombies.damage(g, z, p.dmg, 'pea');
          if (p.ice && !z.dead) z.chill = C.DEFENSES.ice.slowTime;
          BOTD.Game.burst(g, p.x, p.lane + 0.4, p.ice ? '#9fe0ff' : '#8be36a', 5, 2);
          p.dead = true;
          break;
        }
      }
      if (p.x > C.COLS + 1) p.dead = true;
    }
    g.projectiles = g.projectiles.filter(p => !p.dead);
  }

  return { update };
})();
