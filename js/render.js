/* Dibujo del juego en estilo cartoon: imágenes SVG (assets/svg) + efectos dibujados con código.
   Se trabaja en "unidades lógicas" (1 celda = CELL) y se escala a la resolución real de la pantalla. */
window.BOTD = window.BOTD || {};

BOTD.Render = (() => {
  const C = BOTD.CONFIG;
  const A = BOTD.Assets;
  const CELL = C.CELL;
  const H = C.ROWS + C.HIDDEN_ROWS;
  const OX = CELL;                                   // la casa ocupa la primera columna
  const SKY = 0.6;                                   // celdas de cielo visibles
  const VIEW_TOP = (C.HIDDEN_ROWS - SKY) * CELL;     // y lógica del borde superior visible
  const LW = (C.COLS + 1) * CELL;                    // ancho lógico del lienzo
  const LH = (C.ROWS + SKY) * CELL;                  // alto lógico del lienzo
  const FONT = '"Lilita One", "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  const INK = '#2b1a0e';

  let ctx = null;
  let S = 1;        // píxeles reales por unidad lógica
  let curS = 1;     // escala usada para rasterizar las imágenes

  const AMB = {
    day: {
      sky: ['#6ec3ff', '#c4ecff'], hills: '#4f9a3a',
      grassA: '#74c94f', grassB: '#66bb44', tuft: '#4f9a35',
      dirtA: '#c99d64', dirtB: '#bb8f57', pebble: 'rgba(90,60,30,0.25)',
      fog: 'rgba(25,55,20,0.42)', tint: null
    },
    sunset: {
      sky: ['#ff8a5c', '#ffd28a'], hills: '#5c7a36',
      grassA: '#86b84a', grassB: '#78a940', tuft: '#5d8a30',
      dirtA: '#c48a5a', dirtB: '#b47c4e', pebble: 'rgba(90,40,20,0.25)',
      fog: 'rgba(70,25,45,0.48)', tint: 'rgba(255,110,40,0.14)'
    },
    night: {
      sky: ['#0d1440', '#2f2d72'], hills: '#1f3d2a',
      grassA: '#3f7d4a', grassB: '#37703f', tuft: '#2a5a34',
      dirtA: '#6b5a52', dirtB: '#5f4f48', pebble: 'rgba(0,0,0,0.25)',
      fog: 'rgba(5,6,28,0.58)', tint: 'rgba(15,25,85,0.28)'
    },
    graveyard: {
      sky: ['#120a2a', '#3b2558'], hills: '#241a33',
      grassA: '#3d6644', grassB: '#355c3c', tuft: '#26472d',
      dirtA: '#55473f', dirtB: '#4b3f38', pebble: 'rgba(0,0,0,0.3)',
      fog: 'rgba(12,6,30,0.6)', tint: 'rgba(60,20,90,0.26)', tombs: 14
    }
  };

  /* ---------- Utilidades ---------- */
  function img(c, name, x, y, w, h, variant) {
    c.drawImage(A.bitmap(name, w * curS, h * curS, variant), x, y, w, h);
  }

  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function easeOutBack(t) {
    if (BOTD.Prefs.reduceMotion) return 1;   // sin rebotes
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  function outlinedText(c, text, x, y, size, fill, stroke) {
    size = Math.round(size * (BOTD.Prefs.textScale || 1));
    c.font = size + 'px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.22);
    c.strokeStyle = stroke || INK;
    c.strokeText(text, x, y);
    c.fillStyle = fill;
    c.fillText(text, x, y);
  }

  /* ---------- Fondo estático (en caché por ambiente, carriles y escala) ---------- */
  let bgCache = {};

  function drawHouse(c, first) {
    const top = C.HIDDEN_ROWS * CELL;
    // Tejado (asoma en la franja de cielo)
    c.fillStyle = '#c0533a';
    c.strokeStyle = '#3b1a10';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-6, top + 2); c.lineTo(CELL / 2, top - 46); c.lineTo(CELL + 10, top + 2); c.closePath();
    c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 2;
    for (let y = top - 30; y < top; y += 9) {
      const half = ((y - (top - 46)) / 46) * (CELL / 2 + 8);
      c.beginPath(); c.moveTo(CELL / 2 - half, y); c.lineTo(CELL / 2 + half, y); c.stroke();
    }
    for (let r = C.HIDDEN_ROWS; r < H; r++) {
      const y = r * CELL;
      img(c, 'house', 0, y, CELL, CELL);
      if (r >= first) {
        // Ventana iluminada en los carriles activos
        c.fillStyle = 'rgba(255,214,90,0.9)';
        c.fillRect(CELL * 0.3, y + CELL * 0.26, CELL * 0.4, CELL * 0.42);
        c.fillStyle = '#fff';
        c.fillRect(CELL * 0.5 - 1, y + CELL * 0.26, 2, CELL * 0.42);
        c.fillRect(CELL * 0.3, y + CELL * 0.47 - 1, CELL * 0.4, 2);
      }
    }
    // Sombra de la casa sobre el césped
    const grd = c.createLinearGradient(CELL, 0, CELL + 14, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grd;
    c.fillRect(CELL, top, 14, C.ROWS * CELL);
  }

  function background(amb, lanes) {
    const key = amb + '|' + lanes;
    if (bgCache[key]) return bgCache[key];
    const P = AMB[amb] || AMB.day;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(LW * S));
    cv.height = Math.max(1, Math.round(LH * S));
    const c = cv.getContext('2d');
    c.setTransform(S, 0, 0, S, 0, -VIEW_TOP * S);
    const prev = curS; curS = S;
    const rand = rng(4242);
    const skyTop = VIEW_TOP, skyBot = C.HIDDEN_ROWS * CELL;
    const first = H - lanes;

    // Cielo y colinas lejanas
    const sg = c.createLinearGradient(0, skyTop, 0, skyBot);
    sg.addColorStop(0, P.sky[0]); sg.addColorStop(1, P.sky[1]);
    c.fillStyle = sg;
    c.fillRect(0, skyTop, LW, skyBot - skyTop);
    c.fillStyle = P.hills;
    c.beginPath();
    c.moveTo(0, skyBot);
    for (let x = 0; x <= LW + 30; x += 30) c.quadraticCurveTo(x + 15, skyBot - 12 - (x % 90 === 0 ? 6 : 0), x + 30, skyBot);
    c.fill();

    // Césped (franjas cortadas) y tierra en la zona de aparición
    for (let r = C.HIDDEN_ROWS; r < H; r++) {
      for (let col = 0; col < C.COLS; col++) {
        const build = col < C.BUILD_COLS;
        const px = OX + col * CELL, py = r * CELL;
        c.fillStyle = build ? (col % 2 ? P.grassA : P.grassB) : ((col + r) % 2 ? P.dirtA : P.dirtB);
        c.fillRect(px, py, CELL + 0.5, CELL + 0.5);
        if (build && r % 2) { c.fillStyle = 'rgba(0,0,0,0.035)'; c.fillRect(px, py, CELL, CELL); }
      }
    }
    // Matas de hierba
    c.strokeStyle = P.tuft;
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = OX + 6 + rand() * (C.BUILD_COLS * CELL - 12);
      const y = skyBot + 8 + rand() * (C.ROWS * CELL - 10);
      c.beginPath();
      c.moveTo(x - 4, y); c.lineTo(x - 2, y - 6);
      c.moveTo(x, y); c.lineTo(x + 1, y - 8);
      c.moveTo(x + 4, y); c.lineTo(x + 5, y - 5);
      c.stroke();
    }
    // Florecillas
    for (let i = 0; i < 16; i++) {
      const x = OX + 8 + rand() * (C.BUILD_COLS * CELL - 16);
      const y = skyBot + 8 + rand() * (C.ROWS * CELL - 16);
      c.fillStyle = rand() > 0.5 ? '#fff6d6' : '#ffd84a';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.57) * 2.5, y + Math.sin(k * 1.57) * 2.5, 2, 0, 7); c.fill(); }
      c.fillStyle = '#f08a24'; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill();
    }
    // Piedrecitas en la tierra
    const zx = OX + C.BUILD_COLS * CELL;
    c.fillStyle = P.pebble;
    for (let i = 0; i < 70; i++) {
      c.beginPath();
      c.ellipse(zx + rand() * (C.COLS - C.BUILD_COLS) * CELL, skyBot + rand() * C.ROWS * CELL, 2 + rand() * 3, 1.5 + rand() * 2, 0, 0, 7);
      c.fill();
    }
    // Borde ondulado entre césped y tierra
    c.fillStyle = P.grassB;
    for (let y = skyBot; y < H * CELL; y += 12) { c.beginPath(); c.arc(zx, y + 6, 6, -Math.PI / 2, Math.PI / 2); c.fill(); }
    // Lápidas
    for (let i = 0; i < (P.tombs || 7); i++) {
      const col = C.BUILD_COLS + 1 + Math.floor(rand() * (C.COLS - C.BUILD_COLS - 1));
      const row = C.HIDDEN_ROWS + Math.floor(rand() * C.ROWS);
      img(c, 'tombstone', OX + col * CELL + 8 + rand() * 8, row * CELL + 4, 27, 36);
    }
    // Carriles inactivos con niebla
    if (first > C.HIDDEN_ROWS) {
      c.fillStyle = P.fog;
      c.fillRect(OX, skyBot, LW - OX, (first - C.HIDDEN_ROWS) * CELL);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(OX, first * CELL - 3, LW - OX, 3);
    }
    drawHouse(c, first);
    if (P.tint) { c.fillStyle = P.tint; c.fillRect(0, skyTop, LW, LH); }
    // Línea del techo
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.setLineDash([8, 6]);
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(OX, skyBot); c.lineTo(OX + C.BUILD_COLS * CELL, skyBot); c.stroke();
    c.setLineDash([]);

    curS = prev;
    bgCache[key] = cv;
    return cv;
  }

  /* ---------- Efectos de ambiente animados ---------- */
  function ambientFx(c, amb, t) {
    if (BOTD.Quality.low) return;   // calidad baja: sin animaciones de ambiente
    if (amb === 'graveyard') amb = 'night';
    const skyTop = VIEW_TOP, skyBot = C.HIDDEN_ROWS * CELL;
    c.save();
    c.beginPath(); c.rect(0, skyTop, LW, skyBot - skyTop); c.clip();
    if (amb === 'day') {
      const sx = LW - 70, sy = skyTop + 10;
      c.fillStyle = 'rgba(255,240,150,0.5)';
      for (let i = 0; i < 10; i++) {
        const a = t * 0.3 + i * Math.PI / 5;
        c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, 40, a, a + 0.18); c.fill();
      }
      c.fillStyle = '#ffd84a'; c.strokeStyle = '#f2a71b'; c.lineWidth = 3;
      c.beginPath(); c.arc(sx, sy, 20, 0, 7); c.fill(); c.stroke();
      for (let i = 0; i < 3; i++) {
        const x = ((t * (10 + i * 4) + i * 300) % (LW + 160)) - 80;
        img(c, 'cloud', x, skyTop - 4 + i * 3, 70, 34);
      }
    } else if (amb === 'sunset') {
      c.fillStyle = '#ff7a3a'; c.strokeStyle = '#d4462a'; c.lineWidth = 3;
      c.beginPath(); c.arc(LW - 130, skyBot + 6, 30, 0, 7); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#f5f1cf'; c.strokeStyle = '#c9c39a'; c.lineWidth = 2;
      c.beginPath(); c.arc(LW - 70, skyTop + 14, 15, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#d9d4a8';
      c.beginPath(); c.arc(LW - 75, skyTop + 11, 3, 0, 7); c.fill();
      c.beginPath(); c.arc(LW - 64, skyTop + 19, 2.5, 0, 7); c.fill();
      for (let i = 0; i < 26; i++) {
        c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + i * 1.7));
        c.fillStyle = '#fff';
        c.fillRect((i * 97) % (LW - 120) + 60, skyTop + 3 + (i * 37) % 22, 2, 2);
      }
      c.globalAlpha = 1;
    }
    c.restore();

    // Sobre el césped
    const top = C.HIDDEN_ROWS * CELL;
    if (amb === 'day') {
      c.fillStyle = 'rgba(0,30,0,0.07)';
      for (let i = 0; i < 3; i++) {
        const x = ((t * (10 + i * 4) + i * 300) % (LW + 160)) - 40;
        c.beginPath(); c.ellipse(x, top + (2 + i * 4) * CELL, 70, 30, 0, 0, 7); c.fill();
      }
    } else if (amb === 'sunset') {
      c.fillStyle = 'rgba(255,190,120,0.06)';
      for (let i = 0; i < 4; i++) {
        const x = ((t * 8 + i * 220) % (LW + 200)) - 100;
        c.beginPath();
        c.moveTo(x, top); c.lineTo(x + 60, top); c.lineTo(x - 140, H * CELL); c.lineTo(x - 200, H * CELL);
        c.fill();
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const x = OX + ((i * 131 + Math.sin(t * 0.6 + i) * 40) % (LW - OX));
        const y = top + ((i * 71 + Math.cos(t * 0.8 + i * 2) * 30) % (C.ROWS * CELL));
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
        c.fillStyle = 'rgba(220,255,120,' + (a * 0.25) + ')';
        c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill();
        c.fillStyle = 'rgba(240,255,160,' + a + ')';
        c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill();
      }
    }
  }

  /* ---------- Defensas ---------- */
  function drawShooterHead(c, x, y, cell, t, seed, head) {
    head = head || 'shooter-head';
    const r = cell && cell.recoil > 0 ? Math.min(1, cell.recoil / 0.12) : 0;
    const sway = Math.sin(t * 2.2 + seed * 0.7) * 0.07;
    c.save();
    c.translate(x + CELL * 0.5, y + CELL * 0.95);
    c.rotate(sway);
    c.scale(1 + r * 0.14, 1 - r * 0.12);
    const w = CELL * 1.3, h = CELL * 1.18;
    img(c, head, -w / 2, -h, w, h);
    // Parpadeo
    if (((t + seed * 0.37) % 3.3) < 0.13) {
      c.fillStyle = head === 'ice-head' ? '#8fd6f7' : '#6ccf4c';
      c.strokeStyle = head === 'ice-head' ? '#123a5a' : '#174212';
      c.lineWidth = 1.5;
      [0.40, 0.58].forEach(ex => {
        c.beginPath(); c.arc(-w / 2 + ex * w, -h + 0.45 * h, 0.1 * w, 0, 7); c.fill();
        c.beginPath(); c.moveTo(-w / 2 + ex * w - 0.08 * w, -h + 0.45 * h); c.lineTo(-w / 2 + ex * w + 0.08 * w, -h + 0.45 * h); c.stroke();
      });
    }
    c.restore();
  }

  // Girasol de cerebros: se balancea y brilla al producir
  function drawSunflower(c, x, y, cell, t, seed) {
    const glow = cell && cell.recoil > 0 ? cell.recoil / 0.5 : 0;
    c.save();
    c.translate(x + CELL * 0.5, y + CELL * 0.95);
    c.rotate(Math.sin(t * 1.8 + seed) * 0.08);
    const s = 1 + glow * 0.15 + Math.sin(t * 3 + seed) * 0.02;
    c.scale(s, s);
    if (glow > 0) {
      c.fillStyle = 'rgba(255,230,120,' + glow * 0.6 + ')';
      c.beginPath(); c.arc(0, -CELL * 0.62, CELL * 0.6, 0, 7); c.fill();
    }
    img(c, 'sunflower', -CELL * 0.6, -CELL * 1.15, CELL * 1.2, CELL * 1.2);
    c.restore();
  }

  function drawCracks(c, x, y, ratio) {
    c.strokeStyle = 'rgba(30,15,5,0.7)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x + 26, y + 4); c.lineTo(x + 22, y + 14); c.lineTo(x + 28, y + 20); c.lineTo(x + 24, y + 30);
    if (ratio < 0.33) {
      c.moveTo(x + 6, y + 28); c.lineTo(x + 14, y + 32); c.lineTo(x + 12, y + 42);
      c.moveTo(x + 40, y + 34); c.lineTo(x + 34, y + 40); c.lineTo(x + 38, y + 46);
    }
    c.stroke();
  }

  function drawCell(c, cell, px, py, seed, t) {
    const x = px + (cell.hitT > 0 ? Math.sin(cell.hitT * 80) * 3 * (cell.hitT / 0.25) : 0);
    const y = py;
    switch (cell.type) {
      case 'wall': img(c, 'wall', x, y, CELL, CELL); break;
      case 'single': img(c, 'single', x, y, CELL, CELL); break;
      case 'dirt': img(c, 'dirt', x, y, CELL, CELL); break;
      case 'bunker': img(c, 'bunker', x, y, CELL, CELL); break;
      case 'mine': {
        img(c, 'mine', x, y, CELL, CELL);
        const a = 0.5 + 0.5 * Math.sin(t * 6 + seed);
        c.fillStyle = 'rgba(255,240,180,' + a + ')';
        c.beginPath(); c.arc(x + CELL * 0.5, y + CELL * 0.3, 2.2, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,60,40,' + a * 0.35 + ')';
        c.beginPath(); c.arc(x + CELL * 0.5, y + CELL * 0.3, 7, 0, 7); c.fill();
        break;
      }
      case 'slime': {
        const sy = 1 + Math.sin(t * 4 + seed * 1.3) * 0.05;
        c.save(); c.translate(x, y + CELL); c.scale(1, sy);
        img(c, 'slime', 0, -CELL, CELL, CELL);
        c.restore();
        break;
      }
      case 'shooter':
        img(c, 'hedge', x, y, CELL, CELL);
        if (cell.gun) drawShooterHead(c, x, y, cell, t, seed);
        break;
      case 'ice':
        img(c, 'ice-base', x, y, CELL, CELL);
        if (cell.gun) drawShooterHead(c, x, y, cell, t, seed, 'ice-head');
        break;
      case 'cactus': img(c, 'cactus', x, y, CELL, CELL); break;
      case 'grave': img(c, 'grave-block', x, y, CELL, CELL); break;
      case 'sunflower':
        img(c, 'flower-base', x, y, CELL, CELL);
        if (cell.gun) drawSunflower(c, x, y, cell, t, seed);
        break;
      case 'bomb': {
        img(c, 'bomb', x, y, CELL, CELL);
        if (Math.sin(t * 30) > 0) {
          c.fillStyle = '#fff6a0';
          c.beginPath(); c.arc(x + CELL * 0.92, y + CELL * 0.08, 3, 0, 7); c.fill();
        }
        break;
      }
    }
    const ratio = cell.hp / cell.maxHp;
    const noCracks = { shooter: 1, slime: 1, ice: 1, sunflower: 1, grave: 1 };
    if (ratio < 0.66 && !noCracks[cell.type]) drawCracks(c, x, y, ratio);
    if (cell.flash > 0) {
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    }
  }

  // Defensas con cabeza que sobresale: se dibujan en una segunda pasada, por encima del resto
  const TALL = { shooter: true, ice: true, sunflower: true };

  // Modo daltónico: cada pieza tiene además un patrón de contorno y un símbolo propios
  const KIND_BY_COLOR = {};
  Object.keys(BOTD.Pieces.COLORS).forEach(k => { KIND_BY_COLOR[BOTD.Pieces.COLORS[k]] = k; });
  const CB_DASH = { I: [], O: [10, 4], T: [2, 4], L: [9, 3, 2, 3], J: [5, 4], S: [13, 6], Z: [2, 2], U: [], B: [] };
  const CB_SYMBOL = { I: '|', O: '■', T: '▲', L: '◣', J: '◢', S: 'S', Z: 'Z', U: '•', B: '✱' };

  function drawSymbol(c, x, y, kind) {
    const sym = CB_SYMBOL[kind];
    if (!sym) return;
    c.font = '13px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.strokeText(sym, x + 9, y + CELL - 9);
    c.fillStyle = '#fff';
    c.fillText(sym, x + 9, y + CELL - 9);
  }

  // Contorno del color de la pieza solo por los bordes exteriores
  function drawOutline(c, x, y, color, edges, kind) {
    const i = 1.5, e = CELL - 1.5;
    const segs = [];
    if (edges.top) segs.push([i, i, e, i]);
    if (edges.bottom) segs.push([i, e, e, e]);
    if (edges.left) segs.push([i, i, i, e]);
    if (edges.right) segs.push([e, i, e, e]);
    const cb = BOTD.Prefs.colorblind;
    kind = kind || KIND_BY_COLOR[color];
    if (cb && color) drawSymbol(c, x, y, kind);
    if (!segs.length || !color) return;   // las lápidas no llevan contorno
    c.lineCap = cb ? 'butt' : 'round';
    c.strokeStyle = 'rgba(30,15,5,0.55)';
    c.lineWidth = 5;
    c.beginPath();
    segs.forEach(s => { c.moveTo(x + s[0], y + s[1]); c.lineTo(x + s[2], y + s[3]); });
    c.stroke();
    if (cb) c.setLineDash(CB_DASH[kind] || []);
    c.strokeStyle = color;
    c.lineWidth = cb ? 3.5 : 2.5;
    c.stroke();
    if (cb) c.setLineDash([]);
  }

  function gridOutlines(c, grid) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const cell = grid[y][x];
        if (!cell) continue;
        const diff = (nx, ny) => {
          const n = grid[ny] && grid[ny][nx];
          return !n || n.pieceId !== cell.pieceId;
        };
        drawOutline(c, OX + x * CELL, y * CELL, cell.color, {
          top: diff(x, y - 1), bottom: diff(x, y + 1), left: diff(x - 1, y), right: diff(x + 1, y)
        });
      }
    }
  }

  function fakeCell(type, gun) {
    return { type, gun, hp: 1, maxHp: 1, flash: 0, hitT: 0, recoil: 0 };
  }

  // Dibuja una pieza (matriz) con su contorno; ox/oy en unidades lógicas
  function drawMatrix(c, kind, matrix, ox, oy, t, ghost, type) {
    type = type || BOTD.Pieces.TYPE[kind];
    const color = BOTD.Pieces.COLORS[kind];
    const has = (x, y) => matrix[y] && matrix[y][x];
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const px = ox + x * CELL, py = oy + y * CELL;
      if (ghost) {
        c.fillStyle = color;
        c.globalAlpha = 0.18;
        c.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        c.globalAlpha = 1;
      } else {
        drawCell(c, fakeCell(type, v === 2), px, py, x + y, t);
      }
    }));
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const edges = { top: !has(x, y - 1), bottom: !has(x, y + 1), left: !has(x - 1, y), right: !has(x + 1, y) };
      if (ghost) {
        c.globalAlpha = 0.7;
        drawOutline(c, ox + x * CELL, oy + y * CELL, color, edges, kind);
        c.globalAlpha = 1;
      } else {
        drawOutline(c, ox + x * CELL, oy + y * CELL, color, edges, kind);
      }
    }));
  }

  /* ---------- Zombies (muñeco articulado) ---------- */
  const BASIC = { head: 'zombie-head', torso: 'zombie-torso', arm: 'zombie-arm', leg: 'zombie-leg', k: 0.9 };
  const ZPARTS = {
    basic:   BASIC,
    cone:    Object.assign({}, BASIC, { hat: 'cone' }),
    bucket:  Object.assign({}, BASIC, { hat: 'bucket' }),
    shield:  Object.assign({}, BASIC, { shield: true }),
    balloon: Object.assign({}, BASIC, { balloon: true }),
    digger:  Object.assign({}, BASIC, { head: 'digger-head' }),
    runner:  { head: 'runner-head', torso: 'runner-torso', arm: 'zombie-arm', leg: 'zombie-leg', k: 0.88 },
    boss:    { head: 'boss-head', torso: 'boss-torso', arm: 'boss-arm', leg: 'zombie-leg', k: 1.45 },
    boss2:   { head: 'boss-head', torso: 'boss-torso', arm: 'boss-arm', leg: 'zombie-leg', k: 1.6, hat: 'crown' }
  };

  function drawHead(c, P, variant, jawOpen) {
    if (jawOpen > 0) img(c, 'zombie-jaw', -15, -6 + jawOpen * 7, 18, 9, variant);
    img(c, P.head, -16, -32, 32, 32, variant);
    if (P.hat === 'crown') img(c, 'crown', -14, -44, 26, 18, variant);
    else if (P.hat) img(c, P.hat, -15, -50, 25, 22, variant);
  }

  // cx/ground en las unidades del contexto actual; o: {noHead, fall, alpha, still, noShadow}
  function drawRig(c, z, cx, ground, o = {}) {
    const P = ZPARTS[z.type];
    const k = P.k;
    const runner = z.type === 'runner';
    const jumping = z.jump > 0;
    const flying = !!z.balloon;
    const walking = !z.biting && !jumping && !o.still && !flying;
    const ph = z.anim * (runner ? 13 : 6);
    const sw = walking ? Math.sin(ph) : (jumping ? 0.8 : flying ? Math.sin(z.anim * 3) * 0.3 : 0);
    let lift = walking ? -Math.abs(Math.cos(ph)) * 2 : 0;
    if (jumping) lift -= Math.sin(Math.PI * (1 - z.jump / 0.45)) * CELL * 0.9;
    if (flying) lift -= CELL * 0.55 + Math.sin(z.anim * 2.5) * 4;
    const d = C.ZOMBIES[z.type];
    const bp = z.biting ? (z.biteT * d.biteRate) % 1 : 0;
    const chomp = z.biting ? Math.sin(bp * Math.PI) : 0;
    const lean = (runner ? -0.22 : -0.06) + (z.biting ? -0.1 - chomp * 0.12 : 0);
    const variant = o.variant || (z.flash > 0 ? 'flash' : z.chill > 0 ? 'ice' : '');
    const back = o.variant || (z.flash > 0 ? 'flash' : z.chill > 0 ? 'ice' : 'dark');

    if (!o.noShadow) {
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath(); c.ellipse(cx, ground + 1, 16 * k * (flying ? 0.6 : 1), 4.5 * k, 0, 0, 7); c.fill();
    }
    c.save();
    c.translate(cx, ground + lift);
    // Globo (por encima de la cabeza, atado a la mano)
    if (flying && P.balloon) img(c, 'balloon', -14 * k, -150 * k, 30 * k, 50 * k);
    if (o.fall) c.rotate(o.fall);
    c.scale(k, k);
    const prev = curS; curS = curS * k;
    if (o.alpha != null) c.globalAlpha = Math.max(0, o.alpha);

    const leg = (hx, ang, v) => { c.save(); c.translate(hx, -27); c.rotate(ang); img(c, P.leg, -6, -2, 12, 30, v); c.restore(); };
    const arm = (sx, sy, ang, v) => { c.save(); c.translate(sx, sy); c.rotate(ang); img(c, P.arm, -30, -5, 31, 10, v); c.restore(); };

    leg(4, -sw * 0.5, back);
    c.save();
    c.translate(0, -27);
    c.rotate(lean);
    arm(-2, -25, 0.12 - sw * 0.1 + chomp * 0.15, back);
    img(c, P.torso, -13, -31, 28, 31, variant);
    if (!o.noHead) {
      c.save();
      c.translate(-2, -29);
      c.rotate(walking ? Math.sin(ph * 0.5) * 0.08 : -0.12 * chomp);
      drawHead(c, P, variant, z.biting ? chomp : 0);
      c.restore();
    }
    arm(-7, -21, (flying ? 1.1 : 0.08) + sw * 0.1 + chomp * 0.25, variant);
    c.restore();
    leg(-3, sw * 0.5, variant);
    // Escudo (puerta) delante del cuerpo mientras aguante
    if (P.shield && z.shield > 0) {
      const sr = z.shield / z.maxShield;
      c.save();
      c.translate(-22, -46);
      c.rotate(-0.05 + (z.biting ? -0.08 * chomp : 0));
      img(c, 'shield', -8, -18, 17, 52, z.flash > 0 ? 'flash' : '');
      if (sr < 0.5) {
        c.strokeStyle = INK; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-4, -8); c.lineTo(2, 4); c.lineTo(-3, 14); c.stroke();
      }
      c.restore();
    }

    curS = prev;
    c.restore();
    c.globalAlpha = 1;
  }

  // Excavador bajo tierra: un montículo que avanza
  function drawMound(c, z) {
    const cx = OX + z.x * CELL;
    const ground = (z.lane + 1) * CELL - 4;
    const wob = Math.sin(z.anim * 14) * 2;
    c.fillStyle = '#6e4526';
    c.strokeStyle = '#3b2412';
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(cx, ground, 20, 10 + wob * 0.5, 0, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#8a5a33';
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(cx + 14 + i * 5, ground - 4 - ((z.anim * 30 + i * 9) % 12), 2.5, 0, 7); c.fill();
    }
    img(c, 'digger-head', cx - 10, ground - 18 + wob, 20, 12);   // asoma el casco
  }

  function drawZombie(c, z) {
    if (z.underground) { drawMound(c, z); return; }
    const k = ZPARTS[z.type].k;
    const cx = OX + z.x * CELL;
    const ground = (z.lane + 1) * CELL - 3;
    drawRig(c, z, cx, ground);
    if (z.slow > 0) {
      c.fillStyle = 'rgba(170,90,230,0.75)';
      c.beginPath(); c.ellipse(cx, ground, 15 * k, 4 * k, 0, 0, 7); c.fill();
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.arc(cx - 10 + i * 10, ground - 10 - ((z.anim * 20 + i * 7) % 14), 2.5, 0, 7); c.fill();
      }
    }
    if (z.hp < z.maxHp) {
      const w = k > 1 ? 64 : 34;
      const r = Math.max(0, z.hp / z.maxHp);
      const hatted = z.type === 'cone' || z.type === 'bucket' || z.type === 'boss2';
      const by = ground - (hatted ? 102 : 88) * k - (z.balloon ? CELL * 0.55 : 0);
      c.fillStyle = INK;
      c.beginPath(); c.roundRect(cx - w / 2 - 2, by - 2, w + 4, 8, 4); c.fill();
      c.fillStyle = r > 0.5 ? '#7ee35a' : r > 0.25 ? '#ffcf3f' : '#ff4d4d';
      c.beginPath(); c.roundRect(cx - w / 2, by, Math.max(2, w * r), 4, 2); c.fill();
    }
  }

  /* ---------- Niebla del Mundo 2: tapa las últimas columnas de la zona de aparición ---------- */
  function drawFog(c, g, t) {
    const cols = g.level.fog || 0;
    if (!cols) return;
    const x0 = OX + (C.COLS - cols) * CELL;
    const top = C.HIDDEN_ROWS * CELL, bottom = H * CELL;
    const grd = c.createLinearGradient(x0 - CELL, 0, x0 + CELL * 0.6, 0);
    grd.addColorStop(0, 'rgba(200,190,230,0)');
    grd.addColorStop(1, 'rgba(200,190,230,0.9)');
    c.fillStyle = grd;
    c.fillRect(x0 - CELL, top, LW - x0 + CELL, bottom - top);
    // Volutas que se mueven
    c.fillStyle = 'rgba(230,225,250,0.55)';
    for (let i = 0; i < 9; i++) {
      const fx = x0 + ((i * 53 + t * 12) % (LW - x0 + 60)) - 20;
      const fy = top + ((i * 97) % (C.ROWS * CELL)) + Math.sin(t + i) * 10;
      c.beginPath(); c.ellipse(fx, fy, 40, 18, 0, 0, 7); c.fill();
    }
  }

  /* ---------- Rodillos de jardín ---------- */
  function drawRoller(c, x, lane, t, moving) {
    const w = 42, h = 34;
    const px = OX + x * CELL - w / 2;
    const py = (lane + 1) * CELL - h - 2 + (moving ? Math.sin(t * 40) * 1.2 : 0);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(px + w * 0.55, (lane + 1) * CELL - 2, w * 0.42, 4, 0, 0, 7); c.fill();
    img(c, 'roller', px, py, w, h);
  }

  function drawRollers(c, g, t) {
    for (let r = 0; r < H; r++) if (g.rollers[r]) drawRoller(c, -0.45, r, t, false);
    for (const r of g.rolling) drawRoller(c, r.x, r.lane, t, true);
  }

  /* ---------- Barra de oleadas con banderas ---------- */
  function drawFlag(c, x, y, reached) {
    c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y + 9); c.lineTo(x, y - 14); c.stroke();
    c.fillStyle = reached ? '#ff5d5d' : '#ffe9b0';
    c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 13, y - 10); c.lineTo(x, y - 5); c.closePath();
    c.fill(); c.lineWidth = 2; c.stroke();
  }

  function drawWaveBar(c, g) {
    if (!g.waves) return;
    const w = g.waves;
    // Supervivencia: contador de oleadas en lugar de barra
    if (g.level.endless) {
      const x = LW - 120, y = LH - 20;
      c.fillStyle = 'rgba(43,26,14,0.75)';
      c.beginPath(); c.roundRect(x - 92, y - 16, 200, 32, 14); c.fill();
      img(c, 'zombie-head', x - 86, y - 13, 26, 26);
      outlinedText(c, BOTD.t('wave_count', { n: Math.max(0, w.index + 1) }), x + 14, y + 1, 18, '#ffe23f');
      return;
    }
    const p = BOTD.Levels.progress(g);
    const bw = 190, bh = 14;
    const x = LW - bw - 18, y = LH - 24;
    // Fondo y relleno (se llena de derecha a izquierda, como el avance de la horda)
    c.fillStyle = 'rgba(43,26,14,0.75)';
    c.beginPath(); c.roundRect(x - 6, y - 6, bw + 12, bh + 12, 12); c.fill();
    c.fillStyle = '#5a3a1d';
    c.beginPath(); c.roundRect(x, y, bw, bh, 7); c.fill();
    if (p > 0) {
      c.fillStyle = '#7ee35a';
      c.beginPath(); c.roundRect(x + bw * (1 - p), y, Math.max(bh, bw * p), bh, 7); c.fill();
    }
    c.strokeStyle = INK; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(x, y, bw, bh, 7); c.stroke();
    // Banderas en las grandes oleadas
    w.flags.forEach(f => drawFlag(c, x + bw * (1 - f), y + 2, p > f + 0.001));
    // Cabeza de zombie que avanza
    const hx = x + bw * (1 - p);
    img(c, 'zombie-head', hx - 12, y - 7, 24, 24);
  }

  /* ---------- API ---------- */
  function init(context) {
    ctx = context;
  }

  // scale = píxeles reales por unidad lógica
  function resize(scale) {
    S = scale;
    bgCache = {};
    A.clearCache();
  }

  function draw(g) {
    const c = ctx;
    const t = g.time;
    curS = S;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(background(g.level.ambient, g.level.lanes), 0, 0);
    c.setTransform(S, 0, 0, S, 0, -VIEW_TOP * S);
    if (g.shake > 0 && BOTD.Prefs.shake && !BOTD.Prefs.reduceMotion) {
      const m = g.shake * 14;
      c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ambientFx(c, g.level.ambient, t);

    if (g.houseFlash > 0) {
      c.fillStyle = 'rgba(255,40,40,' + (g.houseFlash * 0.7) + ')';
      c.fillRect(0, C.HIDDEN_ROWS * CELL, CELL, C.ROWS * CELL);
    }

    // Bloques fijados y contornos de pieza
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const cell = g.grid[y][x];
        if (cell && !TALL[cell.type]) drawCell(c, cell, OX + x * CELL, y * CELL, x * 7 + y, t);
      }
    }
    // Las plantas se dibujan después para que su cabeza quede por encima del bloque superior
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < C.BUILD_COLS; x++) {
        const cell = g.grid[y][x];
        if (cell && TALL[cell.type]) drawCell(c, cell, OX + x * CELL, y * CELL, x * 7 + y, t);
      }
    }
    gridOutlines(c, g.grid);

    // Aviso de peligro cerca del techo
    const danger = g.grid[C.HIDDEN_ROWS].some(v => v) || g.grid[C.HIDDEN_ROWS + 1].some(v => v);
    if (danger && !g.over) {
      c.fillStyle = 'rgba(255,40,40,' + (0.4 + 0.3 * Math.sin(t * 10)) + ')';
      c.fillRect(OX, C.HIDDEN_ROWS * CELL - 3, C.BUILD_COLS * CELL, 6);
    }

    // Pieza activa y su sombra
    if (g.piece && !g.over) {
      const p = g.piece;
      const type = BOTD.Game.typeOf(g, p.kind);
      drawMatrix(c, p.kind, p.matrix, OX + p.x * CELL, BOTD.Game.ghostY(g) * CELL, t, true, type);
      drawMatrix(c, p.kind, p.matrix, OX + p.x * CELL, p.y * CELL, t, false, type);
    }

    drawRollers(c, g, t);

    // Guisantes
    for (const p of g.projectiles) {
      const px = OX + p.x * CELL, py = p.lane * CELL + CELL * 0.4;
      img(c, p.ice ? 'ice-pea' : 'pea', px - 8, py - 8, 16, 16);
    }

    // Cuerpos cayendo, zombies (de arriba a abajo) y cabezas voladoras
    for (const k of g.corpses) {
      const a = k.t / k.max;
      drawRig(c, { type: k.type, anim: k.anim, biting: false, jump: 0, flash: 0, biteT: 0 },
        OX + k.x * CELL, (k.lane + 1) * CELL - 3, { noHead: true, fall: (1 - a) * 1.4, alpha: a, still: true, noShadow: true });
    }
    g.zombies.slice().sort((a, b) => a.lane - b.lane).forEach(z => drawZombie(c, z));
    for (const d of g.debris) {
      const P = ZPARTS[d.type];
      c.save();
      c.globalAlpha = Math.min(1, d.t * 2);
      c.translate(OX + d.x * CELL, d.y * CELL);
      c.rotate(d.rot);
      c.scale(d.k, d.k);
      const prev = curS; curS = curS * d.k;
      c.translate(0, 16);
      drawHead(c, P, '', 0);
      curS = prev;
      c.restore();
    }
    c.globalAlpha = 1;

    // Rayo de las líneas completas
    for (const f of g.flashRows) {
      const a = f.t / 0.45;
      const yc = f.row * CELL + CELL / 2;
      c.fillStyle = 'rgba(255,240,150,' + a * 0.7 + ')';
      c.fillRect(0, f.row * CELL, LW, CELL);
      c.fillStyle = 'rgba(255,255,255,' + a + ')';
      c.fillRect(0, yc - CELL * 0.18 * a, LW, CELL * 0.36 * a);
    }

    // Humo
    for (const p of g.puffs) {
      const a = Math.max(0, p.t / p.max);
      const r = p.r * (1.4 - a * 0.6);
      c.globalAlpha = a;
      c.fillStyle = '#f6f2ea';
      c.strokeStyle = 'rgba(70,50,40,0.6)';
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(OX + p.x * CELL, p.y * CELL, r, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(OX + p.x * CELL - r * 0.3, p.y * CELL - r * 0.3, r * 0.35, 0, 7); c.fill();
    }
    c.globalAlpha = 1;

    // Partículas (círculos y estrellas)
    for (const p of g.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      const px = OX + p.x * CELL, py = p.y * CELL;
      if (p.shape === 'star') {
        star(c, px, py, p.size * 0.9, p.rot + p.life * 4);
        c.fill();
        c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      } else {
        c.beginPath(); c.arc(px, py, p.size / 2, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;

    // Textos flotantes (+cerebros)
    for (const tx of g.texts) {
      c.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      const x = OX + tx.x * CELL, y = tx.y * CELL;
      outlinedText(c, tx.text, x - (tx.icon ? 9 : 0), y, 18, tx.color);
      if (tx.icon) {
        const w = c.measureText(tx.text).width;
        img(c, 'brain', x - 9 + w / 2 + 3, y - 9, 22, 18);
      }
    }
    c.globalAlpha = 1;

    // Onomatopeyas
    for (const w of g.words) {
      const age = w.max - w.t;
      const s = easeOutBack(Math.min(1, age / 0.25));
      c.save();
      c.globalAlpha = Math.min(1, w.t * 3);
      c.translate(OX + w.x * CELL, w.y * CELL - age * 10);
      c.rotate(w.rot);
      c.scale(s, s);
      outlinedText(c, w.text, 0, 0, 30 * w.size, '#ffe23f');
      c.restore();
    }

    drawFog(c, g, t);

    // Elementos de interfaz en coordenadas de pantalla
    c.setTransform(S, 0, 0, S, 0, 0);
    drawWaveBar(c, g);

    // Cartel central con rebote
    if (g.banner) {
      const b = g.banner;
      const age = b.max - b.t;
      const a = Math.min(1, b.t * 2);
      const s = easeOutBack(Math.min(1, age / 0.35));
      const y = LH * 0.36;
      c.save();
      c.globalAlpha = a;
      c.translate(LW / 2, y);
      c.scale(s, s);
      c.fillStyle = 'rgba(43,26,14,0.55)';
      c.beginPath(); c.roundRect(-LW * 0.3, -34, LW * 0.6, 68, 34); c.fill();
      outlinedText(c, b.text, 0, 2, 40, b.color);
      c.restore();
    }
  }

  // Escena de fondo para los menús
  let idle = null, idleT = 0;
  function drawIdle(dt) {
    idleT += dt;
    if (!idle) {
      idle = ['basic', 'cone', 'runner', 'basic', 'cone'].map((type, i) => ({
        type, lane: H - 1 - i * 2, x: 2 + Math.random() * C.COLS, anim: Math.random() * 5,
        speed: type === 'runner' ? 0.9 : 0.35 + Math.random() * 0.2,
        hp: 1, maxHp: 1, slow: 0, jump: 0, flash: 0, biting: false, biteT: 0
      }));
    }
    const c = ctx;
    curS = S;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(background('day', C.ROWS), 0, 0);
    c.setTransform(S, 0, 0, S, 0, -VIEW_TOP * S);
    ambientFx(c, 'day', idleT);
    idle.forEach(z => {
      z.anim += dt;
      z.x -= z.speed * dt;
      if (z.x < -1) z.x = C.COLS + 1;
      drawZombie(c, z);
    });
  }

  function prepCanvas(canvas) {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = true;
    return c;
  }

  // Vista previa de una pieza (siguiente pieza, selector)
  function drawPreview(canvas, kind, type) {
    const c = prepCanvas(canvas);
    if (!kind) return;
    const m = BOTD.Pieces.SHAPES[kind];
    const cells = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    const minX = Math.min(...cells.map(p => p[0])), maxX = Math.max(...cells.map(p => p[0]));
    const minY = Math.min(...cells.map(p => p[1])), maxY = Math.max(...cells.map(p => p[1]));
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const span = Math.max(w, h + 0.4, cells.length === 1 ? 2 : 3.4);
    const sc = Math.min(canvas.width, canvas.height) / (span * CELL);
    const ox = (canvas.width - w * CELL * sc) / 2 - minX * CELL * sc;
    const oy = (canvas.height - h * CELL * sc) / 2 - minY * CELL * sc + (kind === 'T' ? CELL * sc * 0.2 : 0);
    c.setTransform(sc, 0, 0, sc, ox, oy);
    const prev = curS; curS = sc;
    drawMatrix(c, kind, m, 0, 0, performance.now() / 1000, false, type);
    curS = prev;
  }

  // Icono de defensa o zombie ("Cómo jugar", almanaque, elección de defensas).
  // silhouette: dibuja solo la silueta oscura (para lo aún no descubierto)
  function drawIcon(canvas, kind, type, silhouette) {
    const c = prepCanvas(canvas);
    const prev = curS;
    if (kind === 'defense') {
      const sc = canvas.width / (CELL * 1.25);
      c.setTransform(sc, 0, 0, sc, canvas.width * 0.1, canvas.height * 0.16);
      curS = sc;
      drawCell(c, fakeCell(type, !!TALL[type]), 0, 0, 1, 0);
    } else {
      const P = ZPARTS[type];
      const d = C.ZOMBIES[type];
      const k = P.k;
      const tall = P.balloon ? 150 : P.hat ? 108 : 95;
      const sc = canvas.height / (tall * k);
      c.setTransform(sc, 0, 0, sc, 0, 0);
      curS = sc;
      const z = { type, anim: 0.3, biting: false, jump: 0, flash: 0, biteT: 0, chill: 0,
        balloon: !!P.balloon, shield: d.shield || 0, maxShield: d.shield || 1 };
      drawRig(c, z, canvas.width / sc / 2 + 6, canvas.height / sc - 4, { still: true, noShadow: !!P.balloon });
    }
    curS = prev;
    if (silhouette) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(40,22,10,0.92)';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.globalCompositeOperation = 'source-over';
    }
  }

  // Convierte coordenadas del juego (celdas) a píxeles de la pantalla
  function worldToClient(x, y) {
    const r = ctx.canvas.getBoundingClientRect();
    return {
      x: r.left + (OX + x * CELL) / LW * r.width,
      y: r.top + (y * CELL - VIEW_TOP) / LH * r.height
    };
  }

  return { LW, LH, init, resize, draw, drawIdle, drawPreview, drawIcon, worldToClient };
})();
