/* Tetrominós, rotación y bolsa de 7.
   El valor 2 marca el "bloque activo" de cada pieza: el que dispara (lanzaguisantes, hielo)
   o genera cerebros (girasol). Así cualquier pieza puede llevar cualquier defensa. */
window.BOTD = window.BOTD || {};

BOTD.Pieces = (() => {
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 2, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 2]],
    T: [[0, 1, 0], [1, 2, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 2, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 2, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 2, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 2, 1], [0, 0, 0]],
    U: [[1]],   // bloque 1x1 (tienda)
    B: [[1]]    // megabomba (tienda)
  };

  const TYPE = { I: 'wall', O: 'bunker', T: 'shooter', L: 'mine', J: 'mine', S: 'slime', Z: 'slime', U: 'single', B: 'bomb' };
  const BAG = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

  // Color del contorno de cada pieza
  const COLORS = {
    I: '#4fc3ff', O: '#ffd23f', T: '#7be35a', L: '#ff9a3c', J: '#4f7dff',
    S: '#c46bff', Z: '#ff5a7a', U: '#e8e8e8', B: '#ff3b2e'
  };

  // Desplazamientos que se prueban al girar para que la pieza quepa
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];

  function rotateCW(m) {
    const n = m.length;
    const r = [];
    for (let y = 0; y < n; y++) {
      r.push([]);
      for (let x = 0; x < n; x++) r[y][x] = m[n - 1 - x][y];
    }
    return r;
  }

  function rotateCCW(m) {
    return rotateCW(rotateCW(rotateCW(m)));
  }

  function create(kind) {
    return { kind, matrix: SHAPES[kind].map(r => r.slice()), x: 0, y: 0 };
  }

  function makeBag() {
    const b = BAG.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  return { SHAPES, TYPE, BAG, COLORS, KICKS, rotateCW, rotateCCW, create, makeBag };
})();
