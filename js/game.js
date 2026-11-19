/* Lógica de una partida: piezas, líneas, tienda, vidas, efectos y fin de nivel. */
window.BOTD = window.BOTD || {};

BOTD.Game = (() => {
  const C = BOTD.CONFIG;
  const P = BOTD.Pieces;
  const B = BOTD.Board;
  const H = C.ROWS + C.HIDDEN_ROWS;

  const COLORS = {
    wall: '#9096a1', bunker: '#9a6a3a', shooter: '#4caf3c', mine: '#ff8c1a',
    slime: '#a259d9', single: '#c3c8d1', bomb: '#ffd23f', dirt: '#8a5a33',
    ice: '#8fd6f7', cactus: '#4caf3c', sunflower: '#ffd23f', grave: '#a19eae'
  };

  const ALL_DEFENSES = ['wall', 'bunker', 'shooter', 'mine', 'slime', 'ice', 'cactus', 'sunflower'];

  /* opts (todas opcionales):
     - defenses: defensas desbloqueadas (las demás piezas caen como tierra)
     - loadout: defensa elegida para cada pieza { I: 'wall', T: 'ice', ... }
     - shopLocked: artículos de la tienda aún bloqueados
     - holdWaves: no empezar las oleadas hasta que se desactive (tutorial)
     - mods: efectos de las mejoras del cobertizo (BOTD.Progress.mods) */
  function create(levelIndex, hooks, opts) {
    opts = opts || {};
    const level = BOTD.Levels.get(levelIndex);
    const mods = Object.assign({}, BOTD.Progress.NO_MODS, opts.mods || {});
    const g = {
      levelIndex, level, hooks: hooks || {},
      grid: B.create(), piece: null, bag: [], next: null, nextBought: false,
      zombies: [], projectiles: [], particles: [], texts: [], flashRows: [],
      puffs: [], words: [], corpses: [], debris: [], pieceSeq: 0,
      lives: C.LIVES, brains: C.START_BRAINS, score: 0, lines: 0, kills: 0,
      fallTimer: 0, lockTimer: 0, lockResets: 0, softDrop: false,
      shake: 0, houseFlash: 0, time: 0, banner: null,
      over: false, result: null, endTimer: 0, endFired: false,
      firstLane: H - level.lanes, waves: null,
      allowed: new Set(opts.defenses || ALL_DEFENSES),
      loadout: Object.assign({}, opts.loadout || {}),
      shopLocked: new Set(opts.shopLocked || []),
      holdWaves: !!opts.holdWaves,
      rollers: new Array(H).fill(false), rolling: [], rollerBonus: 0,
      mods, spareRollers: mods.spareRollers, combo: 0, survival: !!level.endless,
      stats: { moves: 0, rotates: 0, rotateTries: 0, drops: 0, locks: 0, lineClears: 0, buys: 0, rollersUsed: 0,
        livesLost: 0, maxCombo: 0 }
    };
    g.lives += mods.lives;
    g.brains += mods.startBrains;
    for (let r = g.firstLane; r < H; r++) g.rollers[r] = true;
    placeGraves(g, level.graves || 0);
    g.next = pullFromBag(g);
    spawnPiece(g);
    BOTD.Levels.startWaves(g);
    return g;
  }

  // Defensa real que dará una pieza: la elegida, o la de serie; tierra si no está desbloqueada
  function typeOf(g, kind) {
    const base = P.TYPE[kind];
    if (base === 'single' || base === 'bomb') return base;
    const chosen = g.loadout[kind];
    if (chosen && g.allowed.has(chosen)) return chosen;
    return g.allowed.has(base) ? base : 'dirt';
  }

  // Lápidas del Mundo 2: ocupan celdas de la zona de construcción (máx. 2 por fila)
  function placeGraves(g, n) {
    let placed = 0, tries = 0;
    const perRow = {};
    while (placed < n && tries++ < 200) {
      const y = g.firstLane + Math.floor(Math.random() * (H - g.firstLane));
      const x = 1 + Math.floor(Math.random() * (C.BUILD_COLS - 2));
      if (g.grid[y][x] || (perRow[y] || 0) >= 2) continue;
      g.grid[y][x] = B.makeCell('grave', false, -100 - placed, null);
      perRow[y] = (perRow[y] || 0) + 1;
      placed++;
    }
  }

  // Aviso de sucesos para logros y estadísticas
  function emit(g, name, data) {
    if (g.hooks.onEvent) g.hooks.onEvent(name, data || {});
  }

  function pullFromBag(g) {
    if (!g.bag.length) g.bag = P.makeBag();
    return g.bag.pop();
  }

  function spawnPiece(g) {
    const kind = g.next;
    g.next = pullFromBag(g);
    g.nextBought = false;
    const p = P.create(kind);
    p.x = Math.floor((C.BUILD_COLS - p.matrix.length) / 2);
    p.y = 0;   // nace en las filas ocultas y asoma por arriba del tablero
    g.piece = p;
    g.lockTimer = 0;
    g.lockResets = 0;
    g.fallTimer = 0;
    if (B.collides(g.grid, p)) { g.piece = null; lose(g, 'top'); }
  }

  /* ---------- Controles de la pieza ---------- */
  function isGrounded(g) {
    return B.collides(g.grid, g.piece, 0, 1);
  }

  function resetLock(g) {
    if (g.lockResets < 15 && isGrounded(g)) { g.lockTimer = 0; g.lockResets++; }
  }

  function move(g, dx) {
    const p = g.piece;
    if (!p || g.over) return false;
    if (B.collides(g.grid, p, dx, 0)) return false;
    p.x += dx;
    resetLock(g);
    g.stats.moves++;
    BOTD.Audio.play('move');
    return true;
  }

  function rotate(g, dir) {
    const p = g.piece;
    if (!p || g.over) return;
    g.stats.rotateTries++;   // cuenta también intentos con piezas que no giran (O, 1×1)
    if (p.kind === 'O' || p.matrix.length === 1) return;
    const m = dir > 0 ? P.rotateCW(p.matrix) : P.rotateCCW(p.matrix);
    for (const [kx, ky] of P.KICKS) {
      if (!B.collides(g.grid, p, kx, ky, m)) {
        p.matrix = m;
        p.x += kx;
        p.y += ky;
        resetLock(g);
        g.stats.rotates++;
        BOTD.Audio.play('rotate');
        return;
      }
    }
  }

  function hardDrop(g) {
    const p = g.piece;
    if (!p || g.over) return;
    let d = 0;
    while (!B.collides(g.grid, p, 0, 1)) { p.y++; d++; }
    g.score += d * 2;
    g.shake = Math.max(g.shake, 0.12);
    g.stats.drops++;
    BOTD.Audio.play('harddrop');
    lock(g);
  }

  function ghostY(g) {
    let d = 0;
    while (!B.collides(g.grid, g.piece, 0, d + 1)) d++;
    return g.piece.y + d;
  }

  function updatePiece(g, dt) {
    const p = g.piece;
    if (!p) return;
    if (isGrounded(g)) {
      g.lockTimer += dt;
      if (g.lockTimer >= C.LOCK_DELAY) lock(g);
      return;
    }
    const interval = g.softDrop ? g.level.fall / C.SOFT_DROP_FACTOR : g.level.fall;
    g.fallTimer += dt;
    while (g.fallTimer >= interval) {
      g.fallTimer -= interval;
      if (B.collides(g.grid, p, 0, 1)) { g.fallTimer = 0; break; }
      p.y++;
      g.lockTimer = 0;
      if (g.softDrop) g.score += 1;
    }
  }

  /* ---------- Fijar pieza, líneas y bomba ---------- */
  function lock(g) {
    const p = g.piece;
    if (!p) return;
    const type = typeOf(g, p.kind);
    g.piece = null;
    g.stats.locks++;
    let topOut = false;

    if (type === 'bomb') {
      megaBomb(g, p.x, Math.max(0, p.y));
    } else {
      const id = g.pieceSeq++;
      const color = P.COLORS[p.kind];
      p.matrix.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const gx = p.x + x, gy = p.y + y;
        if (gy < 0) { topOut = true; return; }
        const cell = B.makeCell(type, v === 2, id, color);
        if (type === 'wall' || type === 'bunker') cell.hp = cell.maxHp = Math.round(cell.hp * g.mods.wall);
        g.grid[gy][gx] = cell;
      }));
      BOTD.Audio.play('lock');
      const rows = B.fullRows(g.grid);
      if (rows.length) {
        g.combo++;
        g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
        clearLines(g, rows);
      } else {
        g.combo = 0;
      }
    }
    if (type === 'bomb') g.combo = 0;

    for (let y = 0; y < C.HIDDEN_ROWS; y++) if (g.grid[y].some(c => c)) topOut = true;
    if (topOut) { lose(g, 'top'); return; }
    spawnPiece(g);
  }

  function clearLines(g, rows) {
    const L = C.LINES;
    const n = Math.min(rows.length, 4);
    rows.forEach(r => {
      g.zombies.forEach(z => {
        if (z.dead) return;
        const dl = Math.abs(z.lane - r);
        if (dl === 0) BOTD.Zombies.damage(g, z, L.laneDamage);
        else if (dl === 1) BOTD.Zombies.damage(g, z, L.splashDamage);
      });
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const c = g.grid[r][x];
        if (c) burst(g, x + 0.5, r + 0.5, COLORS[c.type], 4, 5);
        if (x % 2 === 0) puff(g, x + 0.5, r + 0.5, 10 + Math.random() * 8);
      }
      burst(g, C.BUILD_COLS / 2, r + 0.5, '#fff27a', 10, 8, 'star');
      g.flashRows.push({ row: r, t: 0.45 });
    });
    B.removeRows(g.grid, rows);
    // Combo: piezas seguidas que completan línea multiplican los cerebros
    const combo = Math.max(1, g.combo || 1);
    const mult = 1 + C.COMBO_STEP * (combo - 1);
    const brains = Math.round(L.brains[n] * mult);
    addBrains(g, brains, C.BUILD_COLS / 2, rows[0] + 0.3);
    g.score += Math.round(L.score[n] * mult);
    g.lines += rows.length;
    g.stats.lineClears++;
    word(g, BOTD.t('fx_line' + n), C.BUILD_COLS / 2, rows[0] - 0.2, 1 + n * 0.15);
    if (combo >= 2) {
      const cy = Math.max(C.HIDDEN_ROWS + 0.8, rows[0] - 1.2);   // por encima de la línea, sin salirse
      word(g, BOTD.t('fx_combo', { n: combo }), C.BUILD_COLS / 2, cy, 0.9 + Math.min(combo, 6) * 0.12);
      burst(g, C.BUILD_COLS / 2, rows[0] + 0.5, '#ff9ecb', 8 + combo * 4, 7 + combo, 'star');
      BOTD.Audio.play('combo', combo);
    }
    g.shake = Math.max(g.shake, 0.2 + 0.08 * n + 0.05 * Math.min(combo, 6));
    BOTD.Audio.play('line', n);
    emit(g, 'lines', { n, combo });
  }

  function megaBomb(g, cx, cy) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (y < 0 || y >= H || x < 0 || x >= C.BUILD_COLS) continue;
        const c = g.grid[y][x];
        if (c) { burst(g, x + 0.5, y + 0.5, COLORS[c.type], 6, 4); g.grid[y][x] = null; }
      }
    }
    g.zombies.forEach(z => {
      if (!z.dead && Math.abs(z.lane - cy) <= 1 && Math.abs(z.x - (cx + 0.5)) <= 1.8) {
        BOTD.Zombies.damage(g, z, C.BOMB.damage);
      }
    });
    boom(g, cx + 0.5, cy + 0.5, 2, BOTD.t('fx_boom'));
    g.shake = Math.max(g.shake, 0.5);
    BOTD.Audio.play('bomb');
  }

  /* ---------- Tienda ---------- */
  function buy(g, item, kind) {
    if (g.over) return false;
    const cost = C.SHOP[item];
    if (g.shopLocked.has(item)) {
      BOTD.Audio.play('deny');
      addText(g, BOTD.t('shop_locked'), C.BUILD_COLS / 2, C.HIDDEN_ROWS + 0.8, '#ff6b6b', 1.4);
      return false;
    }
    if (g.nextBought) {
      BOTD.Audio.play('deny');
      addText(g, BOTD.t('shop_wait'), C.BUILD_COLS / 2, C.HIDDEN_ROWS + 0.8, '#ff6b6b', 1.2);
      return false;
    }
    if (g.brains < cost) {
      BOTD.Audio.play('deny');
      addText(g, BOTD.t('not_enough'), C.BUILD_COLS / 2, C.HIDDEN_ROWS + 0.8, '#ff6b6b', 1.2);
      return false;
    }
    g.brains -= cost;
    g.bag.unshift(g.next);   // la pieza sustituida vuelve a la bolsa
    g.next = item === 'choose' ? kind : item === 'single' ? 'U' : 'B';
    g.nextBought = true;
    g.stats.buys++;
    BOTD.Audio.play('buy');
    return true;
  }

  function canAfford(g, item) {
    return !g.over && !g.nextBought && !g.shopLocked.has(item) && g.brains >= C.SHOP[item];
  }

  /* ---------- Rodillos de jardín (última defensa de cada carril) ---------- */
  const ROLLER = { speed: 7, startX: -0.9, bossDamage: 1000, brains: 10, score: 100 };

  function triggerRoller(g, lane) {
    if (!g.rollers[lane]) return false;
    g.rollers[lane] = false;
    g.rolling.push({ lane, x: ROLLER.startX, hit: new Set() });
    g.stats.rollersUsed++;
    word(g, BOTD.t('fx_roller'), 1.2, lane + 0.2, 0.9);
    g.shake = Math.max(g.shake, 0.25);
    BOTD.Audio.play('roller');
    return true;
  }

  // ¿Hay un rodillo en marcha que todavía alcanzará a este zombie?
  function rollerIncoming(g, z) {
    return g.rolling.some(r => r.lane === z.lane && r.x < z.x + 0.4 && !r.hit.has(z));
  }

  function updateRollers(g, dt) {
    for (const r of g.rolling) {
      r.x += ROLLER.speed * dt;
      for (const z of g.zombies) {
        if (z.dead || z.underground || z.lane !== r.lane || r.hit.has(z) || Math.abs(z.x - r.x) > 0.5) continue;
        r.hit.add(z);
        BOTD.Zombies.damage(g, z, BOTD.Zombies.isBoss(z.type) ? ROLLER.bossDamage : 1e9);
        puff(g, z.x, z.lane + 0.7, 16);
      }
      if (Math.random() < 0.5) puff(g, r.x - 0.4, r.lane + 0.85, 6 + Math.random() * 5);
      // Al terminar su recorrido, un rodillo de reserva (mejora) ocupa su lugar
      if (r.x >= C.COLS + 1.5 && g.spareRollers > 0 && !g.rollers[r.lane]) {
        g.spareRollers--;
        g.rollers[r.lane] = true;
        addText(g, BOTD.t('spare_roller'), 1.4, r.lane + 0.3, '#ffe23f', 1.6);
      }
    }
    g.rolling = g.rolling.filter(r => r.x < C.COLS + 1.5);
  }

  /* ---------- Vidas y final ---------- */
  function loseLife(g) {
    if (g.over) return;
    g.lives--;
    g.stats.livesLost++;
    g.houseFlash = 0.6;
    g.shake = Math.max(g.shake, 0.45);
    BOTD.Audio.play('lifeLost');
    setBanner(g, BOTD.t('life_lost'), 1.4, '#ff6b6b');
    if (g.lives <= 0) lose(g, 'lives');
  }

  function lose(g, reason) {
    if (g.over) return;
    g.over = true;
    g.piece = null;
    g.result = { won: false, reason };
    g.endTimer = 1.4;
    g.shake = Math.max(g.shake, 0.5);
  }

  function win(g) {
    if (g.over) return;
    g.over = true;
    g.piece = null;
    // Bonificación por rodillos sin usar
    const left = g.rollers.filter(Boolean).length;
    g.rollerBonus = left;
    g.score += left * ROLLER.score;
    g.brains += left * ROLLER.brains;
    g.result = { won: true, rollersLeft: left, rollerPoints: left * ROLLER.score };
    g.endTimer = 1.6;
    setBanner(g, BOTD.t('win_title'), 2, '#8be36a');
  }

  /* ---------- Cerebros y muerte de zombies ---------- */
  function addBrains(g, n, x, y) {
    g.brains += n;
    addText(g, '+' + n, x, y, '#ff9ecb', 1.2, 'brain');
    if (g.hooks.onBrains) g.hooks.onBrains(n, x, y);
  }

  function zombieDied(g, z) {
    const d = C.ZOMBIES[z.type];
    g.score += d.score;
    g.kills++;
    addBrains(g, d.brains, z.x, z.lane + 0.1);
    const k = z.type === 'boss2' ? 1.6 : z.type === 'boss' ? 1.45 : 0.9;
    // El cuerpo cae y se desvanece; la cabeza sale volando
    g.corpses.push({ type: z.type, x: z.x, lane: z.lane, anim: z.anim, t: 0.8, max: 0.8 });
    g.debris.push({
      type: z.type, x: z.x, y: z.lane + 1 - (66 * k) / C.CELL,
      vx: 1.2 + Math.random() * 1.5, vy: -4 - Math.random() * 2,
      rot: 0, vr: 5 + Math.random() * 6, t: 1.1, k
    });
    burst(g, z.x, z.lane + 0.6, '#9cc77e', 10, 4);
    puff(g, z.x, z.lane + 0.7, 14);
    BOTD.Audio.play('zombieDie');
    emit(g, 'kill', { type: z.type });
  }

  /* ---------- Efectos ---------- */
  function burst(g, x, y, color, n, power, shape) {
    if (BOTD.Quality && BOTD.Quality.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const life = 0.4 + Math.random() * 0.5;
      g.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * power,
        vy: (Math.random() - 0.5) * power - power * 0.35,
        life, max: life, color, size: 4 + Math.random() * 6,
        shape: shape || 'circle', rot: Math.random() * 6
      });
    }
  }

  // Nube de humo cartoon (radio en píxeles lógicos)
  function puff(g, x, y, r) {
    g.puffs.push({
      x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3,
      vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.5,
      r, t: 0.6 + Math.random() * 0.3, max: 0.9
    });
  }

  function word(g, text, x, y, size = 1) {
    g.words.push({ text, x, y, size, t: 0.9, max: 0.9, rot: (Math.random() - 0.5) * 0.3 });
  }

  // Explosión cartoon: humo, estrellas, chispas y onomatopeya
  function boom(g, x, y, power, text) {
    const n = 5 + Math.round(power * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = 0.2 + Math.random() * 0.35 * power;
      puff(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 12 + power * 6 + Math.random() * 8);
    }
    burst(g, x, y, '#ffd23f', 10 + power * 6, 5 + power * 2, 'star');
    burst(g, x, y, '#ff6a1f', 8 + power * 4, 4 + power * 2);
    if (text) word(g, text, x, y - 0.5, 0.9 + power * 0.25);
  }

  function addText(g, text, x, y, color, life = 1, icon) {
    g.texts.push({ text, x, y, color, life, max: life, icon });
  }

  function setBanner(g, text, dur, color) {
    g.banner = { text, t: dur, max: dur, color: color || '#ffd25a' };
  }

  function updateFx(g, dt) {
    for (const p of g.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 9 * dt;
    }
    g.particles = g.particles.filter(p => p.life > 0);
    for (const t of g.texts) { t.life -= dt; t.y -= 0.8 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
    for (const f of g.flashRows) f.t -= dt;
    g.flashRows = g.flashRows.filter(f => f.t > 0);
    for (const p of g.puffs) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    g.puffs = g.puffs.filter(p => p.t > 0);
    for (const w of g.words) w.t -= dt;
    g.words = g.words.filter(w => w.t > 0);
    for (const c of g.corpses) c.t -= dt;
    g.corpses = g.corpses.filter(c => c.t > 0);
    for (const d of g.debris) {
      d.t -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 14 * dt; d.rot += d.vr * dt;
    }
    g.debris = g.debris.filter(d => d.t > 0);
    capFx(g);
    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    g.shake = Math.max(0, g.shake - dt);
    g.houseFlash = Math.max(0, g.houseFlash - dt);
  }

  // Recorta las listas de efectos para que nunca crezcan sin control
  function capFx(g) {
    const L = C.FX_LIMITS;
    const cap = (key, max) => {
      const arr = g[key];
      if (arr && arr.length > max) arr.splice(0, arr.length - max);
    };
    cap('particles', L.particles);
    cap('puffs', L.puffs);
    cap('words', L.words);
    cap('texts', L.texts);
    cap('debris', L.debris);
    cap('corpses', L.corpses);
  }

  /* ---------- Bucle ---------- */
  function update(g, dt) {
    g.time += dt;
    if (!g.over) {
      updatePiece(g, dt);
      BOTD.Defenses.update(g, dt);
      BOTD.Zombies.update(g, dt);
      updateRollers(g, dt);
      BOTD.Projectiles.update(g, dt);
      g.zombies = g.zombies.filter(z => !z.dead);
      if (!g.over) BOTD.Levels.updateWaves(g, dt);
    } else if (!g.endFired) {
      g.endTimer -= dt;
      if (g.endTimer <= 0) {
        g.endFired = true;
        if (g.hooks.onEnd) g.hooks.onEnd(g.result);
      }
    }
    updateFx(g, dt);
  }

  return {
    COLORS, create, update, move, rotate, hardDrop, ghostY, buy, canAfford,
    loseLife, win, burst, addText, setBanner, boom, puff, word, zombieDied,
    typeOf, triggerRoller, rollerIncoming, ALL_DEFENSES, ROLLER, addBrains
  };
})();
