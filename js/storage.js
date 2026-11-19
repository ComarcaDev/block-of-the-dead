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
      settings: { sfx: true, music: true },
      // Campos preparados para las próximas fases
      loadout: {},                         // defensa elegida para cada pieza
      upgrades: {},                        // mejoras permanentes compradas
      bank: 0,                             // cerebros guardados para el cobertizo
      achievements: {},                    // logros conseguidos
      almanac: { defenses: {}, zombies: {} },
      tutorialDone: false,
      survival: { bestWave: 0, bestScore: 0 },
      totals: { kills: 0, lines: 0 }       // estadísticas acumuladas (para logros)
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
      out.settings.sfx = bool(d.settings.sfx, true);
      out.settings.music = bool(d.settings.music, true);
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
      out.totals.kills = Math.round(num(d.totals.kills, 0, 0, 1e9));
      out.totals.lines = Math.round(num(d.totals.lines, 0, 0, 1e9));
    }
    return out;
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
    get data() { return data; }
  };
})();
