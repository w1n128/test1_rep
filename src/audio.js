// WebAudio: SFX-генератор + процедурный саундтрек в стиле Tom & Jerry chase.
// Без файлов — все звуки и музыка синтезируются на лету.
(function () {
  const G = (window.G = window.G || {});
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = _muted ? 0 : 0.45;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(master);
    } catch (e) {
      return false;
    }
    return true;
  }

  let _muted = false;

  function out(dest) { return dest === 'music' ? musicGain : sfxGain; }

  function tone(freq, dur, type = 'square', vol = 0.15, when = 0, freqEnd = null, dest = 'sfx') {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g);
    g.connect(out(dest));
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.15, filterFreq = 2000, when = 0, dest = 'sfx') {
    const t0 = ctx.currentTime + when;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(out(dest));
    src.start(t0);
  }

  // Пицц-нота с быстрой атакой и затуханием — для бас-линии и марионеточного «мяуу».
  function pluck(freq, dur, vol = 0.18, when = 0, dest = 'music') {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g);
    g.connect(out(dest));
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Кулдауны чтобы не превратить интенсивные SFX в шум.
  const cooldowns = {};
  function canPlay(name, ms) {
    const now = performance.now();
    if (cooldowns[name] && now - cooldowns[name] < ms) return false;
    cooldowns[name] = now;
    return true;
  }

  function play(name) {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    switch (name) {
      // --- Шаги: тяжёлый ботинок дворника ---
      case 'step_janitor':
        if (!canPlay('step_janitor', 200)) return;
        tone(95, 0.07, 'square', 0.12, 0, 60);
        noise(0.05, 0.05, 500);
        // мини «squeak» резинки на ботинке
        tone(420, 0.03, 'sine', 0.04, 0.02, 380);
        break;
      // --- Шаги: енот мягко цокает лапами ---
      case 'step_raccoon':
        if (!canPlay('step_raccoon', 180)) return;
        tone(820, 0.025, 'sine', 0.08, 0, 600);
        tone(1400, 0.02, 'sine', 0.05, 0.012, 1100);
        noise(0.03, 0.04, 3500);
        break;
      case 'step':
        // Запасной общий шаг (на случай если character не передан)
        if (!canPlay('step', 200)) return;
        noise(0.04, 0.05, 800);
        break;
      case 'snap':
        tone(2400, 0.04, 'square', 0.18);
        noise(0.08, 0.12, 2500);
        break;
      case 'splash':
        if (!canPlay('splash', 250)) return;
        noise(0.25, 0.15, 1000);
        tone(440, 0.12, 'sine', 0.08, 0, 220);
        break;
      case 'slip':
        // Мульт-«виуу» вверх→вниз
        tone(700, 0.22, 'sine', 0.14, 0, 1400);
        tone(800, 0.22, 'sine', 0.10, 0.05, 200);
        break;
      case 'boom':
        noise(0.5, 0.4, 600);
        tone(80, 0.4, 'sine', 0.35, 0, 30);
        tone(140, 0.2, 'square', 0.18, 0, 50);
        break;
      case 'pickup':
        tone(880, 0.07, 'sine', 0.16);
        tone(1320, 0.08, 'sine', 0.16, 0.07);
        break;
      case 'place':
        tone(220, 0.08, 'square', 0.12);
        noise(0.05, 0.04, 600);
        break;
      case 'throw':
        if (!canPlay('throw', 200)) return;
        noise(0.18, 0.1, 2200);
        tone(700, 0.1, 'sine', 0.05, 0, 1200);
        break;
      case 'fall':
        // Падение в люк — нисходящее «уиу»
        tone(880, 0.5, 'sine', 0.16, 0, 110);
        noise(0.3, 0.06, 800, 0.15);
        break;
      case 'damage':
        tone(220, 0.15, 'sawtooth', 0.18, 0, 110);
        break;
      case 'menu':
        tone(660, 0.06, 'square', 0.1);
        break;
    }
  }

  // ===== Музыкальный движок =====

  const NOTE = {
    C2:65.41, D2:73.42, E2:82.41, F2:87.31, G2:98.00, A2:110.00, B2:123.47,
    C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
    C6:1046.50, D6:1174.66, E6:1318.51,
  };
  function n(name) { return NOTE[name]; }

  // Каждый паттерн — 16 шагов (1 такт 4/4 на 16-х). Темп ~ 152 BPM.
  // Бас: тонкая walking-линия с прыжками октавой (мульт-pizz).
  // Мелодия: бодрые арпеджио, с проскоками (типичный chase-stinger).
  // Перкуссия: closed-hihat на каждый 16-й, claps на 5 и 13 (бэкбит).
  const PATTERNS = [
    // === A: основной мажорный chase в C ===
    {
      bass: ['C3', null, 'C2', null, 'G3', null, 'C2', null,
             'E3', null, 'C2', null, 'G3', null, 'C2', null],
      lead: ['E5', 'G5', 'C6', 'G5', 'E5', 'G5', 'C5', null,
             'D5', 'F5', 'A5', 'F5', 'D5', 'F5', 'B4', null],
      hat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    },
    // === B: вариация с восходящим бас-walking и stinger-нотой ===
    {
      bass: ['F3', null, 'F2', null, 'A3', null, 'F2', null,
             'G3', null, 'G2', null, 'B3', null, 'G2', null],
      lead: ['F5', 'A5', 'C6', 'A5', 'F5', 'D5', 'F5', null,
             'G5', 'B5', 'D6', 'B5', 'G5', 'E5', 'G5', null],
      hat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    },
    // === C: «крадущаяся» секция — пицц-бас, без перкуссии, мелодия редкая ===
    {
      bass: ['A3', null, null, null, 'E3', null, null, null,
             'F3', null, null, null, 'G3', null, 'A3', 'B3'],
      lead: ['A5', null, null, null, null, 'C6', null, null,
             null, null, 'B5', null, 'A5', null, 'G5', null],
      hat:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      clap: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    },
    // === D: финальный «штурм» — большее plunger ===
    {
      bass: ['C3', 'C3', 'C2', null, 'G3', 'G3', 'C2', null,
             'F3', 'F3', 'F2', null, 'G3', 'G3', 'G2', 'B3'],
      lead: ['G5', 'C6', 'E6', 'C6', 'G5', 'E5', 'C5', 'E5',
             'A5', 'C6', 'E6', 'C6', 'A5', 'F5', 'D5', 'B4'],
      hat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      clap: [0,0,1,0, 1,0,1,0, 0,0,1,0, 1,0,1,1],
    },
  ];

  const TEMPO_BPM = 152;
  const STEP_SEC = 60 / TEMPO_BPM / 4; // 16-я нота
  const PATTERN_LEN = 16;

  let musicTimer = null;
  let stepIdx = 0;
  let patIdx = 0;
  let loopsInPattern = 0;
  let scheduledUpTo = 0;

  function playStep(patternIdx, step, when) {
    const p = PATTERNS[patternIdx];
    // Бас — pluck triangle
    if (p.bass[step]) {
      pluck(n(p.bass[step]), 0.28, 0.20, when, 'music');
      // Лёгкий «октавный двойник» сверху для мульти-скока
      pluck(n(p.bass[step]) * 2, 0.14, 0.07, when + 0.02, 'music');
    }
    // Мелодия — square с быстрой атакой, имитация мульт-кларнета
    if (p.lead[step]) {
      tone(n(p.lead[step]), 0.18, 'square', 0.09, when, null, 'music');
      // Лёгкий хвостик-фолл вниз — cartoon-эффект
      if (step === 7 || step === 15) {
        tone(n(p.lead[step]) * 0.95, 0.12, 'square', 0.04, when + 0.02, n(p.lead[step]) * 0.6, 'music');
      }
    }
    // Hi-hat
    if (p.hat[step]) {
      noise(0.025, 0.04, 6000, when, 'music');
    }
    // Clap
    if (p.clap[step]) {
      noise(0.07, 0.10, 1800, when, 'music');
    }
  }

  // Шедулер: смотрит на 200 мс вперёд, чтобы быть устойчивым к джиттеру.
  function scheduler() {
    if (!ctx) return;
    const lookAhead = 0.18;
    while (scheduledUpTo < ctx.currentTime + lookAhead) {
      const when = scheduledUpTo - ctx.currentTime;
      playStep(patIdx, stepIdx, when);
      scheduledUpTo += STEP_SEC;
      stepIdx++;
      if (stepIdx >= PATTERN_LEN) {
        stepIdx = 0;
        loopsInPattern++;
        // Каждые 2 повтора — переход к следующей секции, чередуя «динамично»
        if (loopsInPattern >= 2) {
          loopsInPattern = 0;
          patIdx = (patIdx + 1) % PATTERNS.length;
        }
      }
    }
  }

  function startMusic() {
    if (!ensure()) return;
    if (musicTimer) return;
    if (ctx.state === 'suspended') ctx.resume();
    stepIdx = 0;
    patIdx = 0;
    loopsInPattern = 0;
    scheduledUpTo = ctx.currentTime + 0.05;
    musicTimer = setInterval(scheduler, 25);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMusicVolume(v) {
    if (!ensure()) return;
    musicGain.gain.value = v;
  }

  function setMuted(m) {
    _muted = !!m;
    if (!ensure()) return;
    master.gain.value = _muted ? 0 : 0.45;
  }
  function isMuted() { return _muted; }

  G.audio = {
    init: ensure,
    play,
    setMuted, isMuted,
    music: { start: startMusic, stop: stopMusic, setVolume: setMusicVolume },
  };
})();
