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

  /* ---------- v1.1: versión, ajustes, estadísticas, exportar/importar ---------- */
  test('Versión: tiene formato X.Y.Z', () => {
    assert(/^\d+\.\d+\.\d+$/.test(BOTD.VERSION), 'Versión: ' + BOTD.VERSION);
  });

  test('Ajustes: valores por defecto y valores absurdos corregidos', () => {
    const d = S.sanitize({});
    assert(d.settings.musicVol === 0.8 && d.settings.sfxVol === 0.8 && d.settings.quality === 'auto', JSON.stringify(d.settings));
    assert(d.settings.shake === true && d.settings.showFps === false, 'Sacudidas y FPS');
    const bad = S.sanitize({ settings: { musicVol: 7, sfxVol: -1, quality: 'ultra', shake: 'no', showFps: 1 } });
    assert(bad.settings.musicVol === 1 && bad.settings.sfxVol === 0, 'Volúmenes acotados');
    assert(bad.settings.quality === 'auto' && bad.settings.shake === true && bad.settings.showFps === false, JSON.stringify(bad.settings));
  });

  test('Ajustes: un guardado de la v1.0 conserva sonido y música', () => {
    const d = S.sanitize({ v: 2, unlocked: 4, settings: { sfx: false, music: true } });
    assert(d.unlocked === 4 && d.settings.sfx === false && d.settings.music === true && d.settings.sfxVol === 0.8, JSON.stringify(d.settings));
  });

  test('Estadísticas: se guardan y se validan', () => {
    const d = S.sanitize({ totals: { kills: 12, playTime: 95.5, games: 3, wins: 2, bestCombo: 4,
      linesByCount: { 1: 5, 4: 'x' }, killsByType: { basic: 9, cone: 3 } } });
    const T = d.totals;
    assert(T.kills === 12 && T.playTime === 95.5 && T.games === 3 && T.wins === 2 && T.bestCombo === 4, JSON.stringify(T));
    assert(T.linesByCount[1] === 5 && !('4' in T.linesByCount), 'Líneas por tipo');
    assert(T.killsByType.basic === 9 && T.killsByType.cone === 3, 'Zombies por tipo');
  });

  test('Exportar/importar: el código y el archivo recuperan la partida', () => {
    const d = S.sanitize({ unlocked: 7, bank: 321, best: { 3: 999 }, achievements: { tetra: true },
      settings: { musicVol: 0.3 }, totals: { kills: 50 } });
    const code = S.exportCode(d);
    assert(code.startsWith('BOTD1:'), 'Prefijo del código');
    const r = S.importCode(code);
    assert(r.ok, 'Importar código: ' + r.error);
    assert(r.data.unlocked === 7 && r.data.bank === 321 && r.data.best[3] === 999 && r.data.achievements.tetra, JSON.stringify(r.data));
    assert(r.data.settings.musicVol === 0.3 && r.data.totals.kills === 50, 'Ajustes y estadísticas');
    const f = S.importCode(S.exportJson(d));
    assert(f.ok && f.data.bank === 321, 'Importar archivo');
    assert(S.importCode('  ' + code + '\n').ok, 'Tolera espacios alrededor');
  });

  test('Exportar/importar: rechaza copias modificadas o inválidas', () => {
    const json = S.exportJson(S.sanitize({ bank: 10 }));
    const tampered = json.replace('\\"bank\\":10', '\\"bank\\":99999');
    assert(tampered !== json, 'La prueba debe modificar la copia');
    assert(S.importCode(tampered).error === 'import_corrupt', 'Debe detectar la modificación');
    assert(S.importCode('hola').error === 'import_bad', 'Texto cualquiera');
    assert(S.importCode('').error === 'import_bad', 'Vacío');
    assert(S.importCode(JSON.stringify({ p: '{"app":"otra"}', h: S.hash('{"app":"otra"}') })).error === 'import_bad', 'Otra app');
  });

  test('Exportar/importar: reemplazar guarda la partida importada', () => {
    withTestStorage(() => {
      S.load();
      const r = S.importCode(S.exportCode(S.sanitize({ unlocked: 9, bank: 77 })));
      S.replace(r.data);
      const d = S.load();
      assert(d.unlocked === 9 && d.bank === 77, JSON.stringify({ unlocked: d.unlocked, bank: d.bank }));
    });
  });

  test('Audio: cambiar volúmenes sin sonido iniciado no da error', () => {
    BOTD.Audio.setSfxVolume(0.5);
    BOTD.Audio.setMusicVolume(2);
    BOTD.Audio.setMusicVolume(0.8);
    BOTD.Audio.setSfxVolume(0.8);
  });

  /* ---------- v1.2: guardar pieza, dificultad y reto diario ---------- */
  test('Guardar pieza: guarda, saca la siguiente y solo una vez por pieza', () => {
    const g = newGame();
    const first = g.piece.kind, next = g.next;
    assert(BOTD.Game.hold(g) === true, 'Primera vez se puede guardar');
    assert(g.hold === first && g.piece.kind === next, 'Guardada ' + g.hold + ', actual ' + g.piece.kind);
    assert(BOTD.Game.hold(g) === false && g.hold === first, 'No se puede guardar dos veces seguidas');
    BOTD.Game.hardDrop(g);
    const now = g.piece.kind;
    assert(BOTD.Game.hold(g) === true && g.piece.kind === first && g.hold === now, 'Tras fijar, intercambia');
    assert(g.stats.holds === 2, 'Contador: ' + g.stats.holds);
  });

  test('Guardar pieza: funciona con piezas compradas y la intercambiada nace arriba', () => {
    const g = newGame();
    g.brains = 100;
    BOTD.Game.buy(g, 'single');
    BOTD.Game.hardDrop(g);                 // ahora cae la U comprada
    assert(g.piece.kind === 'U', 'Pieza: ' + g.piece.kind);
    BOTD.Game.hold(g);
    assert(g.hold === 'U', 'La pieza comprada queda guardada');
    BOTD.Game.hardDrop(g);
    BOTD.Game.hold(g);
    assert(g.piece.kind === 'U' && g.piece.y === 0, 'Sale la U guardada desde arriba');
  });

  test('Dificultad: cambia la caída, la vida de los zombies y los cerebros', () => {
    const hard = BOTD.Game.create(0, {}, { difficulty: 'hard' });
    const easy = BOTD.Game.create(0, {}, { difficulty: 'easy' });
    const D = C.DIFFICULTY;
    assert(hard.diff === D.hard && easy.diff === D.easy && hard.difficulty === 'hard', 'Dificultad aplicada');
    // Vida al aparecer
    [hard, easy].forEach(g => {
      g.waves.index = 0; g.waves.state = 'spawning'; g.waves.queue = ['basic']; g.waves.spawnT = 0;
      BOTD.Game.update(g, 1 / 60);
    });
    assert(hard.zombies[0].maxHp === Math.round(C.ZOMBIES.basic.hp * D.hard.zombieHp), 'Vida en difícil: ' + hard.zombies[0].maxHp);
    assert(easy.zombies[0].maxHp === Math.round(C.ZOMBIES.basic.hp * D.easy.zombieHp), 'Vida en fácil: ' + easy.zombies[0].maxHp);
    // Cerebros
    const b0 = easy.brains;
    BOTD.Game.addBrains(easy, 20, 1, 5);
    assert(easy.brains - b0 === Math.round(20 * D.easy.brains), 'Cerebros en fácil: +' + (easy.brains - b0));
    // Caída: en fácil la pieza tarda más en bajar una fila
    const steps = g => { const y0 = g.piece.y; let n = 0; while (g.piece.y === y0 && n < 600) { BOTD.Game.update(g, 1 / 60); n++; } return n; };
    const e = BOTD.Game.create(0, {}, { difficulty: 'easy' }), h = BOTD.Game.create(0, {}, { difficulty: 'hard' });
    e.waves.breakT = h.waves.breakT = 1e9;
    assert(steps(e) > steps(h), 'Fácil cae más lento que difícil');
    assert(BOTD.Game.create(0, {}, { difficulty: 'imposible' }).difficulty === 'normal', 'Dificultad inválida → normal');
  });

  test('Dificultad: récords separados y compatibles con la v1.0', () => {
    const P = BOTD.Progress;
    assert(P.recordKey(3, 'normal') === '3' && P.recordKey(3, 'hard') === '3:hard', 'Claves');
    const d = S.sanitize({ best: { 3: 500 } });
    assert(!P.setRecord(d, 3, 'normal', 400) && d.best['3'] === 500, 'Normal conserva el récord antiguo');
    assert(P.setRecord(d, 3, 'hard', 300) && d.best['3:hard'] === 300 && d.best['3'] === 500, 'Difícil aparte');
    assert(S.sanitize({ settings: { difficulty: 'hard' } }).settings.difficulty === 'hard', 'Se guarda la dificultad');
    assert(S.sanitize({ settings: { difficulty: 'x' } }).settings.difficulty === 'normal', 'Dificultad inválida');
  });

  test('Reto diario: la misma fecha da el mismo reto y las mismas piezas', () => {
    const L = BOTD.Levels;
    const a = L.makeDaily('2026-11-19'), b = L.makeDaily('2026-11-19');
    assert(JSON.stringify(a) === JSON.stringify(b), 'Mismo nivel');
    assert(L.DAILY_RULES.includes(a.rule) && a.daily && a.waves.length === C.DAILY.waves, 'Regla y oleadas');
    const g1 = BOTD.Game.create(L.DAILY_INDEX, {}, { dateKey: '2026-11-19' });
    const g2 = BOTD.Game.create(L.DAILY_INDEX, {}, { dateKey: '2026-11-19' });
    const seq = g => { const s = [g.piece.kind, g.next]; for (let i = 0; i < 12; i++) s.push(g.bag[i] || ''); return s.join(''); };
    assert(seq(g1) === seq(g2), 'Mismas piezas: ' + seq(g1) + ' / ' + seq(g2));
    assert(g1.difficulty === 'normal', 'El reto es siempre en normal');
    // Distintas fechas cambian el reto (al menos una de 10)
    const sigs = new Set();
    for (let i = 1; i <= 10; i++) sigs.add(JSON.stringify(L.makeDaily('2027-01-' + String(i).padStart(2, '0'))));
    assert(sigs.size > 1, 'Las fechas deberían dar retos distintos');
  });

  test('Reto diario: se aplican las reglas especiales', () => {
    const L = BOTD.Levels;
    // Buscar fechas con cada regla
    const byRule = {};
    for (let i = 0; i < 400 && Object.keys(byRule).length < L.DAILY_RULES.length; i++) {
      const dt = new Date(2027, 0, 1 + i);
      const k = L.todayKey(dt);
      const r = L.makeDaily(k).rule;
      if (!byRule[r]) byRule[r] = k;
    }
    assert(Object.keys(byRule).length === L.DAILY_RULES.length, 'Faltan reglas: ' + Object.keys(byRule).join(','));
    const make = rule => BOTD.Game.create(L.DAILY_INDEX, {}, { dateKey: byRule[rule] });
    assert(!make('noRollers').rollers.some(Boolean), 'Sin rodillos');
    const mw = make('onlyMinesWalls');
    assert(['T', 'S', 'L'].every(k => ['wall', 'mine'].includes(BOTD.Game.typeOf(mw, k))), 'Solo minas y muros');
    assert(make('brainRain').brainMul === 2, 'Lluvia de cerebros');
    assert(make('totalFog').level.fog === C.COLS - C.BUILD_COLS, 'Niebla total');
    assert(make('bossRush').level.waves.some(w => w.boss), 'Llega el jefe');
    assert(make('fastZombies').level.zombieSpeed > 1, 'Zombies rápidos');
  });

  test('Reto diario: récord del día y racha de días seguidos', () => {
    const P = BOTD.Progress;
    const d = S.sanitize({});
    let r = P.playDaily(d, '2026-11-18', 300);
    assert(r.newBest && r.streak === 1 && d.daily.best === 300, 'Primer día');
    r = P.playDaily(d, '2026-11-18', 200);
    assert(!r.newBest && r.streak === 1 && d.daily.best === 300, 'Mismo día, peor puntuación');
    r = P.playDaily(d, '2026-11-19', 100);
    assert(r.newBest && r.streak === 2 && d.daily.best === 100, 'Día siguiente: racha 2 y récord nuevo del día');
    assert(P.currentStreak(d, '2026-11-20') === 2 && P.currentStreak(d, '2026-11-22') === 0, 'La racha caduca');
    r = P.playDaily(d, '2026-11-25', 50);
    assert(r.streak === 1 && d.daily.bestStreak === 2, 'Se rompe la racha; se guarda la mejor');
    assert(P.previousDay('2026-03-01') === '2026-02-28' && P.previousDay('2027-01-01') === '2026-12-31', 'Cambio de mes y año');
  });

  /* ---------- v1.3: idiomas, música, accesibilidad, teclas y mando ---------- */
  test('Idiomas: español e inglés tienen las mismas claves y marcadores', () => {
    const S2 = BOTD.I18N.strings;
    const es = Object.keys(S2.es), en = Object.keys(S2.en);
    const missingEn = es.filter(k => !(k in S2.en)), missingEs = en.filter(k => !(k in S2.es));
    assert(!missingEn.length, 'Faltan en inglés: ' + missingEn.join(', '));
    assert(!missingEs.length, 'Faltan en español: ' + missingEs.join(', '));
    const marks = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
    const bad = es.filter(k => marks(S2.es[k]) !== marks(S2.en[k]));
    assert(!bad.length, 'Marcadores distintos en: ' + bad.join(', '));
    const empty = es.concat(en).filter(k => !String(S2.es[k] || '').trim() || !String(S2.en[k] || '').trim());
    assert(!empty.length, 'Textos vacíos: ' + empty.join(', '));
  });

  test('Idiomas: cambiar de idioma, sustituir marcadores y elegir el del navegador', () => {
    const prev = BOTD.I18N.lang;
    try {
      BOTD.setLang('en');
      assert(BOTD.t('menu_play') === 'Play' && BOTD.t('wave_n', { n: 3 }) === 'Wave 3!', BOTD.t('menu_play'));
      BOTD.setLang('xx');
      assert(BOTD.I18N.lang === 'en', 'Un idioma desconocido no cambia nada');
      BOTD.setLang('es');
      assert(BOTD.t('menu_play') === 'Jugar', 'Español');
      assert(BOTD.t('clave_que_no_existe') === 'clave_que_no_existe', 'Clave desconocida');
      assert(BOTD.resolveLang('en') === 'en' && BOTD.resolveLang('es') === 'es', 'Idioma guardado');
      assert(BOTD.I18N.LANGS.includes(BOTD.resolveLang('')), 'Idioma del navegador');
    } finally { BOTD.setLang(prev); }
  });

  test('Ajustes v1.3: idioma, accesibilidad y teclas se validan', () => {
    const d = S.sanitize({ settings: { lang: 'en', colorblind: true, bigText: 'si', reduceMotion: false,
      keys: { left: ['KeyJ'], rotate: 'x', drop: ['<script>'] } } });
    const s = d.settings;
    assert(s.lang === 'en' && s.colorblind === true && s.bigText === false && s.reduceMotion === false, JSON.stringify(s));
    assert(s.keys.left[0] === 'KeyJ' && !('rotate' in s.keys) && s.keys.drop.length === 0, JSON.stringify(s.keys));
    const def = S.sanitize({}).settings;
    assert(def.lang === '' && def.reduceMotion === null && Object.keys(def.keys).length === 0, 'Valores por defecto');
  });

  test('Teclas: reasignar una tecla la quita de la otra acción', () => {
    const I = BOTD.Input;
    const r = I.rebind(I.DEFAULT_KEYS, 'drop', 'KeyA');
    assert(r.bindings.drop.join() === 'KeyA', 'Soltar: ' + r.bindings.drop);
    assert(r.movedFrom === 'left' && !r.bindings.left.includes('KeyA') && r.bindings.left.includes('ArrowLeft'), 'Izquierda: ' + r.bindings.left);
    const r2 = I.rebind(I.DEFAULT_KEYS, 'hold', 'KeyV');
    assert(r2.movedFrom === null && r2.bindings.hold.join() === 'KeyV', 'Tecla libre');
    assert(I.keyLabel('ArrowLeft') === '←' && I.keyLabel('KeyQ') === 'Q' && I.keyLabel('Digit3') === '3', 'Nombres de teclas');
  });

  test('Mando: los botones y la cruceta producen las acciones', () => {
    const I = BOTD.Input;
    const got = [];
    I.setHandlers({
      move: d => got.push('move' + d), rotate: () => got.push('rotate'), rotateCCW: () => got.push('ccw'),
      drop: () => got.push('drop'), hold: () => got.push('hold'), pause: () => got.push('pause'),
      shop1: () => got.push('shop1'), soft: v => got.push('soft' + (v ? 1 : 0))
    });
    const pad = (pressed, axes) => [{ connected: true, axes: axes || [0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) }];
    I.pollPads(pad([0]));          // A
    I.pollPads(pad([0]));          // mantener A no repite
    I.pollPads(pad([]));
    I.pollPads(pad([2, 3]));       // X e Y
    I.pollPads(pad([]));
    I.pollPads(pad([14]));         // izquierda en la cruceta
    I.pollPads(pad([], [0, 0.9])); // palanca hacia abajo (suelta la izquierda)
    I.pollPads(pad([9, 4], [0, 0.9])); // Start y LB, con la palanca aún abajo
    I.pollPads([]);                // mando desconectado: debe soltar la palanca
    const s = got.join(' ');
    ['rotate', 'drop', 'hold', 'move-1', 'soft1', 'pause', 'shop1'].forEach(k => assert(got.includes(k), 'Falta ' + k + ' en: ' + s));
    assert(got.filter(x => x === 'rotate').length === 1, 'A mantenido no debe repetir: ' + s);
    assert(got[got.length - 1] === 'soft0', 'Al desconectar se suelta todo: ' + s);
    I.setHandlers({});
    I.reset();
  });

  test('Música: cada mundo tiene su pista y todas son válidas', () => {
    const A2 = BOTD.Audio;
    assert(A2.trackFor(BOTD.Levels.get(0)) === 'garden', 'Mundo 1');
    assert(A2.trackFor(BOTD.Levels.get(4)) === 'night', 'Noche');
    assert(A2.trackFor(BOTD.Levels.get(6)) === 'graveyard', 'Cementerio');
    assert(A2.trackFor(BOTD.Levels.get(-1)) === 'survival', 'Supervivencia');
    for (const k in A2.TRACKS) {
      const t = A2.TRACKS[k];
      assert(t.bass.length === 32 && t.mel.length === 32 && t.step > 0.05, 'Pista ' + k);
    }
    A2.setTrack('boss'); A2.setIntensity(true);
    assert(A2.trackName === 'boss' && A2.intensity === 1, 'Cambio de pista e intensidad');
    A2.setTrack('garden'); A2.setIntensity(false);
  });

  /* ---------- v1.4: app instalable y móvil ---------- */
  test('Sin conexión: la lista de precarga incluye todos los dibujos y scripts', () => {
    const list = self.BOTD_PRECACHE;
    assert(Array.isArray(list) && list.includes('index.html') && list.includes('manifest.webmanifest'), 'Página y manifiesto');
    // Todos los dibujos que carga el juego
    const svgs = ['wall', 'single', 'bunker', 'hedge', 'shooter-head', 'mine', 'slime', 'bomb', 'pea', 'zombie-head',
      'zombie-jaw', 'zombie-torso', 'zombie-arm', 'zombie-leg', 'runner-head', 'runner-torso', 'boss-head', 'boss-torso',
      'boss-arm', 'cone', 'house', 'tombstone', 'brain', 'cloud', 'dirt', 'roller', 'ice-base', 'ice-head', 'ice-pea',
      'cactus', 'flower-base', 'sunflower', 'grave-block', 'bucket', 'shield', 'digger-head', 'balloon', 'crown'];
    const missingSvg = svgs.filter(n => !list.includes(BOTD.Assets.url(n)));
    assert(!missingSvg.length, 'Faltan dibujos: ' + missingSvg.join(', '));
    // Todos los scripts del juego
    const js = ['config', 'i18n', 'storage', 'audio', 'assets', 'pieces', 'board', 'defenses', 'zombies', 'projectiles',
      'levels', 'progress', 'game', 'render', 'input', 'ui', 'tutorial', 'pwa', 'main'];
    const missingJs = js.filter(n => !list.includes('js/' + n + '.js'));
    assert(!missingJs.length, 'Faltan scripts: ' + missingJs.join(', '));
    assert(list.every(p => typeof p === 'string' && !p.startsWith('/') && !p.includes('..')), 'Rutas relativas y seguras');
    assert(new Set(list).size === list.length, 'Sin duplicados');
  });

  test('Sin conexión: config.js funciona también fuera de la página (service worker)', () => {
    assert(self.BOTD === window.BOTD && typeof BOTD.VERSION === 'string', 'BOTD global en self');
    assert(typeof BOTD.PWA.register === 'function' && typeof BOTD.PWA.supported === 'function', 'Módulo PWA');
    assert(BOTD.PWA.canInstall === false, 'Sin instalar al empezar');
  });

  test('Móvil: ajustes de botones táctiles y vista ampliada', () => {
    const d = S.sanitize({ settings: { touchLayout: 'swap', zoomView: true } });
    assert(d.settings.touchLayout === 'swap' && d.settings.zoomView === true, JSON.stringify(d.settings));
    const def = S.sanitize({ settings: { touchLayout: 'arriba', zoomView: 'si' } });
    assert(def.settings.touchLayout === 'split' && def.settings.zoomView === false, 'Valores inválidos');
  });

  test('Móvil: la vista ampliada recorta solo la zona de los zombies', () => {
    const R2 = BOTD.Render;
    const full = R2.LW;
    assert(full === (C.COLS + 1) * C.CELL, 'Ancho completo: ' + full);
    assert(R2.setCrop(3) === true && R2.LW === full - 3 * C.CELL && R2.cropCols === 3, 'Recorte de 3 columnas');
    assert(R2.setCrop(3) === false, 'Mismo recorte: sin cambios');
    R2.setCrop(99);
    assert(R2.LW >= (C.BUILD_COLS + 2) * C.CELL, 'Nunca tapa la zona de construcción: ' + R2.LW);
    R2.setCrop(0);
    assert(R2.LW === full, 'Vuelve al ancho completo');
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
