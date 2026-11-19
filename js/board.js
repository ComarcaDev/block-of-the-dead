/* Rejilla de la zona de construcción: colisiones, celdas-defensa y líneas. */
window.BOTD = window.BOTD || {};

BOTD.Board = (() => {
  const C = BOTD.CONFIG;
  const H = C.ROWS + C.HIDDEN_ROWS;
  const W = C.BUILD_COLS;

  function create() {
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill(null));
    return g;
  }

  function collides(grid, piece, dx = 0, dy = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = piece.x + x + dx;
        const ny = piece.y + y + dy;
        if (nx < 0 || nx >= W || ny >= H) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  // pieceId y color sirven para dibujar el contorno de cada pieza colocada
  function makeCell(type, gun, pieceId, color) {
    const D = C.DEFENSES;
    let hp = (D[type] || D.wall).hp;
    if (gun && D[type] && D[type].gunHp) hp = D[type].gunHp;
    let cd = 0.3 + Math.random() * 0.4;
    if (type === 'sunflower') cd = D.sunflower.interval * 0.6;   // primer cerebro algo antes
    return {
      type, gun: !!gun, hp, maxHp: hp,
      cd, flash: 0, recoil: 0, hitT: 0,
      pieceId: pieceId == null ? -1 : pieceId,
      color: color === undefined ? '#ffffff' : color   // null = sin contorno (lápidas)
    };
  }

  function fullRows(grid) {
    const rows = [];
    for (let y = C.HIDDEN_ROWS; y < H; y++) if (grid[y].every(c => c)) rows.push(y);
    return rows;
  }

  // Quita filas (de arriba a abajo) y hace bajar todo lo que hay encima
  function removeRows(grid, rows) {
    rows.slice().sort((a, b) => a - b).forEach(r => {
      grid.splice(r, 1);
      grid.unshift(new Array(W).fill(null));
    });
  }

  return { H, W, create, collides, makeCell, fullRows, removeRows };
})();
