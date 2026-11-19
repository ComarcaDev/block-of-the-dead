/* Interfaz HTML: pantallas, HUD, tienda, selector de pieza y "Cómo jugar". */
window.BOTD = window.BOTD || {};

BOTD.UI = (() => {
  const C = BOTD.CONFIG;
  const $ = id => document.getElementById(id);
  let onCommand = () => {};
  let last = {};

  function fire(cmd, arg) {
    BOTD.Audio.init();
    if (cmd !== 'shop' && cmd !== 'setting') BOTD.Audio.play('click');
    onCommand(cmd, arg);
  }

  // Controles de la pantalla de ajustes
  function initSettings() {
    document.querySelectorAll('input[type=range][data-setting]').forEach(el => {
      el.addEventListener('input', () => {
        const v = Number(el.value) / 100;
        const out = document.querySelector('[data-out="' + el.dataset.setting + '"]');
        if (out) out.textContent = el.value + ' %';
        fire('setting', { key: el.dataset.setting, value: v });
      });
      // Al soltar, un pitido de prueba para oír el volumen de efectos
      el.addEventListener('change', () => { if (el.dataset.setting === 'sfxVol') BOTD.Audio.play('click'); });
    });
    document.querySelectorAll('input[type=checkbox][data-setting]').forEach(el => {
      el.addEventListener('change', () => fire('setting', { key: el.dataset.setting, value: el.checked }));
    });
    document.querySelectorAll('.seg[data-setting] button').forEach(b => {
      b.addEventListener('click', () => {
        BOTD.Audio.play('click');
        fire('setting', { key: b.parentElement.dataset.setting, value: b.dataset.value });
      });
    });
    $('import-file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => fire('import-text', String(r.result || ''));
      r.readAsText(f);
      e.target.value = '';
    });
  }

  function updateSettings(s) {
    document.querySelectorAll('input[type=range][data-setting]').forEach(el => {
      const pct = Math.round((s[el.dataset.setting] || 0) * 100);
      el.value = pct;
      const out = document.querySelector('[data-out="' + el.dataset.setting + '"]');
      if (out) out.textContent = pct + ' %';
    });
    document.querySelectorAll('input[type=checkbox][data-setting]').forEach(el => { el.checked = !!s[el.dataset.setting]; });
    document.querySelectorAll('.seg[data-setting]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('selected', s[seg.dataset.setting] === b.dataset.value));
    });
  }

  function getSaveCode() { return $('save-code').value; }
  function setSaveCode(text) { $('save-code').value = text; }
  function setSaveMsg(key, ok) {
    const m = $('save-msg');
    m.textContent = key ? BOTD.t(key) : '';
    m.className = 'set-msg' + (ok ? ' ok' : ok === false ? ' bad' : '');
  }

  /* ---------- Estadísticas ---------- */
  function fmtTime(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? BOTD.t('time_hm', { h, m }) : BOTD.t('time_m', { m: Math.max(0, m) });
  }

  function buildStats(data) {
    const T = data.totals;
    const body = $('stats-body');
    body.innerHTML = '';
    const sec = (titleKey, rows) => {
      const h = document.createElement('h3'); h.textContent = BOTD.t(titleKey);
      const dl = document.createElement('dl');
      rows.forEach(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        dl.append(dt, dd);
      });
      body.append(h, dl);
    };
    const lc = n => T.linesByCount[n] || 0;
    sec('st_general', [
      [BOTD.t('st_time'), fmtTime(T.playTime)],
      [BOTD.t('st_games'), T.games],
      [BOTD.t('st_wins'), T.wins],
      [BOTD.t('st_levels'), Math.max(0, Math.min(BOTD.Levels.count, data.unlocked - 1)) + ' / ' + BOTD.Levels.count],
      [BOTD.t('st_survival'), data.survival.bestWave],
      [BOTD.t('st_bank'), data.bank]
    ]);
    sec('st_lines', [
      [BOTD.t('st_lines_total'), T.lines],
      [BOTD.t('st_l1'), lc(1)], [BOTD.t('st_l2'), lc(2)], [BOTD.t('st_l3'), lc(3)], [BOTD.t('st_l4'), lc(4)],
      [BOTD.t('st_combo'), T.bestCombo ? 'x' + T.bestCombo : '—']
    ]);
    const kills = Object.keys(T.killsByType).sort((a, b) => T.killsByType[b] - T.killsByType[a]);
    sec('st_kills', [[BOTD.t('st_kills_total'), T.kills]].concat(
      kills.map(k => [BOTD.t('z_' + k), T.killsByType[k]])
    ));
  }

  function init(handler) {
    onCommand = handler;
    BOTD.applyI18n(document);
    document.querySelectorAll('[data-cmd]').forEach(el => {
      el.addEventListener('click', () => { fire(el.dataset.cmd, el.dataset.arg); el.blur(); });
    });
    document.querySelectorAll('[data-shop]').forEach(el => {
      const cost = el.querySelector('.cost');
      cost.innerHTML = '<img class="ico" alt="" src="' + BOTD.Assets.url('brain') + '">';
      cost.appendChild(document.createTextNode(C.SHOP[el.dataset.shop]));
      el.addEventListener('click', () => { fire('shop', el.dataset.shop); el.blur(); });
    });
    const fsOk = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    document.body.classList.toggle('no-fs', !fsOk);
    $('version').textContent = 'v' + BOTD.VERSION;
    initSettings();
    $('hold-box').addEventListener('click', () => fire('hold'));
    document.querySelectorAll('#diff-seg button').forEach(b => b.addEventListener('click', () => {
      BOTD.Audio.play('click');
      if (loadout) { loadout.difficulty = b.dataset.diff; markDiff(); }
    }));
  }

  function markDiff() {
    document.querySelectorAll('#diff-seg button').forEach(b => b.classList.toggle('selected', loadout && b.dataset.diff === loadout.difficulty));
  }

  // Se llama cuando las imágenes ya están cargadas
  function setReady(data, count) {
    buildHowto();
    buildPicker();
    $('btn-play').disabled = false;
    refreshMenu(data, count);
  }

  function pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  // Cerebros que vuelan desde el tablero hasta el contador
  function flyBrains(n, from) {
    const target = $('hud-brains');
    if (!from || !target) return;
    const tr = target.getBoundingClientRect();
    const count = Math.min(5, Math.max(1, Math.round(n / 8)));
    for (let i = 0; i < count; i++) {
      const el = document.createElement('img');
      el.src = BOTD.Assets.url('brain');
      el.className = 'fly-brain';
      const sx = from.x - 15 + (Math.random() - 0.5) * 30;
      const sy = from.y - 12 + (Math.random() - 0.5) * 20;
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      document.body.appendChild(el);
      const dx = tr.left + tr.width / 2 - 15 - sx;
      const dy = tr.top + tr.height / 2 - 12 - sy;
      setTimeout(() => { el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.7)'; el.style.opacity = '.3'; }, 30 + i * 70);
      setTimeout(() => { el.remove(); pop(target.parentElement); }, 760 + i * 70);
    }
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    $('screens').classList.toggle('show', !!name);
  }

  function refreshMenu(data, count) {
    const n = Math.min(data.unlocked, count);
    $('btn-play').textContent = n > 1 ? BOTD.t('continue_n', { n }) : BOTD.t('menu_play');
    const sv = $('btn-survival');
    const open = survivalOpen(data);
    sv.disabled = !open;
    sv.textContent = open ? BOTD.t('menu_survival') : '🔒 ' + BOTD.t('menu_survival');
    sv.title = open ? '' : BOTD.t('survival_locked');
    // Reto diario: regla de hoy, racha y récord del día
    const today = BOTD.Levels.todayKey();
    const daily = BOTD.Levels.makeDaily(today);
    const streak = BOTD.Progress.currentStreak(data, today);
    const best = data.daily.date === today ? data.daily.best : 0;
    let info = BOTD.t('rule_' + daily.rule);
    if (streak) info += ' · ' + BOTD.t('daily_streak', { n: streak });
    if (best) info += ' · ' + BOTD.t('daily_best', { n: best });
    $('daily-rule').textContent = info;
  }

  const survivalOpen = data => data.unlocked > 5;

  /* ---------- Cobertizo ---------- */
  function buildShed(data) {
    $('shed-bank').textContent = data.bank;
    const list = $('shed-list');
    list.innerHTML = '';
    const P = BOTD.Progress;
    P.UPGRADE_KEYS.forEach(k => {
      const row = document.createElement('div');
      row.className = 'shed-row';
      const info = document.createElement('div');
      info.className = 'shed-info';
      const b = document.createElement('b'); b.textContent = BOTD.t('up_' + k);
      const s = document.createElement('span'); s.textContent = BOTD.t('up_' + k + '_d');
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < P.maxLevel(k); i++) {
        const p = document.createElement('i');
        if (i < P.level(data, k)) p.className = 'on';
        pips.appendChild(p);
      }
      info.append(b, s, pips);
      const btn = document.createElement('button');
      btn.className = 'btn small shed-buy';
      const c = P.cost(data, k);
      if (c == null) {
        btn.textContent = BOTD.t('maxed');
        btn.disabled = true;
      } else {
        btn.innerHTML = '<img class="ico" alt="" src="' + BOTD.Assets.url('brain') + '">';
        btn.appendChild(document.createTextNode(c));
        btn.disabled = !P.canBuy(data, k);
        btn.addEventListener('click', () => fire('shed-buy', k));
      }
      row.append(info, btn);
      list.appendChild(row);
    });
  }

  /* ---------- Logros ---------- */
  function buildAchievements(data) {
    const list = BOTD.Progress.ACHIEVEMENTS;
    const got = list.filter(a => data.achievements[a.id]).length;
    $('ach-count').textContent = BOTD.t('ach_count', { n: got, t: list.length });
    const grid = $('ach-grid');
    grid.innerHTML = '';
    list.forEach(a => {
      const on = !!data.achievements[a.id];
      const d = document.createElement('div');
      d.className = 'ach' + (on ? ' on' : '');
      const m = document.createElement('div'); m.className = 'medal'; m.textContent = on ? '🏆' : '🔒';
      const txt = document.createElement('div');
      const b = document.createElement('b'); b.textContent = BOTD.t('ach_' + a.id);
      const s = document.createElement('span'); s.textContent = BOTD.t('ach_' + a.id + '_d');
      txt.append(b, s);
      d.append(m, txt);
      grid.appendChild(d);
    });
  }

  // Aviso animado (logro conseguido)
  function toast(title, text) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<div class="medal">🏆</div><div><small></small><b></b></div>';
    t.querySelector('small').textContent = title;
    t.querySelector('b').textContent = text;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  // Mapa de niveles agrupado por mundos
  function buildLevels(data, count, debug) {
    const list = $('level-list');
    list.innerHTML = '';
    BOTD.Levels.WORLDS.forEach((w, wi) => {
      const sec = document.createElement('section');
      sec.className = 'world world-' + (wi + 1);
      const h = document.createElement('h3');
      h.textContent = BOTD.t(w.nameKey);
      const path = document.createElement('div');
      path.className = 'world-path';
      w.levels.filter(i => i < count).forEach(i => {
        const lv = BOTD.Levels.get(i);
        const unlocked = debug || i < data.unlocked;
        const beaten = i + 1 < data.unlocked;
        const best = data.best[BOTD.Progress.recordKey(i + 1, data.settings.difficulty)];
        const b = document.createElement('button');
        b.className = 'level-node' + (beaten ? ' beaten' : '') + (unlocked && !beaten ? ' current' : '');
        b.disabled = !unlocked;
        b.innerHTML = '<span class="lv-num"></span><span class="lv-name"></span><span class="lv-best"></span>';
        b.querySelector('.lv-num').textContent = unlocked ? i + 1 : '🔒';
        b.querySelector('.lv-name').textContent = BOTD.t(lv.nameKey);
        b.querySelector('.lv-best').textContent = unlocked
          ? (best ? BOTD.t('best', { n: best }) : BOTD.t('no_best'))
          : BOTD.t('locked');
        b.addEventListener('click', () => fire('level', String(i)));
        path.appendChild(b);
      });
      sec.append(h, path);
      list.appendChild(sec);
    });
  }

  /* ---------- Elección de defensas antes del nivel ---------- */
  let loadout = null;   // { levelIndex, allowed: [], sel: { I: 'wall', ... } }

  // opts: { difficulty, daily (nivel del reto, sin selector de dificultad) }
  function openLoadout(levelIndex, allowed, current, opts) {
    opts = opts || {};
    loadout = { levelIndex, allowed: allowed.slice(), sel: Object.assign({}, current), difficulty: opts.difficulty || 'normal' };
    const lv = opts.daily || BOTD.Levels.get(levelIndex);
    const prefix = lv.daily ? '★' : levelIndex < 0 ? '∞' : levelIndex + 1;
    $('loadout-level').textContent = prefix + '. ' + BOTD.t(lv.nameKey);
    const rule = $('loadout-rule');
    rule.hidden = !lv.daily;
    if (lv.daily) rule.textContent = BOTD.t('rule_' + lv.rule) + ': ' + BOTD.t('rule_' + lv.rule + '_d');
    $('loadout-diff').hidden = !!lv.daily;   // el reto diario es igual para todos (normal)
    markDiff();
    renderLoadout();
    showScreen('loadout');
  }

  function renderLoadout() {
    const list = $('loadout-list');
    list.innerHTML = '';
    BOTD.Pieces.BAG.forEach(kind => {
      const row = document.createElement('div');
      row.className = 'lo-row';
      const prev = document.createElement('canvas');
      prev.width = 112; prev.height = 112;
      prev.className = 'lo-piece';
      BOTD.Render.drawPreview(prev, kind, loadout.sel[kind]);
      const info = document.createElement('div');
      info.className = 'lo-info';
      const b = document.createElement('b'); b.textContent = BOTD.t('piece_n', { k: kind });
      const s = document.createElement('span'); s.textContent = BOTD.t('def_' + loadout.sel[kind]);
      info.append(b, s);
      const opts = document.createElement('div');
      opts.className = 'lo-opts';
      loadout.allowed.forEach(type => {
        const o = document.createElement('button');
        o.className = 'lo-opt' + (loadout.sel[kind] === type ? ' selected' : '');
        o.title = BOTD.t('def_' + type);
        o.setAttribute('aria-label', BOTD.t('piece_n', { k: kind }) + ': ' + BOTD.t('def_' + type));
        const cv = document.createElement('canvas');
        cv.width = 88; cv.height = 88;
        BOTD.Render.drawIcon(cv, 'defense', type);
        o.appendChild(cv);
        o.addEventListener('click', () => {
          loadout.sel[kind] = type;
          BOTD.Audio.init();
          BOTD.Audio.play('click');
          renderLoadout();
        });
        opts.appendChild(o);
      });
      row.append(prev, info, opts);
      list.appendChild(row);
    });
  }

  function resetLoadout() {
    if (!loadout) return;
    loadout.sel = BOTD.Levels.loadoutFor({}, loadout.allowed);
    renderLoadout();
  }

  function getLoadout() { return loadout; }

  /* ---------- Almanaque ---------- */
  const ALM_DEF = ['wall', 'bunker', 'shooter', 'mine', 'slime', 'ice', 'cactus', 'sunflower', 'single', 'bomb', 'dirt', 'grave'];
  const ALM_ZOMB = ['basic', 'cone', 'runner', 'bucket', 'shield', 'digger', 'balloon', 'boss', 'boss2'];
  let almTab = 'def';

  function defenseStats(t) {
    const D = C.DEFENSES[t] || {};
    const out = [];
    if (t === 'bomb') { out.push(BOTD.t('stat_dmg', { n: C.BOMB.damage })); return out; }
    if (D.hp && t !== 'grave') out.push(BOTD.t('stat_hp', { n: D.gunHp || D.hp }));
    if (t === 'shooter' || t === 'ice') {
      out.push(BOTD.t('stat_dmg', { n: D.damage }));
      out.push(BOTD.t('stat_rate', { n: D.fireInterval }));
    }
    if (t === 'ice' || t === 'slime') out.push(BOTD.t('stat_slow', { n: Math.round((1 - D.slowFactor) * 100) }));
    if (t === 'mine') { out.push(BOTD.t('stat_dmg', { n: D.damage })); out.push(BOTD.t('stat_radius', { n: D.radius })); }
    if (t === 'cactus') out.push(BOTD.t('stat_thorns', { n: D.thorns }));
    if (t === 'sunflower') out.push(BOTD.t('stat_brains', { n: D.brains, s: D.interval }));
    return out;
  }

  function zombieStats(t) {
    const Z = C.ZOMBIES[t];
    const sp = Z.speed >= 0.6 ? 'speed_fast' : Z.speed >= 0.4 ? 'speed_mid' : 'speed_slow';
    const out = [BOTD.t('stat_hp', { n: Z.hp }), BOTD.t('stat_speed', { n: BOTD.t(sp) }), BOTD.t('stat_bite', { n: Z.bite })];
    if (Z.shield) out.push(BOTD.t('stat_shield', { n: Z.shield }));
    return out;
  }

  function buildAlmanac(data, tab) {
    if (tab) almTab = tab;
    document.querySelectorAll('[data-cmd="alm-tab"]').forEach(b => b.classList.toggle('selected', b.dataset.arg === almTab));
    const isDef = almTab === 'def';
    const types = isDef ? ALM_DEF : ALM_ZOMB;
    const seenMap = isDef ? data.almanac.defenses : data.almanac.zombies;
    const grid = $('alm-grid');
    grid.innerHTML = '';
    showAlmDetail(null);
    types.forEach(t => {
      const seen = !!seenMap[t];
      const b = document.createElement('button');
      b.className = 'alm-entry' + (seen ? '' : ' unknown');
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 120;
      BOTD.Render.drawIcon(cv, isDef ? 'defense' : 'zombie', t, !seen);
      const n = document.createElement('span');
      n.textContent = seen ? BOTD.t((isDef ? 'def_' : 'z_') + t) : BOTD.t('alm_unknown');
      b.append(cv, n);
      b.addEventListener('click', () => {
        BOTD.Audio.play('click');
        grid.querySelectorAll('.alm-entry').forEach(e => e.classList.remove('selected'));
        b.classList.add('selected');
        showAlmDetail({ isDef, t, seen });
      });
      grid.appendChild(b);
    });
  }

  function showAlmDetail(info) {
    const box = $('alm-detail');
    box.innerHTML = '';
    if (!info) {
      const p = document.createElement('p'); p.className = 'alm-hint'; p.textContent = BOTD.t('alm_pick');
      box.appendChild(p);
      return;
    }
    const cv = document.createElement('canvas');
    cv.width = 200; cv.height = 200;
    BOTD.Render.drawIcon(cv, info.isDef ? 'defense' : 'zombie', info.t, !info.seen);
    const txt = document.createElement('div');
    const h = document.createElement('h4');
    const p = document.createElement('p');
    if (info.seen) {
      const pre = info.isDef ? 'def_' : 'z_';
      h.textContent = BOTD.t(pre + info.t);
      p.textContent = BOTD.t(pre + info.t + '_d');
      txt.append(h, p);
      const ul = document.createElement('ul');
      (info.isDef ? defenseStats(info.t) : zombieStats(info.t)).forEach(s => {
        const li = document.createElement('li'); li.textContent = s; ul.appendChild(li);
      });
      txt.appendChild(ul);
      if (info.isDef) {
        const lvl = BOTD.Levels.unlockLevelOf(info.t);
        if (lvl) { const u = document.createElement('p'); u.className = 'alm-hint'; u.textContent = BOTD.t('unlock_after', { n: lvl }); txt.appendChild(u); }
      }
    } else {
      h.textContent = BOTD.t('alm_unknown');
      p.textContent = BOTD.t('alm_unknown_d');
      txt.append(h, p);
    }
    box.append(cv, txt);
  }

  // newDefense: defensa desbloqueada al ganar este nivel por primera vez (o null)
  // extra: { bankGain, bankTotal, survival: { wave, bestWave, newBest } }
  function showResult(result, g, newBest, hasNext, newDefense, extra) {
    extra = extra || {};
    const sv = extra.survival;
    const dl = extra.daily;
    const title = $('result-title');
    title.textContent = dl ? (result.won ? BOTD.t('daily_won') : BOTD.t('daily_over'))
      : sv ? BOTD.t('survival_over')
      : result.won ? (hasNext ? BOTD.t('win_title') : BOTD.t('final_win')) : BOTD.t('lose_title');
    title.className = result.won || sv ? 'win' : 'lose';
    const diffNote = g.difficulty !== 'normal' && !dl ? ' · ' + BOTD.t('diff_' + g.difficulty) : '';
    $('result-reason').textContent = (dl ? BOTD.t('daily_reason', { d: dl.dateLabel, r: BOTD.t('rule_' + g.level.rule) })
      : sv ? BOTD.t('survival_reached', { n: sv.wave })
      : result.won ? (g.levelIndex + 1) + '. ' + BOTD.t(g.level.nameKey)
      : BOTD.t(result.reason === 'top' ? 'lose_top' : 'lose_lives')) + diffNote;
    const s = $('result-stats');
    s.innerHTML = '';
    const lines = [BOTD.t('result_score', { n: g.score }), BOTD.t('result_lines', { n: g.lines }), BOTD.t('result_kills', { n: g.kills })];
    if (g.stats.maxCombo >= 2) lines.push(BOTD.t('result_combo', { n: g.stats.maxCombo }));
    if (result.won && result.rollersLeft) lines.push(BOTD.t('roller_bonus', { n: result.rollersLeft, p: result.rollerPoints }));
    if (sv) lines.push(BOTD.t('survival_best', { n: sv.bestWave }));
    if (dl) {
      lines.push(BOTD.t('daily_best', { n: dl.best }));
      lines.push(BOTD.t('daily_streak', { n: dl.streak }));
    }
    if (extra.bankGain) lines.push(BOTD.t('bank_gain', { n: extra.bankGain, t: extra.bankTotal }));
    lines.forEach(t => { const p = document.createElement('p'); p.textContent = t; s.appendChild(p); });
    if (newBest || (sv && sv.newBest) || (dl && dl.newBest)) { const p = document.createElement('p'); p.className = 'new-best'; p.textContent = BOTD.t('new_best'); s.appendChild(p); }

    // Tarjeta "¡Nueva defensa!"
    const card = $('new-defense');
    if (newDefense) {
      card.innerHTML = '';
      const h = document.createElement('div'); h.className = 'nd-title'; h.textContent = BOTD.t('new_defense');
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160;
      BOTD.Render.drawIcon(cv, 'defense', newDefense);
      const name = document.createElement('b'); name.textContent = BOTD.t('def_' + newDefense);
      const desc = document.createElement('span'); desc.textContent = BOTD.t('def_' + newDefense + '_d');
      card.append(h, cv, name, desc);
      card.style.display = '';
      BOTD.Audio.play('unlock');
    } else {
      card.style.display = 'none';
    }

    $('btn-next').style.display = result.won && hasNext ? '' : 'none';
    showScreen('result');
  }

  /* ---------- Bocadillo del tutorial ---------- */
  function showTip(text, n, total) {
    const tip = $('tip');
    tip.querySelector('.tip-step').textContent = BOTD.t('tut_step', { n, t: total });
    tip.querySelector('.tip-text').textContent = text;
    tip.classList.remove('hidden');
    pop(tip);
  }

  function hideTip() { $('tip').classList.add('hidden'); }

  function setText(id, v) {
    if (last[id] !== v) { last[id] = v; $(id).textContent = v; return true; }
    return false;
  }

  function updateHud(g) {
    if (!g) return;
    setText('hud-level', g.level.daily ? '★' : g.level.endless ? '∞' : String(g.levelIndex + 1));
    const holdKey = g.hold + '|' + g.holdUsed;
    if (last.hold !== holdKey) {
      last.hold = holdKey;
      const cv = $('hold');
      if (g.hold) BOTD.Render.drawPreview(cv, g.hold, BOTD.Game.typeOf(g, g.hold));
      else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      $('hold-box').classList.toggle('used', g.holdUsed);
    }
    setText('hud-wave', g.level.endless ? String(Math.max(0, g.waves.index + 1))
      : Math.max(0, g.waves.index + 1) + '/' + g.level.waves.length);
    setText('hud-lives', '❤'.repeat(Math.max(0, g.lives)) + '♡'.repeat(Math.max(0, C.LIVES - g.lives)));
    setText('hud-brains', String(g.brains));
    if (last.scoreN == null || g.score < last.scoreN || g.score - last.scoreN >= 50) {
      if (last.scoreN != null && g.score > last.scoreN) pop($('hud-score'));
      last.scoreN = g.score;
      setText('hud-score', String(g.score));
    }
    if (last.next !== g.next) { last.next = g.next; BOTD.Render.drawPreview($('next'), g.next, BOTD.Game.typeOf(g, g.next)); }
    const key = g.brains + '|' + g.nextBought + '|' + g.over + '|' + [...g.shopLocked].join(',');
    if (last.shop !== key) {
      last.shop = key;
      document.querySelectorAll('[data-shop]').forEach(el => {
        const locked = g.shopLocked.has(el.dataset.shop);
        el.classList.toggle('locked', locked);
        el.classList.toggle('off', !BOTD.Game.canAfford(g, el.dataset.shop));
        el.title = locked ? BOTD.t('shop_locked') : '';
      });
    }
  }

  function resetHud() { last = {}; }

  function updateToggles(settings) {
    const yn = v => (v ? BOTD.t('on') : BOTD.t('off'));
    document.querySelectorAll('.tg-sfx').forEach(el => { el.textContent = BOTD.t('sound') + ': ' + yn(settings.sfx); });
    document.querySelectorAll('.tg-music').forEach(el => { el.textContent = BOTD.t('music') + ': ' + yn(settings.music); });
    $('btn-sfx').textContent = settings.sfx ? '🔊' : '🔇';
    $('btn-sfx').classList.toggle('off', !settings.sfx);
    $('btn-music').classList.toggle('off', !settings.music);
  }

  function item(canvasDraw, name, desc) {
    const d = document.createElement('div');
    d.className = 'howto-item';
    const cv = document.createElement('canvas');
    cv.width = 112; cv.height = 112;
    canvasDraw(cv);
    const txt = document.createElement('div');
    const b = document.createElement('b'); b.textContent = name;
    const sp = document.createElement('span'); sp.textContent = desc;
    txt.append(b, sp);
    d.append(cv, txt);
    return d;
  }

  function section(root, titleKey) {
    const h = document.createElement('h3');
    h.textContent = BOTD.t(titleKey);
    root.appendChild(h);
  }

  function para(root, key) {
    const p = document.createElement('p');
    p.textContent = BOTD.t(key);
    root.appendChild(p);
  }

  function buildHowto() {
    const root = $('howto-body');
    root.innerHTML = '';
    section(root, 'howto_goal_title');
    para(root, 'howto_goal');

    section(root, 'howto_def_title');
    const defs = document.createElement('div');
    defs.className = 'howto-list';
    ['wall', 'bunker', 'shooter', 'mine', 'slime', 'single', 'bomb', 'dirt'].forEach(t => {
      const lvl = BOTD.Levels.unlockLevelOf(t);
      const desc = BOTD.t('def_' + t + '_d') + (lvl ? ' ' + BOTD.t('unlock_after', { n: lvl }) : '');
      defs.appendChild(item(cv => BOTD.Render.drawIcon(cv, 'defense', t), BOTD.t('def_' + t), desc));
    });
    root.appendChild(defs);

    section(root, 'howto_roller_title');
    para(root, 'howto_roller');

    section(root, 'howto_zomb_title');
    const zs = document.createElement('div');
    zs.className = 'howto-list';
    ['basic', 'cone', 'runner', 'boss'].forEach(t => {
      zs.appendChild(item(cv => BOTD.Render.drawIcon(cv, 'zombie', t), BOTD.t('z_' + t), BOTD.t('z_' + t + '_d')));
    });
    root.appendChild(zs);

    para(root, 'howto_more');

    section(root, 'howto_ctrl_title');
    para(root, 'ctrl_keys');
    root.appendChild(document.createElement('br'));
    para(root, 'ctrl_touch');
  }

  // Se reconstruye al abrirlo para mostrar la defensa real de cada pieza en esta partida
  function buildPicker(g) {
    const grid = $('picker-grid');
    grid.innerHTML = '';
    BOTD.Pieces.BAG.forEach(kind => {
      const type = g ? BOTD.Game.typeOf(g, kind) : BOTD.Pieces.TYPE[kind];
      const b = document.createElement('button');
      b.className = 'btn picker-btn';
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 160;
      BOTD.Render.drawPreview(cv, kind, type);
      const label = document.createElement('span');
      label.textContent = BOTD.t('def_' + type);
      b.append(cv, label);
      b.addEventListener('click', () => fire('pick', kind));
      grid.appendChild(b);
    });
  }

  return {
    init, setReady, showScreen, refreshMenu, buildLevels, showResult, updateHud, resetHud,
    updateToggles, flyBrains, buildPicker, showTip, hideTip,
    openLoadout, resetLoadout, getLoadout, buildAlmanac,
    buildShed, buildAchievements, toast,
    updateSettings, getSaveCode, setSaveCode, setSaveMsg, buildStats
  };
})();
