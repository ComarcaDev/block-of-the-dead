/* Efectos de sonido y música generados con Web Audio (sin archivos externos). */
window.BOTD = window.BOTD || {};

BOTD.Audio = (() => {
  let ctx = null, master, sfxGain, musicGain, noiseBuf = null;
  let sfxOn = true, musicOn = true;
  let sfxVol = 0.8, musicVol = 0.8;     // volúmenes elegidos en ajustes (0–1)
  const MUSIC_BASE = 0.22;              // la música suena más baja que los efectos
  let musicTimer = null, nextNoteTime = 0, step = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = MUSIC_BASE * musicVol; musicGain.connect(master);
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    if (sfxGain) sfxGain.gain.value = sfxVol;
  }

  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, v));
    if (musicGain) musicGain.gain.value = MUSIC_BASE * musicVol;
  }

  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    g.gain.setValueAtTime(o.vol == null ? 0.2 : o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, o = {}) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol == null ? 0.3 : o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const SFX = {
    click: () => tone(600, 0.04, { vol: 0.06 }),
    move: () => tone(220, 0.04, { vol: 0.04 }),
    rotate: () => tone(440, 0.06, { vol: 0.06, slide: 660 }),
    lock: () => tone(110, 0.1, { type: 'triangle', vol: 0.25, slide: 60 }),
    harddrop: () => { tone(160, 0.12, { type: 'triangle', vol: 0.3, slide: 50 }); noise(0.08, { vol: 0.12, freq: 800 }); },
    line: (n) => {
      noise(0.5, { vol: 0.45, freq: 2500 });
      [523, 659, 784, 1046].slice(0, Math.max(1, n)).forEach((f, i) => tone(f, 0.15, { vol: 0.12, delay: i * 0.07 }));
    },
    shoot: () => tone(700, 0.05, { vol: 0.035, slide: 400 }),
    hit: () => tone(180, 0.06, { vol: 0.06, type: 'sawtooth', slide: 120 }),
    bite: () => tone(90, 0.07, { vol: 0.07, type: 'sawtooth' }),
    jump: () => tone(300, 0.15, { vol: 0.07, slide: 600 }),
    mine: () => { noise(0.45, { vol: 0.5, freq: 1500 }); tone(80, 0.3, { type: 'sine', vol: 0.4, slide: 30 }); },
    bomb: () => { noise(0.8, { vol: 0.6, freq: 2000 }); tone(70, 0.5, { type: 'sine', vol: 0.5, slide: 25 }); },
    smash: () => { noise(0.3, { vol: 0.5, freq: 600 }); tone(60, 0.3, { type: 'sine', vol: 0.5, slide: 30 }); },
    hold: () => { tone(520, 0.06, { vol: 0.08, slide: 780 }); tone(780, 0.08, { vol: 0.06, delay: 0.05, slide: 520 }); },
    combo:(n) => [659, 784, 988, 1175, 1319, 1568].slice(0, Math.min(6, n + 1)).forEach((f, i) => tone(f, 0.12, { vol: 0.1, delay: 0.25 + i * 0.06, type: 'triangle' })),
    achievement: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { vol: 0.12, delay: i * 0.09, type: 'triangle' })),
    pop:() => { noise(0.08, { vol: 0.25, freq: 4000 }); tone(900, 0.06, { vol: 0.08, slide: 300 }); },
    dig: () => { noise(0.35, { vol: 0.3, freq: 700 }); tone(120, 0.2, { type: 'triangle', vol: 0.15, slide: 200 }); },
    roller:() => { noise(0.9, { vol: 0.35, freq: 500 }); tone(70, 0.8, { type: 'sawtooth', vol: 0.12, slide: 110 }); },
    tip: () => { tone(660, 0.07, { vol: 0.08 }); tone(990, 0.1, { vol: 0.08, delay: 0.07 }); },
    unlock: () => [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.22, { vol: 0.12, delay: i * 0.1, type: 'triangle' })),
    zombieDie:() => tone(200, 0.25, { type: 'sawtooth', vol: 0.08, slide: 60 }),
    lifeLost: () => { tone(300, 0.2, { vol: 0.15, slide: 150 }); tone(200, 0.3, { vol: 0.15, slide: 90, delay: 0.18 }); },
    buy: () => { tone(880, 0.06, { vol: 0.1 }); tone(1320, 0.08, { vol: 0.1, delay: 0.06 }); },
    deny: () => tone(140, 0.15, { vol: 0.12 }),
    wave: () => [220, 220, 330].forEach((f, i) => tone(f, 0.18, { vol: 0.12, delay: i * 0.2, type: 'sawtooth' })),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, { vol: 0.14, delay: i * 0.12 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { vol: 0.14, delay: i * 0.22, type: 'sawtooth' }))
  };

  function play(name, arg) {
    if (!ctx || !sfxOn) return;
    const f = SFX[name];
    if (f) f(arg);
  }

  /* ---------- Música: bucle siniestro en La menor ---------- */
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const BASS = [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 47, 0, 43, 0, 45, 0, 45, 0, 48, 0, 50, 0, 52, 0, 50, 0, 48, 0, 47, 0];
  const MEL = [69, 0, 0, 72, 0, 71, 0, 67, 0, 0, 69, 0, 0, 0, 0, 0, 69, 0, 0, 72, 0, 76, 0, 75, 0, 74, 0, 71, 0, 0, 0, 0];
  const STEP_T = 0.2;

  function schedule() {
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const i = step % 32;
      const delay = Math.max(0, nextNoteTime - ctx.currentTime);
      if (BASS[i]) tone(midi(BASS[i]), STEP_T * 1.6, { type: 'triangle', vol: 0.5, delay, dest: musicGain });
      if (MEL[i] && step >= 32) tone(midi(MEL[i]), STEP_T * 1.3, { type: 'square', vol: 0.1, delay, dest: musicGain });
      if (i % 4 === 2) noise(0.04, { vol: 0.08, freq: 6000, delay, dest: musicGain });
      nextNoteTime += STEP_T;
      step++;
    }
  }

  function startMusic() {
    if (!ctx || !musicOn || musicTimer) return;
    nextNoteTime = ctx.currentTime + 0.05;
    step = 0;
    musicTimer = setInterval(schedule, 50);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setSfx(v) { sfxOn = !!v; }
  function setMusic(v) { musicOn = !!v; if (!musicOn) stopMusic(); }

  return { init, play, startMusic, stopMusic, setSfx, setMusic, setSfxVolume, setMusicVolume };
})();
