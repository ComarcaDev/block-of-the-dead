/* Carga de imágenes SVG (assets/svg) y caché de versiones rasterizadas por tamaño.
   Solo usa drawImage, así que funciona abriendo index.html con doble clic. */
window.BOTD = window.BOTD || {};

BOTD.Assets = (() => {
  const LIST = [
    'wall', 'single', 'bunker', 'hedge', 'shooter-head', 'mine', 'slime', 'bomb', 'pea',
    'zombie-head', 'zombie-jaw', 'zombie-torso', 'zombie-arm', 'zombie-leg',
    'runner-head', 'runner-torso', 'boss-head', 'boss-torso', 'boss-arm', 'cone',
    'house', 'tombstone', 'brain', 'cloud', 'dirt', 'roller',
    'ice-base', 'ice-head', 'ice-pea', 'cactus', 'flower-base', 'sunflower', 'grave-block',
    'bucket', 'shield', 'digger-head', 'balloon', 'crown',
    'lilypad', 'kelp', 'buoy', 'lighthouse', 'tube', 'snorkel', 'seal', 'helmet', 'captain-hat', 'pool-cleaner'
  ];
  const imgs = {};
  const CACHE_MAX = 400;      // imágenes preparadas como máximo (se borran las menos usadas)
  let cache = new Map();
  let ready = false;

  function load() {
    return Promise.all(LIST.map(name => new Promise(resolve => {
      const im = new Image();
      im.onload = () => { imgs[name] = im; resolve(); };
      im.onerror = () => { imgs[name] = null; console.warn('No se pudo cargar la imagen', name); resolve(); };
      im.src = 'assets/svg/' + name + '.svg';
    }))).then(() => { ready = true; });
  }

  // Devuelve un lienzo con la imagen dibujada a w×h píxeles reales.
  // variant: '' normal, 'dark' sombreada (miembros traseros), 'flash' blanqueada (al recibir daño)
  function bitmap(name, w, h, variant) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    const key = name + '@' + w + 'x' + h + (variant || '');
    let cv = cache.get(key);
    if (cv) {
      // Mover al final: es la más usada recientemente
      cache.delete(key);
      cache.set(key, cv);
      return cv;
    }
    cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    const im = imgs[name];
    if (im) {
      c.drawImage(im, 0, 0, w, h);
      if (variant) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = variant === 'flash' ? 'rgba(255,255,255,0.75)'
          : variant === 'ice' ? 'rgba(120,200,255,0.5)'
          : variant === 'shadow' ? 'rgba(20,10,30,1)'
          : 'rgba(0,0,0,0.28)';
        c.fillRect(0, 0, w, h);
      }
    } else {
      c.fillStyle = '#d34fd3';
      c.fillRect(0, 0, w, h);
    }
    cache.set(key, cv);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return cv;
  }

  function clearCache() { cache = new Map(); }

  return {
    load, bitmap, clearCache, CACHE_MAX,
    get ready() { return ready; },
    get cacheSize() { return cache.size; },
    url: name => 'assets/svg/' + name + '.svg'
  };
})();
