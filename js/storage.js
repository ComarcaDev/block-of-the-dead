/* Guardado del progreso en localStorage, con versión, validación y copia de seguridad.
   - botd_save_v2 : guardado actual
   - botd_save_bak: copia del guardado anterior (se usa si el actual está dañado)
   - botd_save_v1 : formato antiguo; se migra automáticamente */
window.BOTD = window.BOTD || {};

BOTD.Storage = (() => {
  const VERSION = 2;
  let prefix = 'botd_';
  const keys = () => ({ main: prefix + 'save_v2', bak: prefix + 'save_bak', old: prefix + 'save_v1' });

  function defaults() {
    return {
      v: VERSION,
      unlocked: 1,
      best: {},
      settings: {
        sfx: true, music: true,            // sonido y música activados
        sfxVol: 0.8, musicVol: 0.8,        // volúmenes (0–1)
        quality: 'auto',                   // 'auto' | 'high' | 'low'
        shake: true,                       // sacudidas de pantalla
        showFps: false                     // contador de FPS
      },
      loadout: {},                         // defensa elegida para cada pieza
      upgrades: {},                        // mejoras permanentes compradas
      bank: 0,                             // cerebros guardados para el cobertizo
      achievements: {},                    // logros conseguidos
      almanac: { defenses: {}, zombies: {} },
      tutorialDone: false,
      survival: { bestWave: 0, bestScore: 0 },
      // Estadísticas acumuladas (logros y pantalla de estadísticas)
      totals: {
        kills: 0, lines: 0, playTime: 0, games: 0, wins: 0, bestCombo: 0,
        linesByCount: {},                  // { '1': sencillas, '2': dobles, '3': triples, '4': cuádruples }
        killsByType: {}                    // { basic: n, cone: n, ... }
      }
    };
  }

  let data = defaults();

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, def, min, max) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);
  const numMap = v => {
    const out = {};
    if (isObj(v)) for (const k in v) if (typeof v[k] === 'number' && isFinite(v[k])) out[k] = v[k];
    return out;
  };
  const boolMap = v => {
    const out = {};
    if (isObj(v)) for (const k in v) if (v[k]) out[k] = true;
    return out;
  };
  const strMap = v => {
    const out = {};
    if (isObj(v)) for (const k in v) if (typeof v[k] === 'string') out[k] = v[k];
    return out;
  };

  // Devuelve un guardado válido a partir de cualquier objeto (descarta lo que no encaje)
  function sanitize(d) {
    const out = defaults();
    if (!isObj(d)) return out;
    out.unlocked = Math.round(num(d.unlocked, 1, 1, 99));
    out.best = numMap(d.best);
    if (isObj(d.settings)) {
      const s = d.settings;
      out.settings.sfx = bool(s.sfx, true);
      out.settings.music = bool(s.music, true);
      out.settings.sfxVol = num(s.sfxVol, 0.8, 0, 1);
      out.settings.musicVol = num(s.musicVol, 0.8, 0, 1);
      out.settings.quality = ['auto', 'high', 'low'].includes(s.quality) ? s.quality : 'auto';
      out.settings.shake = bool(s.shake, true);
      out.settings.showFps = bool(s.showFps, false);
    }
    out.loadout = strMap(d.loadout);
    out.upgrades = numMap(d.upgrades);
    out.bank = Math.round(num(d.bank, 0, 0, 1e9));
    out.achievements = boolMap(d.achievements);
    if (isObj(d.almanac)) {
      out.almanac.defenses = boolMap(d.almanac.defenses);
      out.almanac.zombies = boolMap(d.almanac.zombies);
    }
    out.tutorialDone = bool(d.tutorialDone, false);
    if (isObj(d.survival)) {
      out.survival.bestWave = Math.round(num(d.survival.bestWave, 0, 0, 1e6));
      out.survival.bestScore = Math.round(num(d.survival.bestScore, 0, 0, 1e12));
    }
    if (isObj(d.totals)) {
      const t = d.totals;
      out.totals.kills = Math.round(num(t.kills, 0, 0, 1e9));
      out.totals.lines = Math.round(num(t.lines, 0, 0, 1e9));
      out.totals.playTime = num(t.playTime, 0, 0, 1e9);
      out.totals.games = Math.round(num(t.games, 0, 0, 1e9));
      out.totals.wins = Math.round(num(t.wins, 0, 0, 1e9));
      out.totals.bestCombo = Math.round(num(t.bestCombo, 0, 0, 1e6));
      out.totals.linesByCount = numMap(t.linesByCount);
      out.totals.killsByType = numMap(t.killsByType);
    }
    return out;
  }

  /* ---------- Exportar / importar partida ----------
     Código: 'BOTD1:' + base64( JSON { p: { app, version, data }, h: hash(p) } ) */
  const CODE_PREFIX = 'BOTD1:';

  // Hash FNV-1a de 32 bits (comprobación de integridad, no seguridad)
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // Contenido del archivo exportado (JSON legible con comprobación de integridad)
  function exportJson(d) {
    const p = JSON.stringify({ app: 'block-of-the-dead', version: BOTD.VERSION, exported: new Date().toISOString(), data: d || data });
    return JSON.stringify({ p, h: hash(p) });
  }

  // Código corto para copiar y pegar
  function exportCode(d) {
    return CODE_PREFIX + toBase64(exportJson(d));
  }

  // Acepta el código o el contenido del archivo exportado.
  // Devuelve { ok: true, data } o { ok: false, error: 'clave de texto' }. No modifica nada.
  function importCode(text) {
    try {
      let s = String(text || '').trim();
      if (s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length);
      const wrapper = JSON.parse(s.startsWith('{') ? s : fromBase64(s.replace(/\s+/g, '')));
      if (!isObj(wrapper) || typeof wrapper.p !== 'string') return { ok: false, error: 'import_bad' };
      if (hash(wrapper.p) !== wrapper.h) return { ok: false, error: 'import_corrupt' };
      const p = JSON.parse(wrapper.p);
      if (!isObj(p) || p.app !== 'block-of-the-dead' || !isObj(p.data)) return { ok: false, error: 'import_bad' };
      return { ok: true, data: sanitize(p.data), version: p.version };
    } catch (e) {
      return { ok: false, error: 'import_bad' };
    }
  }

  // Sustituye el progreso por uno importado (ya validado)
  function replace(d) {
    data = sanitize(d);
    save();
  }

  // Formato v1: { unlocked, best, settings } → se conserva el progreso
  function migrateV1(d) {
    const out = sanitize(d);
    // Quien ya avanzó niveles no necesita el tutorial
    if (out.unlocked > 1) out.tutorialDone = true;
    return out;
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return isObj(d) ? d : null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    const k = keys();
    let d = read(k.main);
    if (d && d.v === VERSION) {
      data = sanitize(d);
    } else if ((d = read(k.bak)) && d.v === VERSION) {
      console.warn('[Block of the Dead] Guardado dañado: se usa la copia de seguridad.');
      data = sanitize(d);
      save();
    } else if ((d = read(k.old))) {
      data = migrateV1(d);
      save();
    } else {
      data = defaults();
    }
    return data;
  }

  function save() {
    const k = keys();
    try {
      const prev = read(k.main);
      if (prev && prev.v === VERSION) localStorage.setItem(k.bak, JSON.stringify(prev));   // solo copias válidas
      localStorage.setItem(k.main, JSON.stringify(data));
    } catch (e) { /* sin almacenamiento: se juega igual */ }
  }

  function unlock(n) {
    if (n > data.unlocked) { data.unlocked = n; save(); }
  }

  function setBest(level, score) {
    if (!data.best[level] || score > data.best[level]) { data.best[level] = score; save(); return true; }
    return false;
  }

  // Solo para las pruebas automáticas: usar otras claves para no tocar la partida real
  function setPrefix(p) { prefix = p; data = defaults(); }

  return {
    VERSION, load, save, unlock, setBest, sanitize, setPrefix, keys,
    exportCode, exportJson, importCode, replace, hash,
    get data() { return data; }
  };
})();
