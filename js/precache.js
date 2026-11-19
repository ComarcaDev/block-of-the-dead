/* Archivos que el service worker (sw.js) guarda para jugar sin conexión.
   Si añades un archivo al juego, añádelo también aquí (las pruebas comprueban los dibujos y los scripts). */
self.BOTD_PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  // Scripts (en el mismo orden que index.html)
  'js/config.js', 'js/i18n.js', 'js/storage.js', 'js/audio.js', 'js/assets.js', 'js/pieces.js',
  'js/board.js', 'js/defenses.js', 'js/zombies.js', 'js/projectiles.js', 'js/levels.js',
  'js/progress.js', 'js/game.js', 'js/render.js', 'js/input.js', 'js/ui.js', 'js/tutorial.js',
  'js/pwa.js', 'js/main.js', 'js/precache.js',
  // Iconos de la app
  'assets/icons/icon.svg', 'assets/icons/icon-32.png', 'assets/icons/icon-192.png',
  'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
  // Dibujos del juego
  'assets/svg/wall.svg', 'assets/svg/single.svg', 'assets/svg/bunker.svg', 'assets/svg/hedge.svg',
  'assets/svg/shooter-head.svg', 'assets/svg/mine.svg', 'assets/svg/slime.svg', 'assets/svg/bomb.svg',
  'assets/svg/pea.svg', 'assets/svg/zombie-head.svg', 'assets/svg/zombie-jaw.svg', 'assets/svg/zombie-torso.svg',
  'assets/svg/zombie-arm.svg', 'assets/svg/zombie-leg.svg', 'assets/svg/runner-head.svg', 'assets/svg/runner-torso.svg',
  'assets/svg/boss-head.svg', 'assets/svg/boss-torso.svg', 'assets/svg/boss-arm.svg', 'assets/svg/cone.svg',
  'assets/svg/house.svg', 'assets/svg/tombstone.svg', 'assets/svg/brain.svg', 'assets/svg/cloud.svg',
  'assets/svg/dirt.svg', 'assets/svg/roller.svg', 'assets/svg/ice-base.svg', 'assets/svg/ice-head.svg',
  'assets/svg/ice-pea.svg', 'assets/svg/cactus.svg', 'assets/svg/flower-base.svg', 'assets/svg/sunflower.svg',
  'assets/svg/grave-block.svg', 'assets/svg/bucket.svg', 'assets/svg/shield.svg', 'assets/svg/digger-head.svg',
  'assets/svg/balloon.svg', 'assets/svg/crown.svg'
];
