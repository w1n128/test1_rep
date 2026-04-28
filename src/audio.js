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

  function windHowl(dur = 2.0, when = 0) {
    const t0 = ctx.currentTime + when;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, t0);
    filter.frequency.linearRampToValueAtTime(920, t0 + 0.65);
    filter.frequency.linearRampToValueAtTime(360, t0 + 1.35);
    filter.frequency.linearRampToValueAtTime(700, t0 + dur);
    filter.Q.value = 2.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.18);
    g.gain.linearRampToValueAtTime(0.16, t0 + 1.55);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    tone(210, 1.3, 'sine', 0.05, when + 0.1, 135);
    tone(430, 0.9, 'sine', 0.035, when + 0.75, 260);
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
      case 'pickup_powerup':
        tone(990, 0.06, 'sine', 0.13);
        tone(1320, 0.07, 'sine', 0.13, 0.05);
        tone(1760, 0.10, 'sine', 0.14, 0.11);
        break;
      case 'pickup_mousetrap':
        tone(1600, 0.035, 'square', 0.12);
        tone(700, 0.05, 'square', 0.08, 0.035, 520);
        break;
      case 'pickup_firecracker':
        tone(880, 0.04, 'square', 0.11);
        noise(0.09, 0.06, 3200, 0.03);
        tone(180, 0.06, 'triangle', 0.08, 0.06, 120);
        break;
      case 'pickup_trapdoor':
        tone(170, 0.08, 'sine', 0.12, 0, 90);
        noise(0.07, 0.05, 600, 0.03);
        break;
      case 'pickup_banana':
        tone(740, 0.07, 'triangle', 0.10);
        tone(980, 0.06, 'triangle', 0.08, 0.05, 620);
        break;
      case 'pickup_branch':
        tone(260, 0.05, 'triangle', 0.11);
        tone(430, 0.05, 'triangle', 0.08, 0.04, 320);
        noise(0.05, 0.05, 1200, 0.02);
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
      case 'melee_swing':
        if (!canPlay('melee_swing', 120)) return;
        noise(0.10, 0.09, 2200);
        tone(360, 0.08, 'sine', 0.05, 0, 620);
        break;
      case 'melee_hit_janitor':
        if (!canPlay('melee_hit_janitor', 220)) return;
        tone(150, 0.20, 'sawtooth', 0.24, 0, 80);
        tone(230, 0.08, 'square', 0.12, 0.04, 130);
        noise(0.05, 0.06, 700, 0.03);
        break;
      case 'melee_hit_raccoon':
        if (!canPlay('melee_hit_raccoon', 220)) return;
        tone(1350, 0.10, 'square', 0.18, 0, 1850);
        tone(900, 0.08, 'sine', 0.10, 0.06, 520);
        break;
      // --- Реакция дворника на боль: грубое низкое «ой!» ---
      case 'hurt_janitor':
        if (!canPlay('hurt_janitor', 250)) return;
        tone(180, 0.18, 'sawtooth', 0.22, 0, 90);
        tone(240, 0.10, 'square', 0.12, 0.02, 140);
        noise(0.06, 0.06, 800, 0.02);
        break;
      // --- Реакция енота на боль: высокий писк «ии!» ---
      case 'hurt_raccoon':
        if (!canPlay('hurt_raccoon', 250)) return;
        tone(1200, 0.12, 'square', 0.16, 0, 1700);
        tone(1500, 0.08, 'sine', 0.10, 0.04, 900);
        break;
      // --- Резкий металлический щелчок мышеловки ---
      case 'mousetrap_snap':
        if (!canPlay('mousetrap_snap', 60)) return;
        tone(3200, 0.025, 'square', 0.22, 0, 1800);
        tone(2000, 0.04, 'square', 0.16, 0.005, 600);
        noise(0.05, 0.18, 4000);
        // глухой деревянный «тук»
        tone(140, 0.08, 'sine', 0.10, 0.01, 80);
        break;
      case 'trap_mousetrap_hit':
        if (!canPlay('trap_mousetrap_hit', 160)) return;
        tone(3600, 0.035, 'square', 0.18, 0, 1200);
        tone(260, 0.12, 'triangle', 0.16, 0.02, 120);
        break;
      case 'trap_banana_hit':
        if (!canPlay('trap_banana_hit', 180)) return;
        tone(760, 0.18, 'sine', 0.14, 0, 1600);
        tone(1450, 0.14, 'sine', 0.10, 0.08, 320);
        noise(0.08, 0.05, 2500, 0.05);
        break;
      case 'trap_trapdoor_hit':
        if (!canPlay('trap_trapdoor_hit', 220)) return;
        tone(620, 0.34, 'sine', 0.14, 0, 70);
        noise(0.18, 0.14, 700, 0.12);
        break;
      case 'trap_firecracker_hit':
        if (!canPlay('trap_firecracker_hit', 220)) return;
        tone(120, 0.18, 'sawtooth', 0.18, 0, 50);
        tone(900, 0.06, 'square', 0.10, 0.03, 220);
        break;
      case 'bait_pizza':
        if (!canPlay('bait_pizza', 220)) return;
        tone(330, 0.08, 'triangle', 0.13);
        tone(494, 0.08, 'triangle', 0.13, 0.07);
        tone(659, 0.12, 'triangle', 0.14, 0.14);
        break;
      case 'bait_diamond':
        if (!canPlay('bait_diamond', 220)) return;
        tone(1200, 0.06, 'sine', 0.12);
        tone(1800, 0.08, 'sine', 0.11, 0.06);
        tone(2400, 0.12, 'sine', 0.10, 0.13);
        break;
      case 'event_wind':
        if (!canPlay('event_wind', 1700)) return;
        windHowl(2.0);
        break;
      case 'event_trash':
        if (!canPlay('event_trash', 600)) return;
        noise(0.65, 0.20, 900);
        tone(180, 0.10, 'square', 0.12, 0.04, 90);
        tone(260, 0.08, 'square', 0.10, 0.16, 130);
        tone(120, 0.12, 'triangle', 0.12, 0.30, 70);
        tone(520, 0.05, 'square', 0.08, 0.42, 300);
        break;
      case 'menu':
        tone(660, 0.06, 'square', 0.1);
        break;
      // --- Power-up: звезда (восходящая фанфара) ---
      case 'star':
        tone(523, 0.10, 'square', 0.18, 0.00);    // C5
        tone(659, 0.10, 'square', 0.18, 0.08);    // E5
        tone(784, 0.10, 'square', 0.18, 0.16);    // G5
        tone(1047, 0.20, 'square', 0.20, 0.24);   // C6
        tone(1318, 0.30, 'sine',   0.16, 0.32);   // E6 sustain
        break;
      // --- Power-up: метла (взмах + пыль) ---
      case 'broom':
        noise(0.30, 0.20, 1500);
        tone(700, 0.18, 'sine', 0.10, 0, 200);
        noise(0.20, 0.10, 800, 0.10);
        break;
      // --- Магнитофон включён (короткий хит) ---
      case 'boombox_on':
        tone(120, 0.18, 'square', 0.20);
        tone(240, 0.10, 'square', 0.12, 0.04);
        noise(0.10, 0.10, 1200);
        break;
      // --- Магнитофон выключен (спад тона) ---
      case 'boombox_off':
        tone(440, 0.30, 'sawtooth', 0.18, 0, 80);
        noise(0.10, 0.06, 600, 0.05);
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

  // === Диско-секция (другой темп, 4-on-floor бочка, открытые хэты, синкопа баса) ===
  // Все паттерны — оригинальные, в Am/F-диапазоне.
  const DISCO_PATTERNS = [
    {
      // Основной диско-грув в Am
      bass: ['A2', null, null, 'A2', 'A3', null, null, 'E3',
             'F2', null, null, 'F2', 'A3', null, 'G3', null],
      lead: ['E5', null, 'A5', null, 'C6', null, 'E5', null,
             'F5', null, 'A5', null, 'C6', null, 'D5', 'C5'],
      hat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      open: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    },
    {
      // Восходящий вариант
      bass: ['F2', null, null, 'F2', 'C3', null, null, 'F3',
             'G2', null, null, 'G2', 'D3', null, 'G3', null],
      lead: ['F5', 'A5', 'C6', 'A5', 'F5', null, 'E5', null,
             'G5', 'B5', 'D6', 'B5', 'G5', null, 'F5', null],
      hat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      open: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    },
  ];

  const TEMPO_BPM = 152;
  const TEMPO_DISCO_BPM = 124;
  let STEP_SEC = 60 / TEMPO_BPM / 4; // 16-я нота — пересчитываем при смене режима
  const PATTERN_LEN = 16;
  let mode = 'chase'; // 'chase' | 'disco'
  let starBoost = false;

  let musicTimer = null;
  let stepIdx = 0;
  let patIdx = 0;
  let loopsInPattern = 0;
  let scheduledUpTo = 0;

  function refreshStepSec() {
    const bpm = mode === 'disco' ? TEMPO_DISCO_BPM : TEMPO_BPM;
    const mul = starBoost && window.G && window.G.config ? window.G.config.STAR_MUSIC_SPEED_MUL : 1;
    STEP_SEC = 60 / (bpm * mul) / 4;
  }

  function playStep(patternIdx, step, when) {
    const patterns = mode === 'disco' ? DISCO_PATTERNS : PATTERNS;
    const p = patterns[patternIdx % patterns.length];
    // Бас
    if (p.bass[step]) {
      if (mode === 'disco') {
        // В диско бас sine, чуть длиннее, с резким акцентом
        pluck(n(p.bass[step]), 0.20, 0.24, when, 'music');
      } else {
        pluck(n(p.bass[step]), 0.28, 0.20, when, 'music');
        pluck(n(p.bass[step]) * 2, 0.14, 0.07, when + 0.02, 'music');
      }
    }
    // Мелодия
    if (p.lead[step]) {
      if (mode === 'disco') {
        // Синтовый лид
        tone(n(p.lead[step]), 0.16, 'sawtooth', 0.07, when, null, 'music');
        tone(n(p.lead[step]) * 2, 0.12, 'square', 0.04, when, null, 'music');
      } else {
        tone(n(p.lead[step]), 0.18, 'square', 0.09, when, null, 'music');
        if (step === 7 || step === 15) {
          tone(n(p.lead[step]) * 0.95, 0.12, 'square', 0.04, when + 0.02, n(p.lead[step]) * 0.6, 'music');
        }
      }
    }
    // Hi-hat (закрытый)
    if (p.hat[step]) {
      noise(0.025, mode === 'disco' ? 0.035 : 0.04, 6000, when, 'music');
    }
    // Открытый хэт (только в диско)
    if (mode === 'disco' && p.open && p.open[step]) {
      noise(0.10, 0.05, 7000, when, 'music');
    }
    // Бочка — 4-on-floor (только в диско)
    if (mode === 'disco' && p.kick && p.kick[step]) {
      tone(110, 0.10, 'sine', 0.30, when, 50, 'music');
      noise(0.04, 0.10, 200, when, 'music');
    }
    // Clap
    if (p.clap[step]) {
      noise(0.07, mode === 'disco' ? 0.12 : 0.10, 1800, when, 'music');
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
    mode = 'chase';
    starBoost = false;
    refreshStepSec();
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

  function setMode(newMode) {
    if (newMode !== 'chase' && newMode !== 'disco') return;
    if (mode === newMode) return;
    mode = newMode;
    refreshStepSec();
    // Сбросить позицию паттерна, чтобы новая секция стартовала с начала
    stepIdx = 0;
    patIdx = 0;
    loopsInPattern = 0;
    if (ctx) scheduledUpTo = ctx.currentTime + 0.05;
  }

  function setStarBoost(active) {
    active = !!active;
    if (starBoost === active) return;
    starBoost = active;
    refreshStepSec();
    if (ctx) scheduledUpTo = ctx.currentTime + 0.05;
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
    music: { start: startMusic, stop: stopMusic, setVolume: setMusicVolume, setMode, setStarBoost },
  };
})();
