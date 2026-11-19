/* Zombies: aparición, movimiento por su carril, mordiscos y habilidades especiales:
   - runner: salta el primer bloque
   - boss / boss2: aplastan un bloque de golpe cada cierto tiempo
   - shield: su escudo absorbe los guisantes (no las explosiones ni las líneas)
   - digger: avanza bajo tierra (invulnerable) y sale detrás del primer bloque
   - balloon: vuela por encima de los bloques; un guisante revienta el globo */
window.BOTD = window.BOTD || {};

BOTD.Zombies = (() => {
  const C = BOTD.CONFIG;
  const HALF = 0.3;        // medio ancho del zombie (en celdas)
  const JUMP_TIME = 0.45;

  const isBoss = type => !!C.ZOMBIES[type].smashEvery;

  function create(type, lane, rng = Math.random) {
    const d = C.ZOMBIES[type];
    return {
      type, lane,
      x: C.COLS + 0.6,
      hp: d.hp, maxHp: d.hp,
      shield: d.shield || 0, maxShield: d.shield || 0,
      underground: !!d.digs, passedBlock: false,
      balloon: !!d.flies,
      speed: d.speed * (0.9 + rng() * 0.2),
      biteT: 0, smashT: 0, slow: 0, chill: 0, flash: 0,
      jumped: false, jump: 0, jumpFrom: 0, jumpTo: 0,
      anim: Math.random() * 10, biting: false, dead: false
    };
  }

  // source: 'pea' (guisante) u otro (líneas, minas, bombas, rodillos, pinchos)
  function damage(g, z, amount, source) {
    if (z.dead || z.underground) return;
    if (source === 'pea' && z.balloon) {
      z.balloon = false;
      BOTD.Game.puff(g, z.x, z.lane - 0.4, 12);
      BOTD.Game.word(g, BOTD.t('fx_pop'), z.x, z.lane - 0.3, 0.7);
      BOTD.Audio.play('pop');
      return;
    }
    if (source === 'pea' && z.shield > 0) {
      z.shield -= amount;
      z.flash = 0.08;
      if (z.shield <= 0) {
        z.shield = 0;
        BOTD.Game.burst(g, z.x - 0.3, z.lane + 0.5, '#b5763a', 12, 4);
        BOTD.Audio.play('hit');
      }
      return;
    }
    z.hp -= amount;
    z.flash = 0.1;
    if (z.hp <= 0) {
      z.dead = true;
      BOTD.Game.zombieDied(g, z);
    }
  }

  // Al llegar a la casa: rodillo (si queda) o vida perdida. Devuelve true si la partida terminó.
  function checkHouse(g, z) {
    if (z.x < 0.05 && g.rollers[z.lane]) BOTD.Game.triggerRoller(g, z.lane);
    if (z.x < -0.1 && !BOTD.Game.rollerIncoming(g, z)) {
      z.dead = true;
      BOTD.Game.loseLife(g);
      return g.over;
    }
    return false;
  }

  const blocks = cell => cell && cell.type !== 'grave';   // las lápidas no cortan el paso

  function update(g, dt) {
    const slime = C.DEFENSES.slime, ice = C.DEFENSES.ice;
    for (const z of g.zombies) {
      if (z.dead) continue;
      const d = C.ZOMBIES[z.type];
      z.anim += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.slow > 0) z.slow -= dt;
      if (z.chill > 0) z.chill -= dt;
      const mul = Math.min(z.slow > 0 ? slime.slowFactor : 1, z.chill > 0 ? ice.slowFactor : 1);
      const row = g.grid[z.lane];

      // En pleno salto
      if (z.jump > 0) {
        z.jump -= dt;
        const t = Math.min(1, 1 - Math.max(0, z.jump) / JUMP_TIME);
        z.x = z.jumpFrom + (z.jumpTo - z.jumpFrom) * t;
        continue;
      }

      // Excavador bajo tierra: sale en el primer hueco tras pasar un bloque (o cerca de la casa)
      if (z.underground) {
        z.x -= d.underSpeed * dt;
        const c = Math.floor(z.x);
        const cell = c >= 0 && c < C.BUILD_COLS ? row[c] : null;
        if (blocks(cell)) z.passedBlock = true;
        else if ((z.passedBlock && c < C.BUILD_COLS) || z.x < 1.5) {
          z.underground = false;
          BOTD.Game.puff(g, z.x, z.lane + 0.8, 14);
          BOTD.Game.burst(g, z.x, z.lane + 0.8, '#8a5a33', 10, 4);
          BOTD.Audio.play('dig');
        }
        continue;
      }

      // Zombie con globo: vuela por encima de todo
      if (z.balloon) {
        z.biting = false;
        z.x -= z.speed * mul * dt;
        if (checkHouse(g, z)) return;
        continue;
      }

      const col = Math.floor(z.x - HALF);
      const cell = col >= 0 && col < C.BUILD_COLS ? row[col] : null;

      if (blocks(cell)) {
        // El corredor salta el primer bloque si al otro lado hay hueco
        if (d.jumps && !z.jumped) {
          z.jumped = true;
          const land = col - 1;
          if (land < 0 || !blocks(row[land])) {
            z.jump = JUMP_TIME;
            z.jumpFrom = z.x;
            z.jumpTo = col - 0.5;
            z.biting = false;
            BOTD.Audio.play('jump');
            continue;
          }
        }
        z.biting = true;

        // Los jefes aplastan un bloque de golpe cada cierto tiempo
        if (d.smashEvery) {
          z.smashT += dt;
          if (z.smashT >= d.smashEvery) {
            z.smashT = 0;
            z.biteT = 0;
            BOTD.Defenses.damageCell(g, col, z.lane, 1e9);
            BOTD.Game.boom(g, col + 0.5, z.lane + 0.6, 0.5, BOTD.t('fx_smash'));
            g.shake = Math.max(g.shake, 0.5);
            BOTD.Audio.play('smash');
            continue;
          }
        }

        z.biteT += dt * mul;
        const interval = 1 / d.biteRate;
        if (z.biteT >= interval) {
          z.biteT -= interval;
          if (cell.type === 'slime') z.slow = slime.slowTime;
          const thorns = cell.type === 'cactus';
          BOTD.Defenses.damageCell(g, col, z.lane, d.bite);
          BOTD.Audio.play('bite');
          if (thorns) damage(g, z, C.DEFENSES.cactus.thorns, 'thorns');
        }
      } else {
        z.biting = false;
        z.biteT = 0;
        z.x -= z.speed * mul * dt;
        if (checkHouse(g, z)) return;
      }
    }
  }

  return { create, damage, update, isBoss };
})();
