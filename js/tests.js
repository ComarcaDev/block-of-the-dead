/* Pruebas automáticas de la lógica del juego. Abrir tests.html.
   Cada prueba prepara una situación, avanza el tiempo y comprueba el resultado.
   Los resultados también quedan en window.TEST_RESULTS para leerlos por script. */
(() => {
  const C = BOTD.CONFIG;
  const H = C.ROWS + C.HIDDEN_ROWS;
  const tests = [];

  function test(name, fn) { tests.push({ name, fn }); }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'La condición no se cumple');
  }

  // Partida nueva sin oleadas automáticas (salvo que se pida)
  function newGame(level = 0, keepWaves = false) {
    const g = BOTD.Game.create(level, {});
    if (!keepWaves) g.waves.breakT = 1e9;
    return g;
  }

  function step(g, seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) BOTD.Game.update(g, 1 / 60);
  }

  function addZombie(g, type, lane, x) {
    const z = BOTD.Zombies.create(type, lane);
    z.x = x;
    g.zombies.push(z);
    return z;
  }

  /* ---------- Reglas básicas ---------- */
  test('Línea completa: se borra, da cerebros y daña a los zombies del carril', () => {
    const g = newGame();
    for (let x = 0; x < 10; x++) if (x !== 4) g.grid[H - 1][x] = BOTD.Board.makeCell('wall');
    const z = addZombie(g, 'basic', H - 1, 12);
    g.piece = BOTD.Pieces.create('U'); g.piece.x = 4; g.piece.y = 0;
    BOTD.Game.hardDrop(g);
    assert(g.lines === 1, 'Se esperaba 1 línea, hay ' + g.lines);
    assert(g.grid[H - 1].every(c => !c), 'La fila inferior debería estar vacía');
    assert(g.brains >= C.LINES.brains[1], 'Faltan cerebros: ' + g.brains);
    assert(z.dead, 'El zombie del carril debería morir');
  });

  test('Lanzaguisantes: dispara y mata a un zombie de su carril', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][2] = BOTD.Board.makeCell('shooter', true);
    addZombie(g, 'basic', H - 1, 14);
    step(g, 8);
    assert(g.kills === 1, 'Muertes: ' + g.kills);
  });

  test('Mina: explota al ser mordida y desaparece', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][5] = BOTD.Board.makeCell('mine');
    const z = addZombie(g, 'basic', H - 1, 6.5);
    step(g, 3);
    assert(!g.grid[H - 1][5], 'La mina debería desaparecer');
    assert(z.dead, 'El zombie debería morir');
  });

  test('Baba: frena al zombie que la muerde', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][5] = BOTD.Board.makeCell('slime');
    const z = addZombie(g, 'basic', H - 1, 6.5);
    step(g, 2);
    assert(z.slow > 0, 'El zombie debería estar ralentizado');
  });

  test('Corredor: salta el primer bloque', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][5] = BOTD.Board.makeCell('wall');
    const z = addZombie(g, 'runner', H - 1, 6.6);
    step(g, 1);
    assert(z.jumped && z.x < 5, 'Posición tras el salto: ' + z.x.toFixed(2));
  });

  test('Gigante: aplasta un bloque de un golpe', () => {
    const g = newGame(4);
    g.piece = null;
    g.grid[H - 1][5] = BOTD.Board.makeCell('bunker');
    addZombie(g, 'boss', H - 1, 6.4);
    step(g, 6);
    assert(!g.grid[H - 1][5], 'El búnker debería estar destruido');
  });

  test('Casa: sin rodillo, un zombie que entra quita una vida', () => {
    const g = newGame();
    g.piece = null;
    g.rollers.fill(false);
    addZombie(g, 'basic', H - 1, 0.2);
    step(g, 2);
    assert(g.lives === C.LIVES - 1, 'Vidas: ' + g.lives);
  });

  test('Sin vidas: la partida se pierde', () => {
    const g = newGame();
    g.piece = null;
    g.rollers.fill(false);
    for (let i = 0; i < C.LIVES; i++) addZombie(g, 'basic', H - 1 - i, 0.1);
    step(g, 1);
    assert(g.over && g.result && !g.result.won && g.result.reason === 'lives', 'Resultado: ' + JSON.stringify(g.result));
  });

  test('Techo: si los bloques llegan arriba, se pierde', () => {
    const g = newGame();
    for (let y = C.HIDDEN_ROWS; y < H; y++) for (let x = 1; x < 10; x++) g.grid[y][x] = BOTD.Board.makeCell('wall');
    for (let k = 0; k < 6 && !g.over; k++) BOTD.Game.hardDrop(g);
    assert(g.over && g.result.reason === 'top', 'Resultado: ' + JSON.stringify(g.result));
  });

  test('Victoria: al acabar todas las oleadas se gana el nivel', () => {
    const g = newGame(0, true);
    let t = 0;
    while (!g.over && t < 60 * 400) {
      g.piece = null;
      g.zombies.forEach(z => BOTD.Zombies.damage(g, z, 1e9));
      BOTD.Game.update(g, 1 / 60);
      t++;
    }
    assert(g.result && g.result.won, 'Resultado: ' + JSON.stringify(g.result));
  });

  test('Fin de nivel: avisa una sola vez con onEnd', () => {
    let calls = 0;
    const g = BOTD.Game.create(0, { onEnd: () => calls++ });
    BOTD.Game.win(g);
    step(g, 3);
    assert(calls === 1, 'onEnd llamado ' + calls + ' veces');
  });

  test('Tienda: compra, no permite dos compras seguidas y cobra bien', () => {
    const g = newGame();
    g.brains = 100;
    assert(BOTD.Game.buy(g, 'bomb') === true, 'La megabomba debería comprarse');
    assert(g.next === 'B', 'La siguiente pieza debería ser la bomba');
    assert(BOTD.Game.buy(g, 'single') === false, 'No debería permitir otra compra');
    assert(g.brains === 100 - C.SHOP.bomb, 'Cerebros: ' + g.brains);
    const poor = newGame();
    poor.brains = 0;
    assert(BOTD.Game.buy(poor, 'single') === false, 'Sin cerebros no debería comprar');
  });

  test('Megabomba: explota al caer sin romper la partida', () => {
    const g = newGame();
    g.grid[H - 1][4] = BOTD.Board.makeCell('wall');
    g.piece = BOTD.Pieces.create('B'); g.piece.x = 4; g.piece.y = 0;
    BOTD.Game.hardDrop(g);
    assert(!g.over, 'La partida no debería terminar');
    assert(!g.grid[H - 1][4], 'La bomba debería limpiar el bloque de debajo');
  });

  test('Rotación: las piezas giran y no atraviesan paredes', () => {
    const g = newGame();
    g.piece = BOTD.Pieces.create('I'); g.piece.x = 0; g.piece.y = 4;
    BOTD.Game.rotate(g, 1);
    BOTD.Game.rotate(g, 1);
    for (let i = 0; i < 20; i++) BOTD.Game.move(g, -1);
    assert(!BOTD.Board.collides(g.grid, g.piece), 'La pieza no debería solaparse');
  });

  /* ---------- Fase 2: progresión ---------- */
  test('Desbloqueo: al empezar solo hay muro, búnker y lanzaguisantes', () => {
    const d = BOTD.Levels.defensesFor(0);
    assert(d.join(',') === 'wall,bunker,shooter', 'Defensas: ' + d.join(','));
    assert(BOTD.Levels.defensesFor(1).includes('mine'), 'La mina llega al ganar el nivel 1');
    assert(BOTD.Levels.defensesFor(2).includes('slime'), 'La baba llega al ganar el nivel 2');
    assert(BOTD.Levels.unlockAt(1) === 'mine' && BOTD.Levels.unlockAt(2) === 'slime', 'Tarjetas de desbloqueo');
    assert(BOTD.Levels.unlockAt(3) === 'ice' && BOTD.Levels.unlockAt(4) === 'cactus', 'Hielo y cactus');
    assert(BOTD.Levels.unlockAt(6) === 'sunflower' && BOTD.Levels.unlockAt(7) === 'bomb', 'Girasol y megabomba');
    assert(BOTD.Levels.unlockAt(5) === null, 'El nivel 5 no desbloquea defensa');
    assert(BOTD.Levels.shopLockedFor(7).length === 0, 'Tras el nivel 7 la tienda está completa');
  });

  test('Desbloqueo: las piezas sin defensa caen como tierra', () => {
    const g = BOTD.Game.create(0, {}, { defenses: BOTD.Levels.defensesFor(0) });
    g.waves.breakT = 1e9;
    assert(BOTD.Game.typeOf(g, 'L') === 'dirt' && BOTD.Game.typeOf(g, 'S') === 'dirt', 'L y S deberían ser tierra');
    assert(BOTD.Game.typeOf(g, 'T') === 'shooter', 'La T sigue siendo lanzaguisantes');
    g.piece = BOTD.Pieces.create('L'); g.piece.x = 3; g.piece.y = 2;
    BOTD.Game.hardDrop(g);
    const cells = g.grid.flat().filter(Boolean);
    assert(cells.length === 4 && cells.every(c => c.type === 'dirt'), 'Celdas: ' + cells.map(c => c.type).join(','));
  });

  test('Tienda: la megabomba bloqueada no se puede comprar', () => {
    const g = BOTD.Game.create(0, {}, { shopLocked: BOTD.Levels.shopLockedFor(0) });
    g.brains = 500;
    assert(BOTD.Game.buy(g, 'bomb') === false, 'No debería comprarse');
    assert(!BOTD.Game.canAfford(g, 'bomb'), 'No debería mostrarse disponible');
    assert(BOTD.Game.buy(g, 'single') === true, 'El bloque 1×1 sí se compra');
  });

  test('Rodillo: salva el carril una vez y arrasa a sus zombies', () => {
    const g = newGame();
    g.piece = null;
    const lane = H - 1;
    const a = addZombie(g, 'basic', lane, 0.2);
    const b = addZombie(g, 'cone', lane, 5);
    step(g, 3);
    assert(g.lives === C.LIVES, 'No debería perder vidas: ' + g.lives);
    assert(a.dead && b.dead, 'El rodillo debería matar a los zombies del carril');
    assert(!g.rollers[lane] && g.stats.rollersUsed === 1, 'El rodillo se gasta');
    addZombie(g, 'basic', lane, 0.2);
    step(g, 2);
    assert(g.lives === C.LIVES - 1, 'Sin rodillo, ahora sí pierde una vida: ' + g.lives);
  });

  test('Rodillo: alcanza a un corredor que salta hasta la casa', () => {
    const g = newGame();
    g.piece = null;
    const lane = H - 1;
    g.grid[lane][0] = BOTD.Board.makeCell('wall');
    const z = addZombie(g, 'runner', lane, 1.5);
    step(g, 3);
    assert(z.dead && g.lives === C.LIVES, 'Vidas: ' + g.lives + ', muerto: ' + z.dead);
  });

  test('Rodillo: al gigante solo le hace daño', () => {
    const g = newGame(4);
    g.piece = null;
    const lane = H - 1;
    const z = addZombie(g, 'boss', lane, 0.1);
    step(g, 0.5);
    assert(!z.dead && z.hp === z.maxHp - BOTD.Game.ROLLER.bossDamage, 'Vida del gigante: ' + z.hp);
  });

  test('Rodillo: los no usados dan bonificación al ganar', () => {
    const g = newGame(0);
    const n = g.rollers.filter(Boolean).length;
    assert(n === g.level.lanes, 'Un rodillo por carril activo: ' + n);
    const before = g.score;
    BOTD.Game.win(g);
    assert(g.result.rollersLeft === n && g.score === before + n * BOTD.Game.ROLLER.score, JSON.stringify(g.result));
  });

  test('Oleadas: la barra avanza y la última es una gran oleada con bandera', () => {
    const g = newGame(0, true);
    assert(BOTD.Levels.progress(g) === 0, 'Empieza en 0');
    assert(g.waves.flags.length >= 1, 'Debe haber al menos una bandera');
    assert(BOTD.Levels.isBig(g.level, g.level.waves.length - 1), 'La última oleada es grande');
    let t = 0;
    while (g.waves.spawned < 2 && t < 60 * 60) { g.piece = null; BOTD.Game.update(g, 1 / 60); t++; }
    const p = BOTD.Levels.progress(g);
    assert(p > 0 && p < 1, 'Progreso: ' + p);
  });

  test('Oleadas: en la gran oleada salen varios zombies casi a la vez', () => {
    const g = newGame(0, true);
    g.piece = null;
    // Saltar directamente al descanso previo a la última oleada
    g.waves.index = g.level.waves.length - 2;
    g.waves.state = 'break';
    g.waves.breakT = 3.5;
    let warned = false;
    for (let i = 0; i < 60 * 3.4; i++) { BOTD.Game.update(g, 1 / 60); if (g.waves.warned) warned = true; }
    assert(warned, 'Debería avisar de la gran oleada');
    step(g, 3.2);  // 1,5 s de entrada + ráfaga de 0,4 s
    assert(g.zombies.length >= 3, 'Zombies tras la ráfaga: ' + g.zombies.length);
  });

  test('Tutorial: las oleadas esperan hasta soltar la primera pieza y los pasos avanzan', () => {
    if (!BOTD.UI) BOTD.UI = { showTip() {}, hideTip() {} };
    const g = BOTD.Game.create(0, {}, {});
    let finished = null;
    BOTD.Tutorial.start(g, skipped => { finished = skipped; });
    step(g, 15);
    assert(g.waves.index === -1 && g.holdWaves, 'Las oleadas no deberían empezar');
    BOTD.Game.move(g, -1); BOTD.Game.move(g, 1);
    BOTD.Tutorial.update(g, 1 / 60);
    BOTD.Game.rotate(g, 1);
    BOTD.Tutorial.update(g, 1 / 60);
    BOTD.Game.hardDrop(g);
    BOTD.Tutorial.update(g, 1 / 60);
    assert(!g.holdWaves, 'Tras soltar, las oleadas se liberan');
    BOTD.Tutorial.skip();
    assert(finished === true && !BOTD.Tutorial.active(), 'Saltar termina el tutorial');
  });

  /* ---------- Fase 3: contenido nuevo ---------- */
  test('Elección de defensas: una pieza I puede ser lanzaguisantes con un solo bloque que dispara', () => {
    const g = BOTD.Game.create(0, {}, { defenses: ['wall', 'bunker', 'shooter'], loadout: { I: 'shooter' } });
    g.waves.breakT = 1e9;
    g.piece = BOTD.Pieces.create('I'); g.piece.x = 3; g.piece.y = 2;
    BOTD.Game.hardDrop(g);
    const cells = g.grid.flat().filter(Boolean);
    assert(cells.length === 4 && cells.every(c => c.type === 'shooter'), 'Tipos: ' + cells.map(c => c.type).join(','));
    assert(cells.filter(c => c.gun).length === 1, 'Debe haber exactamente un bloque activo');
  });

  test('Elección de defensas: una defensa bloqueada vuelve a la de serie', () => {
    const lo = BOTD.Levels.loadoutFor({ I: 'ice', T: 'cactus', O: 'nada' }, ['wall', 'bunker', 'shooter']);
    assert(lo.I === 'wall' && lo.T === 'shooter' && lo.O === 'bunker', JSON.stringify(lo));
    const g = BOTD.Game.create(0, {}, { defenses: ['wall', 'bunker', 'shooter'], loadout: { L: 'ice' } });
    assert(BOTD.Game.typeOf(g, 'L') === 'dirt', 'Hielo sin desbloquear → tierra');
  });

  test('Planta de hielo: sus guisantes frenan al zombie', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][1] = BOTD.Board.makeCell('ice', true);
    const z = addZombie(g, 'bucket', H - 1, 12);
    step(g, 4);
    assert(z.chill > 0, 'El zombie debería estar congelado');
    assert(z.hp < z.maxHp, 'Debería recibir daño');
  });

  test('Cactus: pincha al zombie que lo muerde', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][5] = BOTD.Board.makeCell('cactus');
    const z = addZombie(g, 'basic', H - 1, 6.4);
    step(g, 3);
    assert(z.hp < z.maxHp, 'Vida del zombie: ' + z.hp);
  });

  test('Girasol de cerebros: genera cerebros con el tiempo', () => {
    const g = newGame();
    g.piece = null;
    g.grid[H - 1][1] = BOTD.Board.makeCell('sunflower', true);
    const b0 = g.brains;
    step(g, C.DEFENSES.sunflower.interval * 1.7);
    assert(g.brains >= b0 + C.DEFENSES.sunflower.brains * 2, 'Cerebros: ' + g.brains);
  });

  test('Zombie con cubo: aguanta lo que mata a uno normal', () => {
    const g = newGame();
    const a = addZombie(g, 'basic', H - 1, 12);
    const b = addZombie(g, 'bucket', H - 2, 12);
    BOTD.Zombies.damage(g, a, 200);
    BOTD.Zombies.damage(g, b, 200);
    assert(a.dead && !b.dead, 'Básico muerto: ' + a.dead + ', cubo vivo: ' + !b.dead);
  });

  test('Zombie con puerta: el escudo para los guisantes pero no las líneas', () => {
    const g = newGame();
    const z = addZombie(g, 'shield', H - 1, 12);
    BOTD.Zombies.damage(g, z, 100, 'pea');
    assert(z.hp === z.maxHp && z.shield === z.maxShield - 100, 'Guisante: vida ' + z.hp + ', escudo ' + z.shield);
    BOTD.Zombies.damage(g, z, 100);
    assert(z.hp === z.maxHp - 100, 'Explosión: vida ' + z.hp);
  });

  test('Excavador: invulnerable bajo tierra y sale detrás del primer bloque', () => {
    const g = newGame();
    g.piece = null;
    const lane = H - 1;
    g.grid[lane][6] = BOTD.Board.makeCell('wall');
    g.grid[lane][7] = BOTD.Board.makeCell('wall');
    const z = addZombie(g, 'digger', lane, 9);
    BOTD.Zombies.damage(g, z, 1e9);
    assert(!z.dead, 'Bajo tierra no se le puede dañar');
    step(g, 6);
    assert(!z.underground, 'Debería haber salido');
    assert(z.x < 6 && z.x > 3, 'Posición al salir: ' + z.x.toFixed(2));
  });

  test('Zombie con globo: vuela por encima y un guisante revienta el globo', () => {
    const g = newGame();
    g.piece = null;
    const lane = H - 1;
    for (let x = 3; x < 8; x++) g.grid[lane][x] = BOTD.Board.makeCell('wall');
    const z = addZombie(g, 'balloon', lane, 9);
    step(g, 14);
    assert(z.balloon && z.x < 3, 'Debería haber pasado volando: ' + z.x.toFixed(2));
    BOTD.Zombies.damage(g, z, 10, 'pea');
    assert(!z.balloon && z.hp === z.maxHp, 'El guisante revienta el globo sin dañarle');
  });

  test('Mundo 2: hay lápidas, no cortan el paso y desaparecen con una línea', () => {
    const g = newGame(5);
    g.piece = null;
    const graves = g.grid.flat().filter(c => c && c.type === 'grave').length;
    assert(graves === g.level.graves, 'Lápidas: ' + graves);
    const lane = H - 1;
    for (let x = 0; x < 10; x++) g.grid[lane][x] = null;
    g.grid[lane][5] = BOTD.Board.makeCell('grave', false, -1, null);
    const z = addZombie(g, 'basic', lane, 7);
    step(g, 9);
    assert(z.x < 5, 'El zombie debería pasar sobre la lápida: ' + z.x.toFixed(2));
    BOTD.Defenses.damageCell(g, 5, lane, 1e9);
    assert(g.grid[lane][5] && g.grid[lane][5].type === 'grave', 'Los mordiscos no rompen lápidas');
    for (let y = 0; y < lane; y++) g.grid[y][4] = null;   // columna libre para la pieza
    for (let x = 0; x < 10; x++) if (x !== 5 && x !== 4) g.grid[lane][x] = BOTD.Board.makeCell('wall');
    const countGraves = () => g.grid.flat().filter(c => c && c.type === 'grave').length;
    const before = countGraves();
    g.piece = BOTD.Pieces.create('U'); g.piece.x = 4; g.piece.y = 0;
    BOTD.Game.hardDrop(g);
    // (las filas de encima bajan, así que puede caer otra lápida en esa fila: se cuenta el total)
    assert(g.lines === 1 && countGraves() === before - 1, 'Lápidas: ' + before + ' → ' + countGraves());
  });

  test('Mundo 2: 10 niveles y el último tiene al rey gigante', () => {
    assert(BOTD.Levels.count === 10, 'Niveles: ' + BOTD.Levels.count);
    const last = BOTD.Levels.get(9);
    assert(last.waves.some(w => w.boss === 'boss2'), 'Falta el rey gigante');
    const g = newGame(9);
    g.piece = null;
    const z = addZombie(g, 'boss2', H - 1, 3);
    BOTD.Game.triggerRoller(g, H - 1);
    step(g, 1);
    assert(!z.dead && z.hp < z.maxHp, 'El rodillo solo daña al rey');
  });

  /* ---------- Fase 4: diversión extra ---------- */
  // Rellena la fila inferior menos una columna y suelta un bloque 1×1 en el hueco
  function clearBottomLine(g, gap = 4) {
    for (let x = 0; x < 10; x++) g.grid[H - 1][x] = x === gap ? null : BOTD.Board.makeCell('wall');
    for (let y = 0; y < H - 1; y++) g.grid[y][gap] = null;
    g.piece = BOTD.Pieces.create('U'); g.piece.x = gap; g.piece.y = 0;
    BOTD.Game.hardDrop(g);
  }

  test('Combos: líneas seguidas multiplican los cerebros y se pierden al fallar', () => {
    const g = newGame();
    const base = C.LINES.brains[1];
    let b = g.brains;
    clearBottomLine(g);
    assert(g.combo === 1 && g.brains - b === base, 'Primera línea: +' + (g.brains - b));
    b = g.brains;
    clearBottomLine(g);
    assert(g.combo === 2 && g.brains - b === Math.round(base * (1 + C.COMBO_STEP)), 'Combo x2: +' + (g.brains - b));
    b = g.brains;
    clearBottomLine(g);
    assert(g.combo === 3 && g.brains - b === Math.round(base * (1 + 2 * C.COMBO_STEP)), 'Combo x3: +' + (g.brains - b));
    // Una pieza que no completa línea rompe el combo
    for (let y = 0; y < H; y++) g.grid[y].fill(null);
    g.piece = BOTD.Pieces.create('U'); g.piece.x = 0; g.piece.y = 0;
    BOTD.Game.hardDrop(g);
    assert(g.combo === 0 && g.stats.maxCombo === 3, 'Combo tras fallar: ' + g.combo);
  });

  test('Cobertizo: comprar mejoras cuesta cerebros guardados y tiene máximo', () => {
    const d = BOTD.Storage.sanitize({});
    const P = BOTD.Progress;
    assert(!P.buy(d, 'peaDamage'), 'Sin cerebros no se puede comprar');
    d.bank = 1000;
    assert(P.buy(d, 'peaDamage') && P.level(d, 'peaDamage') === 1, 'Primera compra');
    assert(d.bank === 1000 - C.UPGRADES.peaDamage.costs[0], 'Banco: ' + d.bank);
    d.bank = 1e6;
    while (P.buy(d, 'extraLife')) { /* comprar hasta el máximo */ }
    assert(P.level(d, 'extraLife') === P.maxLevel('extraLife') && P.cost(d, 'extraLife') === null, 'Máximo');
  });

  test('Cobertizo: las mejoras se aplican en la partida', () => {
    const d = BOTD.Storage.sanitize({ upgrades: { peaDamage: 2, wallHp: 2, startBrains: 3, extraLife: 1, mineRadius: 1 } });
    const mods = BOTD.Progress.mods(d);
    const g = BOTD.Game.create(0, {}, { mods });
    g.waves.breakT = 1e9;
    assert(g.lives === C.LIVES + 1, 'Vidas: ' + g.lives);
    assert(g.brains === C.START_BRAINS + 30, 'Cerebros iniciales: ' + g.brains);
    g.piece = BOTD.Pieces.create('I'); g.piece.x = 3; g.piece.y = 2;
    BOTD.Game.hardDrop(g);
    const wall = g.grid.flat().find(c => c && c.type === 'wall');
    assert(wall.maxHp === Math.round(C.DEFENSES.wall.hp * 1.3), 'Vida del muro: ' + wall.maxHp);
    for (let y = 0; y < H; y++) g.grid[y].fill(null);
    g.grid[H - 1][1] = BOTD.Board.makeCell('shooter', true);
    addZombie(g, 'bucket', H - 1, 12);
    step(g, 1.2);
    assert(g.projectiles.length && Math.abs(g.projectiles[0].dmg - C.DEFENSES.shooter.damage * 1.2) < 1e-9, 'Daño del guisante');
  });

  test('Cobertizo: el rodillo de reserva vuelve a proteger el carril', () => {
    const g = BOTD.Game.create(0, {}, { mods: Object.assign({}, BOTD.Progress.NO_MODS, { spareRollers: 1 }) });
    g.waves.breakT = 1e9;
    g.piece = null;
    addZombie(g, 'basic', H - 1, 0.2);
    step(g, 4);
    assert(g.rollers[H - 1] && g.spareRollers === 0, 'Debería haber un rodillo de reserva en el carril');
  });

  test('Supervivencia: oleadas infinitas cada vez más duras y nunca se gana', () => {
    const g = BOTD.Game.create(-1, {}, {});
    assert(g.survival && g.level.endless && g.level.lanes === C.SURVIVAL.lanes, 'Nivel de supervivencia');
    let t = 0;
    while (g.waves.index < 3 && t < 60 * 600 && !g.over) {
      g.piece = null;
      g.zombies.forEach(z => BOTD.Zombies.damage(g, z, 1e12));
      BOTD.Game.update(g, 1 / 60);
      t++;
    }
    assert(g.waves.index >= 3 && !g.over, 'Debería seguir tras la oleada 3 (oleada ' + g.waves.index + ')');
    const w0 = BOTD.Levels.survivalWave(0), w9 = BOTD.Levels.survivalWave(9), w19 = BOTD.Levels.survivalWave(19);
    const size = w => w.spawns.reduce((s, [, n]) => s + n, 0);
    assert(size(w9) > size(w0) && w9.interval < w0.interval, 'La oleada 10 es más dura que la 1');
    assert(w9.boss === 'boss' && w19.boss === 'boss2' && BOTD.Levels.survivalWave(4).big, 'Jefes y grandes oleadas');
    assert(g.level.fall < C.SURVIVAL.fallStart, 'Las piezas caen más rápido: ' + g.level.fall);
  });

  test('Supervivencia: los zombies tienen más vida en oleadas avanzadas', () => {
    const g = BOTD.Game.create(-1, {}, {});
    g.waves.index = 10;
    g.waves.state = 'spawning';
    g.waves.queue = ['basic'];
    g.waves.spawnT = 0;
    g.level.waves[10] = BOTD.Levels.survivalWave(10);
    BOTD.Game.update(g, 1 / 60);
    const z = g.zombies[0];
    assert(z && z.maxHp === Math.round(C.ZOMBIES.basic.hp * (1 + C.SURVIVAL.hpPerWave * 10)), 'Vida: ' + (z && z.maxHp));
  });

  test('Logros: se consiguen una sola vez con el suceso correcto', () => {
    const d = BOTD.Storage.sanitize({});
    const ev = BOTD.Progress.evaluate;
    assert(ev({ event: 'lines', n: 1, combo: 1, totalKills: 0 }, d).length === 0, 'Nada por una línea');
    assert(ev({ event: 'lines', n: 4, combo: 5, totalKills: 0 }, d).sort().join() === 'combo5,tetra', 'Cuádruple y combo');
    assert(ev({ event: 'lines', n: 4, combo: 5, totalKills: 0 }, d).length === 0, 'No se repiten');
    const end = ev({ event: 'end', won: true, levelIndex: 4, livesLost: 0, rollersUsed: 0, totalKills: 120 }, d);
    ['first_win', 'flawless', 'no_rollers', 'world1', 'kills100'].forEach(id => assert(end.includes(id), 'Falta ' + id));
    assert(ev({ event: 'kill', type: 'boss2', totalKills: 1 }, d).includes('king'), 'Rey gigante');
    assert(ev({ event: 'wave', n: 10, survival: true, totalKills: 1 }, d).includes('survivor'), 'Superviviente');
    assert(ev({ event: 'wave', n: 12, survival: false, totalKills: 1 }, d).length === 0, 'Solo cuenta en supervivencia');
  });

  test('Logros: la partida avisa de líneas, combos y muertes', () => {
    const events = [];
    const g = BOTD.Game.create(0, { onEvent: (n, d) => events.push(n + ':' + (d.combo || d.type || '')) }, {});
    g.waves.breakT = 1e9;
    clearBottomLine(g);
    clearBottomLine(g);
    const z = addZombie(g, 'basic', H - 3, 12);
    BOTD.Zombies.damage(g, z, 1e9);
    assert(events.includes('lines:1') && events.includes('lines:2') && events.includes('kill:basic'), events.join(' '));
  });

  /* ---------- Estabilidad ---------- */
  test('Efectos: nunca superan los límites configurados', () => {
    const g = newGame();
    g.piece = null;
    for (let i = 0; i < 200; i++) {
      BOTD.Game.burst(g, 5, 8, '#fff', 50, 4);
      BOTD.Game.boom(g, 5, 8, 2, '¡BUM!');
      BOTD.Game.addText(g, '+1', 5, 8, '#fff');
    }
    step(g, 0.05);
    const L = C.FX_LIMITS;
    assert(g.particles.length <= L.particles, 'Partículas: ' + g.particles.length);
    assert(g.puffs.length <= L.puffs, 'Humo: ' + g.puffs.length);
    assert(g.words.length <= L.words, 'Onomatopeyas: ' + g.words.length);
    assert(g.texts.length <= L.texts, 'Textos: ' + g.texts.length);
  });

  test('Guisantes: no se crean más del límite', () => {
    const g = newGame();
    g.piece = null;
    for (let y = C.HIDDEN_ROWS; y < H; y++) for (let x = 0; x < 10; x++) g.grid[y][x] = BOTD.Board.makeCell('shooter', true);
    for (let y = C.HIDDEN_ROWS; y < H; y++) { const z = addZombie(g, 'boss', y, 15); z.hp = z.maxHp = 1e12; }
    step(g, 10);
    assert(g.projectiles.length <= C.FX_LIMITS.projectiles, 'Guisantes: ' + g.projectiles.length);
  });

  test('Partidas largas: 3 minutos simulados por nivel (y supervivencia) sin errores', () => {
    let games = 0, frames = 0;
    const levels = [];
    for (let i = 0; i < BOTD.Levels.count; i++) levels.push(i);
    levels.push(-1);
    for (const lvl of levels) {
      let g = newGame(lvl, true);
      games++;
      for (let i = 0; i < 60 * 180; i++) {
        if (g.over) {
          assert(g.result && typeof g.result.won === 'boolean', 'Resultado inválido');
          g = newGame(lvl, true);
          games++;
        }
        if (g.piece && i % 30 === 0) {
          BOTD.Game.move(g, Math.random() < 0.5 ? -1 : 1);
          if (Math.random() < 0.3) BOTD.Game.rotate(g, 1);
          if (Math.random() < 0.15) BOTD.Game.hardDrop(g);
        }
        BOTD.Game.update(g, 1 / 60);
        frames++;
        if (g.particles.length > C.FX_LIMITS.particles) throw new Error('Demasiadas partículas');
      }
    }
    assert(frames === levels.length * 60 * 180, 'Fotogramas: ' + frames + ' en ' + games + ' partidas');
  });

  /* ---------- Guardado ---------- */
  const S = BOTD.Storage;
  function withTestStorage(fn) {
    S.setPrefix('botd_test_');
    const k = S.keys();
    const clean = () => [k.main, k.bak, k.old].forEach(key => { try { localStorage.removeItem(key); } catch (e) { /* ignorar */ } });
    clean();
    try { fn(k); } finally { clean(); S.setPrefix('botd_'); }
  }

  test('Guardado: migra el formato antiguo (v1) sin perder progreso', () => {
    withTestStorage(k => {
      localStorage.setItem(k.old, JSON.stringify({ unlocked: 3, best: { 1: 500, 2: 'x' }, settings: { sfx: false } }));
      const d = S.load();
      assert(d.v === 2, 'Versión: ' + d.v);
      assert(d.unlocked === 3, 'Niveles: ' + d.unlocked);
      assert(d.best[1] === 500 && !('2' in d.best), 'Récords: ' + JSON.stringify(d.best));
      assert(d.settings.sfx === false && d.settings.music === true, 'Ajustes: ' + JSON.stringify(d.settings));
      assert(d.tutorialDone === true, 'Quien ya avanzó no necesita tutorial');
      assert(localStorage.getItem(k.main), 'Debería guardarse en el formato nuevo');
    });
  });

  test('Guardado: si el principal está dañado, usa la copia de seguridad', () => {
    withTestStorage(k => {
      localStorage.setItem(k.bak, JSON.stringify({ v: 2, unlocked: 4 }));
      localStorage.setItem(k.main, '{esto no es JSON');
      const d = S.load();
      assert(d.unlocked === 4, 'Niveles: ' + d.unlocked);
    });
  });

  test('Guardado: datos absurdos se corrigen', () => {
    const d = S.sanitize({ unlocked: -5, best: 'nada', settings: { sfx: 'si' }, bank: 1e99, achievements: [1, 2] });
    assert(d.unlocked === 1, 'Niveles: ' + d.unlocked);
    assert(Object.keys(d.best).length === 0, 'Récords');
    assert(d.settings.sfx === true, 'Ajustes');
    assert(d.bank === 1e9, 'Banco: ' + d.bank);
    assert(Object.keys(d.achievements).length === 0, 'Logros');
  });

  test('Guardado: guardar y volver a cargar conserva los datos', () => {
    withTestStorage(() => {
      S.load();
      S.unlock(5);
      S.setBest(2, 1234);
      S.data.settings.music = false;
      S.save();
      const d = S.load();
      assert(d.unlocked === 5 && d.best[2] === 1234 && d.settings.music === false, JSON.stringify(d));
    });
  });

  /* ---------- Ejecutar ---------- */
  const results = [];
  const list = document.getElementById('results');
  tests.forEach(t => {
    const t0 = performance.now();
    let ok = true, msg = '';
    try { t.fn(); } catch (e) { ok = false; msg = e && e.message ? e.message : String(e); console.error(t.name, e); }
    const ms = Math.round(performance.now() - t0);
    results.push({ name: t.name, ok, msg, ms });
    const li = document.createElement('li');
    li.className = ok ? '' : 'bad';
    li.innerHTML = '<span></span><div><div class="name"></div><div class="msg"></div></div><small></small>';
    li.children[0].textContent = ok ? '✅' : '❌';
    li.querySelector('.name').textContent = t.name;
    li.querySelector('.msg').textContent = msg;
    li.querySelector('small').textContent = ms + ' ms';
    list.appendChild(li);
  });
  const failed = results.filter(r => !r.ok).length;
  const sum = document.getElementById('summary');
  sum.textContent = failed ? failed + ' de ' + results.length + ' pruebas fallan' : 'Las ' + results.length + ' pruebas pasan';
  sum.className = failed ? 'bad' : 'ok';
  window.TEST_RESULTS = { total: results.length, failed, results };
})();
