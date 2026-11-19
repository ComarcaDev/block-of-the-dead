/* Arranque, estados del juego (menú, jugando, pausa...) y bucle principal. */
(() => {
  const C = BOTD.CONFIG;
  const G = BOTD.Game, UI = BOTD.UI, A = BOTD.Audio, S = BOTD.Storage, L = BOTD.Levels, Input = BOTD.Input;
  const DEBUG = /[?&]debug\b/.test(location.search);

  const R = BOTD.Render;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Estados: menu | playing | paused | picker | ended
  let state = 'menu';
  let game = null;

  S.load();
  BOTD.setLang(BOTD.resolveLang(S.data.settings.lang));   // idioma guardado o el del navegador
  A.setSfx(S.data.settings.sfx);
  A.setMusic(S.data.settings.music);
  R.init(ctx);
  UI.init(command);
  UI.updateToggles(S.data.settings);
  UI.showScreen('menu');
  BOTD.Assets.load().then(() => UI.setReady(S.data, L.count));

  // App instalable: botón "Instalar", aviso de versión nueva y listo sin conexión
  const PWA = BOTD.PWA;
  PWA.on('installable', can => document.querySelectorAll('.install-btn').forEach(b => { b.hidden = !can; }));
  PWA.on('update', () => { document.getElementById('update-bar').hidden = false; });
  PWA.on('offlineReady', () => UI.toast('📲', BOTD.t('offline_ready')));
  PWA.register();

  function toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const p = req.call(el);
        if (p && p.catch) p.catch(() => {});
      }
    }
  }

  const canPlay = () => state === 'playing' && game && !game.over;

  Input.init({
    move: d => { if (canPlay()) G.move(game, d); },
    rotate: () => { if (canPlay()) G.rotate(game, 1); },
    rotateCCW: () => { if (canPlay()) G.rotate(game, -1); },
    drop: () => { if (canPlay()) G.hardDrop(game); },
    hold: () => { if (canPlay()) G.hold(game); },
    soft: v => { if (game) game.softDrop = !!v && canPlay(); },
    pause: () => {
      if (canPlay()) pause();
      else if (state === 'paused') resume();
      else if (state === 'picker') closePicker();
    },
    fullscreen: toggleFullscreen,
    shop1: () => command('shop', 'choose'),
    shop2: () => command('shop', 'single'),
    shop3: () => command('shop', 'bomb'),
    padConnected: on => UI.toast('🎮', BOTD.t(on ? 'pad_on' : 'pad_off'))
  }, S.data.settings.keys);

  // Reducir animaciones: lo elegido, o la preferencia del sistema si no se ha elegido
  const systemReduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduceMotion = () => (S.data.settings.reduceMotion == null ? systemReduce() : S.data.settings.reduceMotion);

  // Ajustes tal como se muestran (idioma efectivo y reducir animaciones efectivo)
  const shownSettings = () => Object.assign({}, S.data.settings, { lang: BOTD.I18N.lang, reduceMotion: reduceMotion() });

  // Música: pista del mundo y capa intensa en grandes oleadas o con jefe
  function updateMusic() {
    if (!game || state !== 'playing') return;
    const bossAlive = game.zombies.some(z => !z.dead && BOTD.Zombies.isBoss(z.type));
    A.setTrack(bossAlive ? 'boss' : A.trackFor(game.level));
    const w = game.waves;
    const bigNow = w && w.state === 'spawning' && L.isBig(game.level, w.index);
    A.setIntensity(bossAlive || bigNow);
  }

  // Lo que el jugador tiene desbloqueado según los niveles ganados
  function levelOptions() {
    const won = Math.max(0, S.data.unlocked - 1);
    const defenses = L.defensesFor(won);
    return {
      defenses,
      shopLocked: L.shopLockedFor(won),
      loadout: L.loadoutFor(S.data.loadout, defenses),
      mods: BOTD.Progress.mods(S.data),
      difficulty: S.data.settings.difficulty
    };
  }

  // Reto diario: igual para todos (todas las defensas, sin mejoras ni bloqueos de tienda)
  let dailyKey = L.todayKey();
  function dailyOptions(level) {
    const defenses = level.onlyDefenses || G.ALL_DEFENSES.slice();
    return {
      defenses, shopLocked: [], mods: BOTD.Progress.NO_MODS, difficulty: 'normal', dateKey: level.dateKey,
      loadout: L.loadoutFor(S.data.loadout, defenses, !!level.onlyDefenses)
    };
  }

  // Récord de supervivencia por dificultad (normal usa los campos de siempre)
  function survivalRecord(diff) {
    if (diff === 'normal') return S.data.survival;
    return { bestWave: S.data.best['svw:' + diff] || 0, bestScore: S.data.best['svs:' + diff] || 0 };
  }
  function saveSurvivalRecord(diff, rec) {
    if (diff === 'normal') { S.data.survival = rec; return; }
    S.data.best['svw:' + diff] = rec.bestWave;
    S.data.best['svs:' + diff] = rec.bestScore;
  }

  /* ---------- Logros ---------- */
  function checkAchievements(ctx) {
    ctx.totalKills = S.data.totals.kills;
    const fresh = BOTD.Progress.evaluate(ctx, S.data);
    if (!fresh.length) return;
    S.save();
    fresh.forEach((id, i) => setTimeout(() => {
      UI.toast(BOTD.t('ach_unlocked'), BOTD.t('ach_' + id));
      A.play('achievement');
    }, i * 600));
  }

  // Sucesos de la partida: estadísticas acumuladas y logros
  function onGameEvent(name, data) {
    const T = S.data.totals;
    if (name === 'kill') {
      T.kills++;
      T.killsByType[data.type] = (T.killsByType[data.type] || 0) + 1;
      checkAchievements({ event: 'kill', type: data.type });
    } else if (name === 'lines') {
      T.lines += data.n;
      const k = String(Math.min(4, data.n));
      T.linesByCount[k] = (T.linesByCount[k] || 0) + 1;
      T.bestCombo = Math.max(T.bestCombo, data.combo || 0);
      checkAchievements({ event: 'lines', n: data.n, combo: data.combo });
    } else if (name === 'wave') {
      checkAchievements({ event: 'wave', n: data.n, survival: data.survival });
    }
  }

  const clampLevel = i => (i === L.DAILY_INDEX ? i : i < 0 ? L.SURVIVAL_INDEX : Math.max(0, Math.min(L.count - 1, i)));

  // Almanaque: marca como descubierto (y guarda solo si es nuevo)
  function markSeen(group, type) {
    const m = S.data.almanac[group];
    if (m[type]) return;
    m[type] = true;
    S.save();
  }

  function markDefensesSeen() {
    const o = levelOptions();
    o.defenses.forEach(t => markSeen('defenses', t));
    markSeen('defenses', 'single');
    if (!o.shopLocked.includes('bomb')) markSeen('defenses', 'bomb');
  }

  // Antes de cada nivel se eligen las defensas (salvo durante el tutorial)
  function prepareLevel(i) {
    i = clampLevel(i);
    if (i === 0 && !S.data.tutorialDone) { startLevel(0); return; }
    state = 'loadout';
    A.stopMusic();
    BOTD.Tutorial.cancel();
    if (i === L.DAILY_INDEX) {
      dailyKey = L.todayKey();   // la fecha se fija al prepararlo (por si cambia el día jugando)
      const level = L.makeDaily(dailyKey);
      const o = dailyOptions(level);
      UI.openLoadout(i, o.defenses, o.loadout, { daily: level });
      return;
    }
    const o = levelOptions();
    UI.openLoadout(i, o.defenses, o.loadout, { difficulty: o.difficulty });
  }

  function startLevel(i) {
    i = clampLevel(i);
    BOTD.Tutorial.cancel();
    const opts = i === L.DAILY_INDEX ? dailyOptions(L.makeDaily(dailyKey)) : levelOptions();
    game = G.create(i, {
      onEnd,
      onBrains: (n, x, y) => UI.flyBrains(n, R.worldToClient(x, y)),
      onSpawn: type => markSeen('zombies', type),
      onEvent: onGameEvent
    }, opts);
    S.data.totals.games++;
    markDefensesSeen();
    if (game.level.graves) markSeen('defenses', 'grave');
    if (i === 0 && !S.data.tutorialDone) {
      BOTD.Tutorial.start(game, () => { S.data.tutorialDone = true; S.save(); });
    }
    state = 'playing';
    errorStreak = 0;
    UI.resetHud();
    UI.showScreen(null);
    Input.reset();
    A.init();
    A.stopMusic();
    A.setTrack(A.trackFor(game.level));
    A.setIntensity(false);
    A.startMusic();
  }

  function pause() {
    state = 'paused';
    S.save();   // guarda estadísticas (tiempo jugado, etc.)
    A.stopMusic();
    Input.reset();
    UI.showScreen('pause');
  }

  function resume() {
    state = 'playing';
    UI.showScreen(null);
    A.startMusic();
  }

  function closePicker() {
    state = 'playing';
    UI.showScreen(null);
  }

  function toMenu() {
    state = 'menu';
    game = null;
    errorStreak = 0;
    BOTD.Tutorial.cancel();
    S.save();
    A.stopMusic();
    UI.refreshMenu(S.data, L.count);
    UI.showScreen('menu');
  }

  function onEnd(result) {
    state = 'ended';
    A.stopMusic();
    Input.reset();
    const g = game;

    // Supervivencia: siempre termina perdiendo; se guarda el récord y los cerebros
    if (g.survival) {
      A.play('lose');
      const wave = Math.max(0, g.waves.index + 1);
      const sv = survivalRecord(g.difficulty);
      const newBest = wave > sv.bestWave || (wave === sv.bestWave && g.score > sv.bestScore);
      if (wave > sv.bestWave) sv.bestWave = wave;
      if (g.score > sv.bestScore) sv.bestScore = g.score;
      saveSurvivalRecord(g.difficulty, sv);
      S.data.bank += g.brains;
      S.save();
      UI.showResult(result, g, false, false, null, {
        bankGain: g.brains, bankTotal: S.data.bank,
        survival: { wave, bestWave: sv.bestWave, newBest }
      });
      return;
    }

    // Reto diario: récord del día, racha y cerebros si se gana
    if (g.level.daily) {
      A.play(result.won ? 'win' : 'lose');
      const d = BOTD.Progress.playDaily(S.data, g.level.dateKey, g.score);
      const bankGain = result.won ? g.brains : 0;
      if (result.won) { S.data.totals.wins++; S.data.bank += bankGain; }
      S.save();
      checkAchievements({ event: 'end', won: !!result.won, levelIndex: g.levelIndex,
        livesLost: g.stats.livesLost, rollersUsed: g.stats.rollersUsed });
      const [y, m, day] = g.level.dateKey.split('-');
      UI.showResult(result, g, false, false, null, {
        bankGain, bankTotal: S.data.bank,
        daily: { dateLabel: day + '/' + m + '/' + y, best: S.data.daily.best, newBest: d.newBest, streak: d.streak }
      });
      return;
    }

    const num = g.levelIndex + 1;
    let newBest = false, newDefense = null, bankGain = 0;
    if (result.won) {
      A.play('win');
      S.data.totals.wins++;
      const firstWin = num >= S.data.unlocked;   // ¿es la primera vez que se gana este nivel?
      if (firstWin) newDefense = L.unlockAt(num);
      S.unlock(Math.min(L.count, num + 1));
      if (firstWin && num === L.count) S.unlock(num + 1);   // cuenta el último nivel como ganado
      newBest = BOTD.Progress.setRecord(S.data, num, g.difficulty, g.score);
      // Los cerebros que sobran se guardan para el cobertizo
      bankGain = g.brains;
      S.data.bank += bankGain;
    } else {
      A.play('lose');
    }
    S.save();
    checkAchievements({
      event: 'end', won: !!result.won, levelIndex: g.levelIndex,
      livesLost: g.stats.livesLost, rollersUsed: g.stats.rollersUsed
    });
    UI.showResult(result, g, newBest, num < L.count, newDefense, { bankGain, bankTotal: S.data.bank });
  }

  function command(cmd, arg) {
    switch (cmd) {
      case 'play': prepareLevel(Math.min(S.data.unlocked, L.count) - 1); break;
      case 'levels': UI.buildLevels(S.data, L.count, DEBUG); UI.showScreen('levels'); break;
      case 'howto': UI.showScreen('howto'); break;
      case 'almanac': markDefensesSeen(); UI.buildAlmanac(S.data); UI.showScreen('almanac'); break;
      case 'survival': if (S.data.unlocked > 5) prepareLevel(L.SURVIVAL_INDEX); break;
      case 'daily': prepareLevel(L.DAILY_INDEX); break;
      case 'hold': if (canPlay()) G.hold(game); break;
      case 'shed': UI.buildShed(S.data); UI.showScreen('shed'); break;
      case 'shed-buy':
        if (BOTD.Progress.buy(S.data, arg)) {
          A.play('buy');
          S.save();
          checkAchievements({ event: 'buy', key: arg });
        } else {
          A.play('deny');
        }
        UI.buildShed(S.data);
        break;
      case 'achievements': UI.buildAchievements(S.data); UI.showScreen('achievements'); break;
      case 'alm-tab': UI.buildAlmanac(S.data, arg); break;
      case 'back': toMenu(); break;
      case 'level': prepareLevel(parseInt(arg, 10)); break;
      case 'loadout-reset': UI.resetLoadout(); break;
      case 'loadout-go': {
        const lo = UI.getLoadout();
        if (!lo) break;
        // La elección del reto "solo minas y muros" no sustituye la habitual
        if (lo.levelIndex !== L.DAILY_INDEX || !L.makeDaily(dailyKey).onlyDefenses) S.data.loadout = Object.assign({}, lo.sel);
        if (lo.levelIndex !== L.DAILY_INDEX) S.data.settings.difficulty = lo.difficulty;
        S.save();
        startLevel(lo.levelIndex);
        break;
      }
      case 'pause': if (canPlay()) pause(); else if (state === 'paused') resume(); break;
      case 'resume': if (state === 'paused') resume(); break;
      case 'restart':
      case 'retry': if (game) startLevel(game.levelIndex); break;
      case 'next': if (game) prepareLevel(game.levelIndex + 1); break;
      case 'menu': toMenu(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'sfx':
        S.data.settings.sfx = !S.data.settings.sfx;
        A.setSfx(S.data.settings.sfx);
        S.save();
        UI.updateToggles(S.data.settings);
        break;
      case 'music':
        S.data.settings.music = !S.data.settings.music;
        A.setMusic(S.data.settings.music);
        if (S.data.settings.music && state === 'playing') A.startMusic();
        S.save();
        UI.updateToggles(S.data.settings);
        break;
      case 'shop':
        if (!canPlay()) return;
        if (arg === 'choose' && G.canAfford(game, 'choose')) {
          state = 'picker';
          Input.reset();
          UI.buildPicker(game);
          UI.showScreen('picker');
        } else {
          G.buy(game, arg);
        }
        break;
      case 'pick':
        if (state === 'picker') { G.buy(game, 'choose', arg); closePicker(); }
        break;
      case 'picker-cancel': if (state === 'picker') closePicker(); break;
      case 'tut-skip': BOTD.Tutorial.skip(); break;

      /* ----- Ajustes ----- */
      case 'settings':
        settingsReturn = state === 'paused' ? 'pause' : 'menu';
        UI.updateSettings(shownSettings());
        UI.buildKeys(Input.getBindings());
        UI.setKeysMsg('');
        UI.setSaveCode('');
        UI.setSaveMsg('');
        UI.showScreen('settings');
        break;
      case 'settings-back':
        Input.captureNext(null);
        if (settingsReturn === 'pause' && state === 'paused') UI.showScreen('pause');
        else toMenu();
        break;
      case 'setting':
        if (!arg || !(arg.key in S.data.settings)) break;
        S.data.settings[arg.key] = arg.value;
        if (arg.key === 'lang') {
          BOTD.setLang(arg.value);
          UI.relocalize(S.data, L.count);
          UI.buildKeys(Input.getBindings());
        }
        applySettings();
        UI.updateSettings(shownSettings());
        S.save();
        break;

      /* ----- Teclas ----- */
      case 'key-capture':
        UI.buildKeys(Input.getBindings(), arg);
        UI.setKeysMsg('');
        Input.captureNext(code => {
          if (!code) { UI.buildKeys(Input.getBindings()); return; }
          const r = Input.rebind(Input.getBindings(), arg, code);
          S.data.settings.keys = r.bindings;
          Input.setBindings(r.bindings);
          S.save();
          UI.buildKeys(Input.getBindings());
          UI.buildHowto();
          if (r.movedFrom) UI.setKeysMsg(BOTD.t('key_moved', { k: Input.keyLabel(code), a: BOTD.t('act_' + r.movedFrom) }));
        });
        break;
      case 'install': PWA.promptInstall(); break;
      case 'apply-update':
        S.save();
        document.getElementById('update-bar').hidden = true;
        PWA.applyUpdate();
        break;
      case 'keys-reset':
        S.data.settings.keys = {};
        Input.setBindings(null);
        S.save();
        UI.buildKeys(Input.getBindings());
        UI.buildHowto();
        UI.setKeysMsg('');
        break;
      case 'stats': S.save(); UI.buildStats(S.data); UI.showScreen('stats'); break;

      /* ----- Exportar / importar partida ----- */
      case 'export-copy': {
        const code = S.exportCode();
        UI.setSaveCode(code);
        copyText(code).then(ok => UI.setSaveMsg(ok ? 'export_copied' : 'export_shown', true));
        break;
      }
      case 'export-file': {
        const blob = new Blob([S.exportJson()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'block-of-the-dead-partida.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        UI.setSaveMsg('export_saved', true);
        break;
      }
      case 'import-code': handleImport(UI.getSaveCode()); break;
      case 'import-file': document.getElementById('import-file').click(); break;
      case 'import-text': handleImport(arg); break;
    }
  }

  let settingsReturn = 'menu';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy());
    }
    return Promise.resolve(fallbackCopy());
  }

  function fallbackCopy() {
    const ta = document.getElementById('save-code');
    ta.focus();
    ta.select();
    try { return document.execCommand('copy'); } catch (e) { return false; }
  }

  function handleImport(text) {
    const r = S.importCode(text);
    if (!r.ok) { A.play('deny'); UI.setSaveMsg(r.error, false); return; }
    if (!window.confirm(BOTD.t('import_confirm'))) return;
    S.replace(r.data);
    UI.setSaveMsg('import_ok', true);
    setTimeout(() => location.reload(), 900);   // recargar para aplicar todo el progreso importado
  }

  // Atajos de depuración (abrir index.html?debug): K mata zombies, B +100 cerebros, N gana el nivel
  if (DEBUG) {
    window.addEventListener('keydown', e => {
      if (!canPlay()) return;
      if (e.code === 'KeyK') game.zombies.forEach(z => BOTD.Zombies.damage(game, z, 1e9));
      if (e.code === 'KeyB') game.brains += 100;
      if (e.code === 'KeyN') G.win(game);
    });
  }

  // Pausa automática al cambiar de pestaña (y se guardan las estadísticas)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (canPlay()) pause(); else S.save();
  });

  // Ajustar el lienzo al espacio disponible
  const stage = document.getElementById('stage');
  // El lienzo se dibuja a la resolución real de la pantalla (devicePixelRatio) para verse nítido
  const P = C.PERF;
  const portraitQuery = window.matchMedia('(max-width: 860px) and (orientation: portrait)');
  const isMobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let lastFit = '';
  function fit() {
    const w = stage.clientWidth - 12, h = stage.clientHeight - 16;
    const s = Math.max(0.1, Math.min(w / R.LW, h / R.LH));
    const cssW = Math.floor(R.LW * s), cssH = Math.floor(R.LH * s);
    const maxDpr = BOTD.Quality.low ? P.DPR_MAX_LOW : isMobile ? P.DPR_MAX_MOBILE : P.DPR_MAX;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const key = cssW + 'x' + cssH + '@' + dpr;
    if (key === lastFit) return;
    lastFit = key;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    R.resize(canvas.width / R.LW);
  }
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);

  // Aplica los ajustes guardados (volúmenes, calidad, sacudidas)
  function applySettings() {
    const s = S.data.settings;
    A.setSfx(s.sfx);
    A.setMusic(s.music);
    A.setSfxVolume(s.sfxVol);
    A.setMusicVolume(s.musicVol);
    BOTD.Prefs.shake = s.shake;
    // Accesibilidad
    BOTD.Prefs.colorblind = s.colorblind;
    BOTD.Prefs.textScale = s.bigText ? 1.2 : 1;
    BOTD.Prefs.reduceMotion = reduceMotion();
    document.body.classList.toggle('big-text', !!s.bigText);
    document.body.classList.toggle('reduce-motion', BOTD.Prefs.reduceMotion);
    if (game) UI.resetHud();   // redibujar las vistas previas (símbolos del modo daltónico)
    // Móvil: lado de los botones táctiles y vista ampliada en vertical
    document.getElementById('touch').classList.toggle('touch-swap', s.touchLayout === 'swap');
    if (R.setCrop(s.zoomView && portraitQuery.matches ? 3 : 0)) lastFit = '';
    const low = s.quality === 'low';
    if (s.quality !== 'auto' || low) {
      if (BOTD.Quality.low !== low) { BOTD.Quality.low = low; lastFit = ''; }
    } else if (BOTD.Quality.low && !autoLowered) {
      BOTD.Quality.low = false;
      lastFit = '';
    }
    UI.updateToggles(s);
    fit();
  }
  let autoLowered = false;   // true si la calidad automática ya bajó la calidad en esta sesión
  applySettings();
  // Al girar el móvil se recalcula la vista ampliada
  if (portraitQuery.addEventListener) portraitQuery.addEventListener('change', applySettings);

  // Calidad automática: si el equipo va lento de forma sostenida, se baja la calidad una vez
  let frameAvg = 16.7, slowTime = 0;
  function watchPerformance(rawMs, dt) {
    if (rawMs > 100 || document.hidden) return;      // pausas o pestaña oculta: no cuentan
    frameAvg += (rawMs - frameAvg) * 0.05;
    if (S.data.settings.quality !== 'auto') return;  // calidad fijada a mano en los ajustes
    if (BOTD.Quality.low || state !== 'playing') { slowTime = 0; return; }
    slowTime = frameAvg > P.SLOW_FRAME_MS ? slowTime + dt : 0;
    if (slowTime >= P.SLOW_SECONDS) {
      BOTD.Quality.low = true;
      autoLowered = true;
      console.info('[Block of the Dead] Rendimiento bajo: se activa la calidad baja.');
      lastFit = '';
      fit();
    }
  }

  // Contador de FPS (con ?debug o activado en los ajustes)
  const fpsEl = document.createElement('div');
  fpsEl.className = 'fps-meter';
  document.body.appendChild(fpsEl);
  let fpsTimer = 0;
  function showFps(dt) {
    const on = DEBUG || S.data.settings.showFps;
    fpsEl.style.display = on ? '' : 'none';
    if (!on) return;
    fpsTimer += dt;
    if (fpsTimer < 0.5) return;
    fpsTimer = 0;
    fpsEl.textContent = Math.round(1000 / frameAvg) + ' FPS' + (BOTD.Quality.low ? ' · ' + BOTD.t('q_low') : '') + ' · img ' + BOTD.Assets.cacheSize;
  }

  // Protección contra errores: un fallo no congela el juego; si se repite, se pausa con aviso
  let errorStreak = 0;
  function reportError(err) {
    errorStreak++;
    console.error('[Block of the Dead] Error en el bucle (' + errorStreak + '):', err);
    try { if (ctx.reset) ctx.reset(); else ctx.setTransform(1, 0, 0, 1, 0, 0); } catch (e) { /* ignorar */ }
    if (errorStreak > C.MAX_CONSECUTIVE_ERRORS && state !== 'crashed') {
      state = 'crashed';
      A.stopMusic();
      Input.reset();
      UI.showScreen('error');
    }
  }

  // Bucle con paso de tiempo fijo
  const STEP = 1 / 60;
  let lastT = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);          // se programa primero: un error nunca detiene el bucle
    const rawMs = now - lastT;
    const dt = Math.min(0.1, rawMs / 1000);
    lastT = now;
    if (state === 'crashed') return;       // esperando a que el jugador reinicie o vuelva al menú
    try {
      Input.update(dt);   // siempre: así el mando también puede reanudar desde la pausa
      if ((state === 'playing' || state === 'ended') && game) {
        if (state === 'playing') {
          S.data.totals.playTime += dt;   // tiempo jugado (se guarda al pausar, terminar o salir)
          updateMusic();
        }
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 8) {
          G.update(game, STEP);
          if (state === 'playing') BOTD.Tutorial.update(game, STEP);
          acc -= STEP;
          steps++;
        }
        if (steps >= 8) acc = 0;
      } else {
        acc = 0;
      }
      if (BOTD.Assets.ready) {
        if (game) R.draw(game);
        else R.drawIdle(dt);
      }
      UI.updateHud(game);
      errorStreak = 0;
    } catch (err) {
      acc = 0;
      reportError(err);
    }
    watchPerformance(rawMs, dt);
    showFps(dt);
  }
  requestAnimationFrame(frame);

  window.addEventListener('error', e => console.error('[Block of the Dead] Error no controlado:', e.message));

  // Para pruebas desde la consola
  window.BOTD.debug = {
    get game() { return game; }, get state() { return state; }, startLevel,
    get errorStreak() { return errorStreak; }, get frameAvg() { return frameAvg; }
  };
})();
