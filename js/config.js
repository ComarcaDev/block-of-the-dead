/* Block of the Dead — constantes y valores de equilibrio.
   Cambia aquí la dificultad sin tocar la lógica. */
window.BOTD = window.BOTD || {};

BOTD.CONFIG = {
  COLS: 16,          // columnas del campo (sin contar la casa)
  BUILD_COLS: 10,    // columnas donde caen piezas (zona de construcción)
  ROWS: 12,          // carriles visibles
  HIDDEN_ROWS: 2,    // filas superiores donde nacen las piezas
  CELL: 48,          // píxeles por celda en el lienzo lógico

  LIVES: 3,
  START_BRAINS: 0,

  LOCK_DELAY: 0.45,       // segundos que una pieza apoyada tarda en fijarse
  SOFT_DROP_FACTOR: 14,   // multiplicador de velocidad al bajar rápido
  DAS: 0.16,              // retardo antes de repetir movimiento lateral
  ARR: 0.05,              // intervalo de repetición lateral
  WAVE_BREAK: 5,          // segundos de descanso entre oleadas

  DEFENSES: {
    wall:    { hp: 320 },
    bunker:  { hp: 650 },
    shooter: { hp: 110, gunHp: 150, fireInterval: 0.75, damage: 22, peaSpeed: 7 },
    mine:    { hp: 60, damage: 230, radius: 1.6 },
    slime:   { hp: 170, slowFactor: 0.45, slowTime: 2.5 },
    single:  { hp: 260 },
    dirt:    { hp: 120 },  // pieza cuya defensa aún no está desbloqueada
    ice:     { hp: 110, gunHp: 150, fireInterval: 0.95, damage: 16, peaSpeed: 7, slowFactor: 0.5, slowTime: 2.5 },
    cactus:  { hp: 230, thorns: 16 },             // daño a quien lo muerde
    sunflower: { hp: 100, gunHp: 130, interval: 9, brains: 5 },
    grave:   { hp: 1 }     // lápida: no se rompe a mordiscos; solo con línea o bomba
  },

  ZOMBIES: {
    basic:  { hp: 110,  speed: 0.32, bite: 22, biteRate: 1.0, brains: 3,  score: 10 },
    cone:   { hp: 280,  speed: 0.30, bite: 22, biteRate: 1.0, brains: 5,  score: 20 },
    runner: { hp: 95,   speed: 0.85, bite: 18, biteRate: 1.3, brains: 4,  score: 15, jumps: true },
    boss:   { hp: 2600, speed: 0.16, bite: 60, biteRate: 0.8, brains: 60, score: 500, smashEvery: 5 },
    bucket: { hp: 560,  speed: 0.29, bite: 22, biteRate: 1.0, brains: 7,  score: 30 },
    shield: { hp: 140,  shield: 420, speed: 0.28, bite: 22, biteRate: 1.0, brains: 7, score: 30 },
    digger: { hp: 150,  speed: 0.5, underSpeed: 0.8, bite: 24, biteRate: 1.1, brains: 6, score: 25, digs: true },
    balloon: { hp: 130, speed: 0.5, bite: 20, biteRate: 1.0, brains: 6, score: 25, flies: true },
    boss2:  { hp: 4200, speed: 0.17, bite: 70, biteRate: 0.9, brains: 100, score: 1000, smashEvery: 4 }
  },

  LINES: {
    brains: [0, 10, 25, 45, 70],
    score:  [0, 100, 300, 500, 800],
    laneDamage: 220,     // daño a zombies del carril de la línea
    splashDamage: 90     // daño a zombies de carriles vecinos
  },

  BOMB: { damage: 320 },

  SHOP: { choose: 25, single: 15, bomb: 40 },

  // Dificultad: multiplicadores sobre los valores normales
  //   fall: tiempo de caída de las piezas (más alto = más lento) · zombieHp / zombieSpeed · brains: cerebros ganados
  DIFFICULTY: {
    easy:   { fall: 1.25, zombieHp: 0.75, zombieSpeed: 0.85, brains: 1.25 },
    normal: { fall: 1,    zombieHp: 1,    zombieSpeed: 1,    brains: 1 },
    hard:   { fall: 0.8,  zombieHp: 1.3,  zombieSpeed: 1.12, brains: 0.85 }
  },

  // Reto diario: oleadas que se generan para cada fecha
  DAILY: { waves: 4, baseCount: 6, countPerWave: 2, intervalStart: 5, intervalPerWave: 0.5 },

  // Combos: cada pieza seguida que completa línea multiplica los cerebros por (1 + COMBO_STEP × (combo − 1))
  COMBO_STEP: 0.5,

  // Cobertizo: mejoras permanentes (coste de cada nivel y efecto por nivel)
  UPGRADES: {
    peaDamage:   { costs: [40, 80, 140, 220, 320], step: 0.10 },  // +10 % daño de guisantes
    wallHp:      { costs: [40, 80, 140, 220, 320], step: 0.15 },  // +15 % vida de muro y búnker
    mineRadius:  { costs: [60, 140, 260], step: 0.4 },            // + alcance de las minas (casillas)
    startBrains: { costs: [30, 60, 100, 150, 220], step: 10 },    // + cerebros al empezar
    extraLife:   { costs: [300], step: 1 },                       // + 1 vida
    spareRoller: { costs: [250], step: 1 }                        // rodillo de reserva
  },

  // Modo supervivencia: oleadas infinitas cada vez más difíciles
  SURVIVAL: {
    lanes: 12, startDelay: 10,
    baseCount: 5, countPerWave: 2,
    hpPerWave: 0.12, speedPerWave: 0.02, maxSpeedMul: 1.5,
    fallStart: 0.75, fallPerWave: 0.02, fallMin: 0.38,
    intervalStart: 5, intervalPerWave: 0.25, intervalMin: 1.6,
    bigEvery: 5, bossEvery: 10
  },

  // Máximo de efectos simultáneos (si se supera, se descartan los más antiguos)
  FX_LIMITS: { particles: 300, puffs: 80, words: 8, texts: 30, projectiles: 200, debris: 20, corpses: 20 },

  // Rendimiento: si la media de un fotograma supera SLOW_FRAME_MS durante SLOW_SECONDS, baja la calidad
  PERF: { SLOW_FRAME_MS: 22, SLOW_SECONDS: 3, DPR_MAX: 2.5, DPR_MAX_MOBILE: 2, DPR_MAX_LOW: 1.5 },

  MAX_CONSECUTIVE_ERRORS: 5
};

// Versión del juego (se muestra en el menú y se usa en las copias exportadas)
BOTD.VERSION = '1.3.0';

// Estado de calidad en tiempo de ejecución (lo cambia main.js si el equipo va lento o según los ajustes)
BOTD.Quality = { low: false };

// Preferencias visuales en tiempo de ejecución (las fija main.js desde los ajustes)
BOTD.Prefs = { shake: true, colorblind: false, textScale: 1, reduceMotion: false };
