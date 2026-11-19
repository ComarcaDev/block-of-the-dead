/* Niveles y oleadas.
   fall: segundos que tarda una pieza en bajar una fila.
   lanes: cuántos carriles (desde abajo) usan los zombies.
   waves: lista de oleadas; spawns = [[tipo, cantidad], ...]; interval = segundos entre zombies;
          big = gran oleada (bandera en la barra; la última oleada siempre lo es). */
window.BOTD = window.BOTD || {};

BOTD.Levels = (() => {
  const C = BOTD.CONFIG;

  const LEVELS = [
    {
      nameKey: 'lvl1', ambient: 'day', fall: 0.85, lanes: 4, startDelay: 10,
      waves: [
        { spawns: [['basic', 3]], interval: 8 },
        { spawns: [['basic', 5]], interval: 6 },
        { spawns: [['basic', 7]], interval: 5 }
      ]
    },
    {
      nameKey: 'lvl2', ambient: 'day', fall: 0.8, lanes: 5, startDelay: 10,
      waves: [
        { spawns: [['basic', 4]], interval: 7 },
        { spawns: [['basic', 4], ['cone', 2]], interval: 6 },
        { spawns: [['basic', 5], ['cone', 4]], interval: 5 }
      ]
    },
    {
      nameKey: 'lvl3', ambient: 'sunset', fall: 0.72, lanes: 6, startDelay: 10,
      waves: [
        { spawns: [['basic', 4], ['runner', 2]], interval: 6 },
        { spawns: [['cone', 4], ['runner', 3]], interval: 5 },
        { spawns: [['basic', 5], ['cone', 3], ['runner', 4]], interval: 4.5 }
      ]
    },
    {
      nameKey: 'lvl4', ambient: 'night', fall: 0.65, lanes: 7, startDelay: 10,
      waves: [
        { spawns: [['basic', 6], ['cone', 3]], interval: 5 },
        { spawns: [['runner', 5], ['cone', 4]], interval: 4.5, big: true },
        { spawns: [['basic', 6], ['cone', 5], ['runner', 5]], interval: 3.8 },
        { spawns: [['basic', 8], ['cone', 6], ['runner', 6]], interval: 3.5 }
      ]
    },
    {
      nameKey: 'lvl5', ambient: 'night', fall: 0.6, lanes: 8, startDelay: 10,
      waves: [
        { spawns: [['basic', 6], ['cone', 4], ['runner', 3]], interval: 4.5 },
        { spawns: [['cone', 6], ['runner', 6]], interval: 4, big: true },
        { spawns: [['basic', 8], ['cone', 6], ['runner', 6]], interval: 3.5 },
        { spawns: [['basic', 6], ['cone', 4]], interval: 4, boss: true }
      ]
    },

    /* ----- Mundo 2: la noche en el cementerio -----
       graves: lápidas fijas en la zona de construcción; fog: columnas de niebla en la zona de aparición */
    {
      nameKey: 'lvl6', world: 2, ambient: 'graveyard', fall: 0.72, lanes: 6, startDelay: 12, graves: 4, fog: 0,
      waves: [
        { spawns: [['basic', 5], ['cone', 2]], interval: 6 },
        { spawns: [['basic', 4], ['bucket', 2], ['cone', 2]], interval: 5 },
        { spawns: [['basic', 5], ['cone', 3], ['bucket', 3]], interval: 4.5 }
      ]
    },
    {
      nameKey: 'lvl7', world: 2, ambient: 'graveyard', fall: 0.7, lanes: 6, startDelay: 12, graves: 5, fog: 0,
      waves: [
        { spawns: [['basic', 5], ['shield', 2]], interval: 5.5 },
        { spawns: [['cone', 3], ['shield', 3], ['runner', 2]], interval: 4.8, big: true },
        { spawns: [['bucket', 3], ['shield', 3], ['cone', 3], ['basic', 3]], interval: 4.2 }
      ]
    },
    {
      nameKey: 'lvl8', world: 2, ambient: 'graveyard', fall: 0.66, lanes: 7, startDelay: 12, graves: 5, fog: 3,
      waves: [
        { spawns: [['basic', 5], ['digger', 2]], interval: 5 },
        { spawns: [['cone', 4], ['digger', 3], ['shield', 2]], interval: 4.5, big: true },
        { spawns: [['bucket', 3], ['digger', 3], ['runner', 3], ['basic', 4]], interval: 4 },
        { spawns: [['cone', 5], ['shield', 3], ['digger', 3], ['bucket', 2]], interval: 3.6 }
      ]
    },
    {
      nameKey: 'lvl9', world: 2, ambient: 'graveyard', fall: 0.62, lanes: 7, startDelay: 12, graves: 6, fog: 4,
      waves: [
        { spawns: [['basic', 4], ['balloon', 3]], interval: 5 },
        { spawns: [['balloon', 3], ['cone', 4], ['runner', 3]], interval: 4.5, big: true },
        { spawns: [['bucket', 3], ['balloon', 3], ['digger', 3], ['shield', 2]], interval: 4 },
        { spawns: [['basic', 6], ['balloon', 4], ['shield', 3], ['bucket', 3]], interval: 3.5 }
      ]
    },
    {
      nameKey: 'lvl10', world: 2, ambient: 'graveyard', fall: 0.58, lanes: 8, startDelay: 12, graves: 6, fog: 4,
      waves: [
        { spawns: [['cone', 5], ['bucket', 3], ['runner', 3]], interval: 4.2 },
        { spawns: [['shield', 4], ['digger', 3], ['balloon', 3]], interval: 4, big: true },
        { spawns: [['bucket', 4], ['balloon', 3], ['runner', 4], ['digger', 3]], interval: 3.6 },
        { spawns: [['basic', 6], ['cone', 4], ['bucket', 3], ['shield', 3]], interval: 3.6, boss: 'boss2' }
      ]
    }
  ];

  // Mundos para el mapa de niveles (índices de LEVELS)
  const WORLDS = [
    { nameKey: 'world1', levels: [0, 1, 2, 3, 4] },
    { nameKey: 'world2', levels: [5, 6, 7, 8, 9] }
  ];

  // Elección de defensas válida: cada pieza lleva una defensa desbloqueada (o la de serie)
  function loadoutFor(saved, allowed) {
    const out = {};
    const ok = new Set(allowed);
    BOTD.Pieces.BAG.forEach(kind => {
      const want = saved && saved[kind];
      out[kind] = want && ok.has(want) ? want : BOTD.Pieces.TYPE[kind];
    });
    return out;
  }

  // i < 0 → nivel de supervivencia (se crea nuevo en cada partida, porque sus oleadas crecen)
  function get(i) { return i < 0 ? makeSurvival() : LEVELS[i]; }

  /* ---------- Modo supervivencia ---------- */
  const SV = () => C.SURVIVAL;

  // Oleada n (desde 0): más zombies, más variedad y más rápido cada vez
  function survivalWave(n) {
    const s = SV();
    const pool = ['basic', 'cone'];
    if (n >= 2) pool.push('runner');
    if (n >= 4) pool.push('bucket');
    if (n >= 6) pool.push('shield', 'balloon');
    if (n >= 8) pool.push('digger');
    const count = s.baseCount + s.countPerWave * n;
    const tally = {};
    for (let i = 0; i < count; i++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      tally[t] = (tally[t] || 0) + 1;
    }
    const wave = {
      spawns: Object.keys(tally).map(t => [t, tally[t]]),
      interval: Math.max(s.intervalMin, s.intervalStart - s.intervalPerWave * n),
      big: (n + 1) % s.bigEvery === 0
    };
    if ((n + 1) % s.bossEvery === 0) wave.boss = n + 1 >= s.bossEvery * 2 ? 'boss2' : 'boss';
    return wave;
  }

  function makeSurvival() {
    const s = SV();
    return {
      nameKey: 'survival', endless: true, world: 0, ambient: 'night',
      fall: s.fallStart, lanes: s.lanes, startDelay: s.startDelay, graves: 0, fog: 0,
      waves: [survivalWave(0)]
    };
  }

  /* ---------- Desbloqueos ----------
     Al empezar se tienen estas defensas; cada nivel ganado por primera vez desbloquea otra.
     Las defensas que aún no existen en el juego (fases futuras) se ignoran. */
  const BASE_DEFENSES = ['wall', 'bunker', 'shooter'];
  const UNLOCKS = { 1: 'mine', 2: 'slime', 3: 'ice', 4: 'cactus', 6: 'sunflower', 7: 'bomb' };
  const SHOP_UNLOCKS = { bomb: 7 };   // artículo de tienda → nivel que hay que ganar
  const exists = t => t === 'bomb' || !!C.DEFENSES[t];

  // Defensas disponibles tras ganar `won` niveles
  function defensesFor(won) {
    const out = BASE_DEFENSES.slice();
    for (const n in UNLOCKS) {
      const t = UNLOCKS[n];
      if (won >= +n && t !== 'bomb' && exists(t)) out.push(t);
    }
    return out;
  }

  // Artículos de la tienda todavía bloqueados tras ganar `won` niveles
  function shopLockedFor(won) {
    return Object.keys(SHOP_UNLOCKS).filter(item => won < SHOP_UNLOCKS[item]);
  }

  // Defensa nueva que se consigue al ganar el nivel `levelNum` (1-based), o null
  function unlockAt(levelNum) {
    const t = UNLOCKS[levelNum];
    return t && exists(t) ? t : null;
  }

  // Nivel (1-based) que desbloquea una defensa, o 0 si se tiene desde el principio
  function unlockLevelOf(type) {
    for (const n in UNLOCKS) if (UNLOCKS[n] === type) return +n;
    return 0;
  }

  // Una oleada es "gran oleada" si lo indica o si es la última del nivel
  function isBig(level, i) {
    const w = level.waves[i];
    if (!w) return false;
    return !!(w.big || (!level.endless && i === level.waves.length - 1));
  }

  function waveSize(wave) {
    return wave.spawns.reduce((s, [, n]) => s + n, 0) + (wave.boss ? 1 : 0);
  }

  function buildQueue(wave) {
    const q = [];
    wave.spawns.forEach(([type, n]) => { for (let i = 0; i < n; i++) q.push(type); });
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    if (wave.boss) q.splice(Math.floor(q.length / 2), 0, wave.boss === true ? 'boss' : wave.boss);
    return q;
  }

  function startWaves(g) {
    const L = g.level;
    const sizes = L.waves.map(waveSize);
    const total = sizes.reduce((a, b) => a + b, 0);
    // Posición (0..1) en la barra donde empieza cada oleada; banderas en las grandes
    const starts = [];
    let acc = 0;
    sizes.forEach(s => { starts.push(acc / total); acc += s; });
    g.waves = {
      index: -1, queue: [], spawnT: 0, breakT: L.startDelay, state: 'break', lastLane: -1,
      total, spawned: 0, starts, burstLeft: 0,
      flags: starts.filter((_, i) => isBig(L, i)),
      warned: false
    };
    BOTD.Game.setBanner(g, BOTD.t('get_ready'), 2.5);
  }

  // Progreso del nivel entre 0 y 1 (zombies que ya han aparecido)
  function progress(g) {
    const w = g.waves;
    return w && w.total ? Math.min(1, w.spawned / w.total) : 0;
  }

  function spawn(g, type) {
    const w = g.waves;
    let lane;
    if (BOTD.Zombies.isBoss(type)) {
      lane = g.firstLane + Math.floor(g.level.lanes / 2);
      BOTD.Game.setBanner(g, BOTD.t('boss_incoming'), 2.5, '#ff6b6b');
      BOTD.Audio.play('smash');
    } else {
      do { lane = g.firstLane + Math.floor(Math.random() * g.level.lanes); }
      while (g.level.lanes > 1 && lane === w.lastLane);
    }
    w.lastLane = lane;
    w.spawned++;
    const z = BOTD.Zombies.create(type, lane);
    if (g.level.endless) {
      // Supervivencia: más vida y algo más de velocidad en cada oleada
      const s = SV(), n = Math.max(0, w.index);
      const hpMul = 1 + s.hpPerWave * n;
      z.hp = z.maxHp = Math.round(z.hp * hpMul);
      z.shield = z.maxShield = Math.round(z.shield * hpMul);
      z.speed *= Math.min(s.maxSpeedMul, 1 + s.speedPerWave * n);
    }
    g.zombies.push(z);
    if (g.hooks.onSpawn) g.hooks.onSpawn(type);
  }

  function updateWaves(g, dt) {
    if (g.holdWaves) return;   // el tutorial pausa las oleadas
    const w = g.waves;
    const L = g.level;
    if (w.state === 'break') {
      w.breakT -= dt;
      // Aviso de gran oleada unos segundos antes
      const nextBig = isBig(L, w.index + 1);
      if (nextBig && !w.warned && w.breakT <= 3) {
        w.warned = true;
        BOTD.Game.setBanner(g, BOTD.t('big_wave'), 2.6, '#ff6b6b');
        BOTD.Audio.play('wave');
      }
      if (w.breakT <= 0) {
        w.index++;
        w.warned = false;
        w.queue = buildQueue(L.waves[w.index]);
        w.spawnT = 1.5;
        w.state = 'spawning';
        // En las grandes oleadas salen varios zombies casi a la vez
        w.burstLeft = nextBig ? Math.min(3, w.queue.length - 1) : 0;
        const last = !L.endless && w.index === L.waves.length - 1;
        BOTD.Game.setBanner(g, last ? BOTD.t('final_wave') : BOTD.t('wave_n', { n: w.index + 1 }), 2);
        BOTD.Audio.play('wave');
        if (g.hooks.onEvent) g.hooks.onEvent('wave', { n: w.index + 1, survival: !!L.endless });
      }
    } else if (w.state === 'spawning') {
      w.spawnT -= dt;
      if (w.spawnT <= 0 && w.queue.length) {
        spawn(g, w.queue.shift());
        if (w.burstLeft > 0) { w.burstLeft--; w.spawnT = 0.4; }
        else w.spawnT = L.waves[w.index].interval * (0.75 + Math.random() * 0.5);
      }
      if (!w.queue.length) w.state = 'clearing';
    } else if (w.state === 'clearing') {
      if (!g.zombies.some(z => !z.dead)) {
        if (L.endless) {
          // Supervivencia: se genera la siguiente oleada y las piezas caen algo más rápido
          const s = SV(), n = w.index + 1;
          L.waves.push(survivalWave(n));
          L.fall = Math.max(s.fallMin, s.fallStart - s.fallPerWave * n);
          w.total += waveSize(L.waves[n]);
          w.state = 'break';
          w.breakT = C.WAVE_BREAK;
        } else if (w.index >= L.waves.length - 1) BOTD.Game.win(g);
        else { w.state = 'break'; w.breakT = C.WAVE_BREAK; }
      }
    }
  }

  return {
    get, startWaves, updateWaves, progress, isBig, survivalWave,
    defensesFor, shopLockedFor, unlockAt, unlockLevelOf, BASE_DEFENSES, WORLDS, loadoutFor,
    get count() { return LEVELS.length; }
  };
})();
