// Точка входа: машина состояний, меню, игровой цикл.
(function () {
  const G = window.G;
  const C = G.config;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  G.render.init();

  // Инициализация WebAudio при первом нажатии (требование браузера).
  function initAudioOnce() {
    if (G.audio) G.audio.init();
    window.removeEventListener('keydown', initAudioOnce);
    window.removeEventListener('mousedown', initAudioOnce);
  }
  window.addEventListener('keydown', initAudioOnce);
  window.addEventListener('mousedown', initAudioOnce);

  // ===== Mute-кнопка в правом верхнем углу (под инвентарём, чтобы не перекрывать) =====
  const MUTE_BTN = { x: C.CANVAS_W - 36, y: 36, w: 28, h: 28 };
  function isInsideMute(px, py) {
    return px >= MUTE_BTN.x && px <= MUTE_BTN.x + MUTE_BTN.w &&
           py >= MUTE_BTN.y && py <= MUTE_BTN.y + MUTE_BTN.h;
  }
  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return [x, y];
  }
  canvas.addEventListener('click', (e) => {
    const [x, y] = canvasCoords(e);
    if (isInsideMute(x, y)) {
      const next = !(G.audio && G.audio.isMuted && G.audio.isMuted());
      if (G.audio && G.audio.setMuted) G.audio.setMuted(next);
    }
  });
  // Клавиша M в нескольких местах уже занята «меню», поэтому отдельная — N (как «sound off»)
  // но проще: переключение через клавишу мыши/тап. Без отдельной горячей клавиши.

  // Ввод кода комнаты в NET_LOBBY_JOIN
  window.addEventListener('keydown', (e) => {
    if (state !== STATE.NET_LOBBY_JOIN) return;
    if (e.key === 'Backspace') {
      joinCodeBuffer = joinCodeBuffer.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key && e.key.length === 1) {
      const ch = e.key.toUpperCase();
      if (/[A-Z0-9]/.test(ch) && joinCodeBuffer.length < 8) {
        joinCodeBuffer += ch;
      }
    }
  });

  const STATE = {
    MENU: 'menu',
    MENU_NET: 'menu_net',
    NET_LOBBY_HOST: 'net_lobby_host',
    NET_LOBBY_JOIN: 'net_lobby_join',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover',
  };
  let state = STATE.MENU;
  let mode = 'cpu'; // 'cpu' | 'pvp' | 'net'
  let netRole = null; // 'host' | 'client'
  let netInputDevice = null;
  let menuChoice = 0;       // 0..2
  let netMenuChoice = 0;    // 0=host, 1=join
  let joinCodeBuffer = '';  // ввод кода для подключения
  let lobbyCode = '';       // код, который видит хост
  let lobbyStatus = '';     // текстовая подсказка в лобби
  let lobbyDisconnectMsg = ''; // сообщение «соперник отключился»
  let snapshotInterval = 0;
  let players = [];
  let trapManager = null;
  let pickupManager = null;
  let arenaEventManager = null;
  let ai = null;
  let winnerId = null;
  let time = 0;
  let matchTime = 0;

  function syncReactiveMusic() {
    if (!G.audio || !G.audio.music || !players.length) return;
    const anyDancing = players.some((p) => p.alive && p.dancing);
    const anyStar = players.some((p) => p.alive && p.starT > 0);
    if (G.audio.music.setMode) G.audio.music.setMode(anyDancing ? 'disco' : 'chase');
    if (G.audio.music.setStarBoost) G.audio.music.setStarBoost(anyStar);
  }

  function startMatch(chosenMode, opts = {}) {
    mode = chosenMode;
    netRole = opts.netRole || null;
    netInputDevice = null;
    trapManager = new G.TrapManager();
    pickupManager = new G.PickupManager();
    arenaEventManager = new G.ArenaEventManager();

    let p1Input, p2Input;
    if (mode === 'net') {
      // В сетевом режиме: хост — управляет p1 (Дворник) локально, p2 — по сети.
      // Клиент — управляет p2 (Енот) локально, p1 — по сети (но он не симулирует физику).
      netInputDevice = new G.net.NetInputDevice('remote');
      if (netRole === 'host') {
        p1Input = G.input.p1;
        p2Input = netInputDevice;
      } else {
        p1Input = netInputDevice;
        p2Input = G.input.p1; // клиент использует свою локальную WASD-схему
      }
      ai = null;
    } else if (mode === 'cpu') {
      p1Input = G.input.p1;
      ai = new G.AIController();
      p2Input = ai;
    } else {
      p1Input = G.input.p1;
      ai = null;
      p2Input = G.input.p2;
    }

    const p1 = new G.Player({
      id: 1, character: 'janitor',
      x: G.arena.spawn.p1.x, y: G.arena.spawn.p1.y,
      input: p1Input,
    });
    const p2 = new G.Player({
      id: 2, character: 'raccoon',
      x: G.arena.spawn.p2.x, y: G.arena.spawn.p2.y,
      input: p2Input,
    });

    players = [p1, p2];
    trapManager.setPlayers(players);
    pickupManager.setRefs(players, trapManager);
    G.trapManager = trapManager;
    G.pickupManager = pickupManager;
    G.arenaEvents = arenaEventManager;

    if (ai) ai.bind(p2, p1, trapManager, pickupManager);

    winnerId = null;
    snapshotInterval = 0;
    matchTime = 0;
    state = STATE.PLAYING;
    if (G.audio && G.audio.music) G.audio.music.start();
    syncReactiveMusic();
  }

  // Локальный игрок (для камеры/ввода) в сетевом режиме.
  function localNetPlayer() {
    if (!players.length) return null;
    return netRole === 'host' ? players[0] : players[1];
  }

  function returnToMenu() {
    state = STATE.MENU;
    players = [];
    trapManager = null;
    pickupManager = null;
    arenaEventManager = null;
    ai = null;
    netRole = null;
    netInputDevice = null;
    G.trapManager = null;
    G.pickupManager = null;
    G.arenaEvents = null;
    if (G.particles) G.particles.clear();
    if (G.audio && G.audio.music) G.audio.music.stop();
    if (G.net && G.net.disconnect) G.net.disconnect();
  }

  // ===== Сетевой обмен =====

  function onNetMessage(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'hello') {
      // ничего, просто handshake
      return;
    }
    if (msg.t === 'input' && netRole === 'host' && netInputDevice) {
      netInputDevice.applyInput(msg);
      return;
    }
    if (msg.t === 'snap' && netRole === 'client' && players.length === 2) {
      // Применить снапшот к клиенту
      if (msg.p) {
        players[0].applySnapshot(msg.p[0]);
        players[1].applySnapshot(msg.p[1]);
      }
      if (msg.tr && trapManager) trapManager.applySnapshot(msg.tr);
      if (msg.pk && pickupManager) pickupManager.applySnapshot(msg.pk);
      if (msg.ae && arenaEventManager) arenaEventManager.applySnapshot(msg.ae);
      if (msg.ev && G.net && G.net.applyEvents) G.net.applyEvents(msg.ev);
      if (typeof msg.time === 'number') time = msg.time;
      if (typeof msg.matchTime === 'number') matchTime = msg.matchTime;
      syncReactiveMusic();
      return;
    }
    if (msg.t === 'gameover' && netRole === 'client') {
      winnerId = msg.winnerId;
      state = STATE.GAMEOVER;
      if (G.audio && G.audio.music) G.audio.music.stop();
      return;
    }
    if (msg.t === 'pause' && netRole === 'client') {
      if (msg.paused) {
        state = STATE.PAUSED;
        if (G.audio && G.audio.music) G.audio.music.stop();
      } else {
        state = STATE.PLAYING;
        if (G.audio && G.audio.music) G.audio.music.start();
      }
      return;
    }
    if (msg.t === 'pauseRequest' && netRole === 'host') {
      if (msg.paused && state === STATE.PLAYING) {
        state = STATE.PAUSED;
        if (G.audio && G.audio.music) G.audio.music.stop();
        G.net.send({ t: 'pause', paused: true });
      } else if (!msg.paused && state === STATE.PAUSED) {
        state = STATE.PLAYING;
        if (G.audio && G.audio.music) G.audio.music.start();
        G.net.send({ t: 'pause', paused: false });
      }
      return;
    }
  }

  function onNetClose(reason) {
    lobbyDisconnectMsg = 'Соперник отключился';
    if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.GAMEOVER) {
      // Возврат в меню с сообщением через короткую паузу
      setTimeout(() => returnToMenu(), 1500);
    } else {
      // На лобби-экранах сразу возвращаемся
      lobbyStatus = 'Ошибка соединения. Esc — назад';
    }
  }

  function startHosting() {
    lobbyDisconnectMsg = '';
    lobbyStatus = 'Регистрация комнаты...';
    state = STATE.NET_LOBBY_HOST;
    G.net.host({
      onReady: (code) => {
        lobbyCode = code;
        lobbyStatus = 'Жду друга...';
      },
      onConnect: () => {
        // Клиент подключился — стартуем матч
        G.net.send({ t: 'hello', v: G.net.PROTOCOL_VERSION });
        startMatch('net', { netRole: 'host' });
      },
      onMessage: onNetMessage,
      onClose: onNetClose,
      onError: (err) => {
        lobbyStatus = 'Ошибка: ' + (err && err.type ? err.type : err);
      },
    });
  }

  function startJoining() {
    if (joinCodeBuffer.length < 4) {
      lobbyStatus = 'Введите код (мин. 4 символа)';
      return;
    }
    lobbyDisconnectMsg = '';
    lobbyStatus = 'Подключаюсь...';
    G.net.join(joinCodeBuffer, {
      onReady: () => { lobbyStatus = 'Подключено, жду старта...'; },
      onConnect: () => {
        G.net.send({ t: 'hello', v: G.net.PROTOCOL_VERSION });
        startMatch('net', { netRole: 'client' });
      },
      onMessage: onNetMessage,
      onClose: onNetClose,
      onError: (err) => {
        const t = err && err.type ? err.type : '';
        if (t === 'peer-unavailable') lobbyStatus = 'Комнаты с таким кодом нет';
        else lobbyStatus = 'Ошибка: ' + (t || err);
      },
    });
  }

  // --- Game loop с фиксированным timestep ---

  let lastT = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  let fpsT = 0;
  let fpsCount = 0;
  let fps = 0;

  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.25) dt = 0.25;

    fpsT += dt; fpsCount++;
    if (fpsT >= 1) { fps = fpsCount; fpsCount = 0; fpsT = 0; }

    acc += dt;
    while (acc >= STEP) {
      tick(STEP);
      acc -= STEP;
      G.input.consumeAll();
    }

    draw();
    requestAnimationFrame(frame);
  }

  function tick(dt) {
    time += dt;

    if (state === STATE.MENU) {
      const total = 3;
      if (G.input.sys.wasPressed('mode1')) { startMatch('cpu'); return; }
      if (G.input.sys.wasPressed('mode2')) { startMatch('pvp'); return; }
      if (G.input.sys.wasPressed('mode3')) { state = STATE.MENU_NET; netMenuChoice = 0; return; }
      if (G.input.p1.wasPressed('up') || G.input.p2.wasPressed('up')) {
        menuChoice = (menuChoice - 1 + total) % total;
      }
      if (G.input.p1.wasPressed('down') || G.input.p2.wasPressed('down')) {
        menuChoice = (menuChoice + 1) % total;
      }
      if (G.input.sys.wasPressed('confirm') || G.input.p1.wasPressed('place') || G.input.p2.wasPressed('place')) {
        if (menuChoice === 0) startMatch('cpu');
        else if (menuChoice === 1) startMatch('pvp');
        else { state = STATE.MENU_NET; netMenuChoice = 0; }
      }
      return;
    }

    if (state === STATE.MENU_NET) {
      if (G.input.sys.wasPressed('menu') || G.input.sys.wasPressed('pause')) {
        state = STATE.MENU; return;
      }
      if (G.input.p1.wasPressed('up') || G.input.p1.wasPressed('down') ||
          G.input.p2.wasPressed('up') || G.input.p2.wasPressed('down')) {
        netMenuChoice = (netMenuChoice + 1) % 2;
      }
      if (G.input.sys.wasPressed('confirm') || G.input.p1.wasPressed('place') || G.input.p2.wasPressed('place')) {
        if (netMenuChoice === 0) {
          startHosting();
        } else {
          joinCodeBuffer = '';
          lobbyStatus = 'Введите код комнаты и нажмите Enter';
          state = STATE.NET_LOBBY_JOIN;
        }
      }
      return;
    }

    if (state === STATE.NET_LOBBY_HOST) {
      if (G.input.sys.wasPressed('menu') || G.input.sys.wasPressed('pause')) {
        if (G.net) G.net.disconnect();
        state = STATE.MENU_NET;
      }
      return;
    }

    if (state === STATE.NET_LOBBY_JOIN) {
      // M здесь — это буква в коде, а не «выход в меню». Только Esc выходит.
      if (G.input.sys.wasPressed('pause')) {
        state = STATE.MENU_NET; return;
      }
      if (G.input.sys.wasPressed('confirm')) { startJoining(); }
      return;
    }

    if (state === STATE.PLAYING) {
      // Пауза — обе стороны могут запросить, но истинная пауза идёт через хоста.
      if (G.input.sys.wasPressed('pause')) {
        if (mode === 'net' && netRole === 'client') {
          // Клиент: попросить хоста поставить паузу
          G.net.send({ t: 'pauseRequest', paused: true });
        } else {
          state = STATE.PAUSED;
          if (G.audio && G.audio.music) G.audio.music.stop();
          if (mode === 'net' && netRole === 'host') {
            G.net.send({ t: 'pause', paused: true });
          }
          return;
        }
      }
      if (G.input.sys.wasPressed('menu'))  { returnToMenu(); return; }
      if (mode === 'net' && netRole === 'client') {
        // Клиент: только косметика и пересылка ввода
        if (G.particles) G.particles.update(dt);
        if (G.render && G.render.updateShake) G.render.updateShake(dt);
        for (const pk of (pickupManager ? pickupManager.list : [])) pk.animT += dt;

        // Собрать ввод и отправить хосту (только при изменении или каждые ~3 кадра)
        const local = G.input.p1;
        const actions = {
          up: local.isDown('up'), down: local.isDown('down'),
          left: local.isDown('left'), right: local.isDown('right'),
          place: local.isDown('place'),
          switchNext: local.isDown('switchNext'),
          switchPrev: local.isDown('switchPrev'),
        };
        const justPressed = [];
        for (const a of ['place', 'switchNext', 'switchPrev']) {
          if (local.wasPressed(a)) justPressed.push(a);
        }
        G.net.send({ t: 'input', actions, justPressed });
        return;
      }

      // Хост (или локальные режимы) — обычный tick
      matchTime += dt;
      if (ai) ai.update(dt);
      for (const p of players) p.update(dt, trapManager);
      // На хосте: после player.update нужно сбросить justPressed у NetInputDevice,
      // иначе клиентское нажатие будет повторяться каждый тик.
      if (netInputDevice && netInputDevice.consume) netInputDevice.consume();

      // Star touch damage: игрок со звездой при касании другого наносит урон
      for (const p of players) {
        if (!p.alive || p.starT <= 0) continue;
        for (const q of players) {
          if (q.id === p.id || !q.alive) continue;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          if (dx * dx + dy * dy < C.PLAYER_HITBOX * C.PLAYER_HITBOX) {
            if (p.starTouchT <= 0) {
              if (q.damage(1)) {
                p.starT = 0;
                p.starTouchT = 0;
                if (G.fx) {
                  G.fx.particles('burstStars', q.x, q.y - 12);
                  G.fx.shake(3, 0.12);
                }
              }
            }
          }
        }
      }

      trapManager.update(dt);
      pickupManager.update(dt);
      if (arenaEventManager) arenaEventManager.update(dt, players, trapManager, pickupManager);
      if (G.particles) G.particles.update(dt);
      if (G.render && G.render.updateShake) G.render.updateShake(dt);
      syncReactiveMusic();

      // Хост шлёт снапшот каждый тик (60Hz) — для плавной анимации клиента
      if (mode === 'net' && netRole === 'host') {
        G.net.send({
          t: 'snap',
          time,
          matchTime,
          p: players.map(p => p.serialize()),
          tr: trapManager.serialize(),
          pk: pickupManager.serialize(),
          ae: arenaEventManager ? arenaEventManager.serialize() : null,
          ev: G.net.flushEvents(),
        });
      }

      // Условие победы
      const dead = players.filter((p) => !p.alive);
      if (dead.length > 0) {
        const alive = players.filter((p) => p.alive);
        winnerId = alive.length === 1 ? alive[0].id : 0;
        state = STATE.GAMEOVER;
        if (mode === 'net' && netRole === 'host') {
          G.net.send({ t: 'gameover', winnerId });
        }
        if (G.audio && G.audio.music) G.audio.music.stop();
      }
      return;
    }

    if (state === STATE.PAUSED) {
      if (G.input.sys.wasPressed('pause')) {
        if (mode === 'net' && netRole === 'client') {
          // Клиент: попросить хоста снять паузу
          G.net.send({ t: 'pauseRequest', paused: false });
        } else {
          state = STATE.PLAYING;
          if (G.audio && G.audio.music) G.audio.music.start();
          if (mode === 'net' && netRole === 'host') {
            G.net.send({ t: 'pause', paused: false });
          }
          return;
        }
      }
      if (G.input.sys.wasPressed('menu'))  { returnToMenu(); return; }
      return;
    }

    if (state === STATE.GAMEOVER) {
      if (G.input.sys.wasPressed('menu'))    { returnToMenu(); return; }
      if (mode !== 'net') {
        if (G.input.sys.wasPressed('restart')) { startMatch(mode); return; }
        if (G.input.sys.wasPressed('confirm')) { startMatch(mode); return; }
      }
      return;
    }
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    if (state === STATE.MENU) {
      drawMenu();
    } else if (state === STATE.MENU_NET) {
      drawNetSubmenu();
    } else if (state === STATE.NET_LOBBY_HOST) {
      drawNetLobbyHost();
    } else if (state === STATE.NET_LOBBY_JOIN) {
      drawNetLobbyJoin();
    } else {
      // PLAYING / PAUSED / GAMEOVER
      if (mode === 'net') {
        const me = localNetPlayer();
        if (me) G.render.drawSingleScreen(ctx, me, players, trapManager, pickupManager, time, matchTime, arenaEventManager);
      } else {
        G.render.drawSplitScreen(ctx, players, trapManager, pickupManager, time, matchTime, arenaEventManager);
      }
      if (state === STATE.PAUSED)   drawPaused();
      if (state === STATE.GAMEOVER) drawGameOver();
    }

    // FPS-счётчик в правом нижнем углу
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(C.CANVAS_W - 52, C.CANVAS_H - 14, 52, 14);
    ctx.fillStyle = '#9f9';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('FPS ' + fps, C.CANVAS_W - 46, C.CANVAS_H - 12);

    // Mute-кнопка в правом верхнем углу
    drawMuteButton();
  }

  function drawMuteButton() {
    const muted = !!(G.audio && G.audio.isMuted && G.audio.isMuted());
    const x = MUTE_BTN.x, y = MUTE_BTN.y;
    ctx.fillStyle = muted ? 'rgba(140,40,40,0.85)' : 'rgba(20,20,20,0.85)';
    ctx.fillRect(x, y, MUTE_BTN.w, MUTE_BTN.h);
    ctx.strokeStyle = muted ? '#ff8080' : '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, MUTE_BTN.w - 1, MUTE_BTN.h - 1);
    // Динамик: трапеция + волны
    ctx.fillStyle = muted ? '#fff' : '#fff060';
    // Корпус
    ctx.fillRect(x + 6, y + 11, 3, 6);
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 11);
    ctx.lineTo(x + 14, y + 7);
    ctx.lineTo(x + 14, y + 21);
    ctx.lineTo(x + 9, y + 17);
    ctx.closePath();
    ctx.fill();
    if (!muted) {
      // Звуковые волны
      ctx.strokeStyle = '#fff060';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 14, y + 14, 4, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 14, y + 14, 7, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    } else {
      // Крестик
      ctx.strokeStyle = '#ff8080';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 17, y + 9);
      ctx.lineTo(x + 23, y + 19);
      ctx.moveTo(x + 23, y + 9);
      ctx.lineTo(x + 17, y + 19);
      ctx.stroke();
    }
  }

  function drawMenu() {
    ctx.fillStyle = '#244';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Декоративные тайлы пола внизу
    for (let x = 0; x < C.ARENA_W; x++) {
      ctx.drawImage(G.tiles.floor, x * C.TILE, C.CANVAS_H - C.TILE);
      ctx.drawImage(G.tiles.floor, x * C.TILE, C.CANVAS_H - 2 * C.TILE);
    }

    const cx = C.CANVAS_W / 2;

    // Превью персонажей
    ctx.drawImage(G.sprites.janitor.down[0], cx - 144, 140, 96, 96);
    ctx.drawImage(G.sprites.raccoon.down[0], cx + 58, 150, 77, 77);
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe060';
    ctx.fillText('ДВОРНИК', cx - 96, 250);
    ctx.fillStyle = '#a0e0ff';
    ctx.fillText('ЕНОТ', cx + 96, 250);

    // Заголовок
    ctx.fillStyle = '#222';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('СВАЛКУС', cx + 2, 70);
    ctx.fillStyle = '#fff060';
    ctx.fillText('СВАЛКУС', cx, 68);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Ловушки во дворе. Кто первым потеряет 5 жизней — проиграл.', cx, 108);

    // Опции
    const opts = [
      ['1', '1P vs CPU', '— один игрок против компьютера'],
      ['2', '2P Hot Seat', '— два игрока за одной клавиатурой'],
      ['3', 'По сети', '— игра с другом через интернет'],
    ];
    for (let i = 0; i < opts.length; i++) {
      const y = 290 + i * 40;
      const sel = menuChoice === i;
      ctx.fillStyle = sel ? '#fff060' : '#888';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText((sel ? '> ' : '  ') + opts[i][0] + '. ' + opts[i][1], cx - 192, y);
      ctx.fillStyle = sel ? '#fff' : '#666';
      ctx.font = '12px monospace';
      ctx.fillText(opts[i][2], cx - 144, y + 18);
    }

    // Подсказки
    ctx.font = '12px monospace';
    ctx.fillStyle = '#9c9';
    ctx.textAlign = 'center';
    ctx.fillText('Управление 1: WASD движение, F поставить, Q/E переключить', cx, 470);
    ctx.fillStyle = '#9cc';
    ctx.fillText('Управление 2: стрелки, «,» переключить, «.» поставить', cx, 488);
    ctx.fillStyle = '#ccc';
    ctx.fillText('Enter / 1 / 2 / 3 — старт.  Esc — пауза.  M — в меню.  R — рестарт.', cx, 520);
  }

  function drawNetSubmenu() {
    ctx.fillStyle = '#244';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const cx = C.CANVAS_W / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#222';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('ПО СЕТИ', cx + 2, 80);
    ctx.fillStyle = '#fff060';
    ctx.fillText('ПО СЕТИ', cx, 78);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Создайте комнату или подключитесь к другу по коду', cx, 130);

    const opts = [
      ['Создать комнату',   'Хост: получит код, ждёт друга. Управляет ДВОРНИКОМ.'],
      ['Войти в комнату',   'Клиент: вводит код от друга. Управляет ЕНОТОМ.'],
    ];
    for (let i = 0; i < opts.length; i++) {
      const y = 240 + i * 60;
      const sel = netMenuChoice === i;
      ctx.fillStyle = sel ? '#fff060' : '#888';
      ctx.font = 'bold 22px monospace';
      ctx.fillText((sel ? '> ' : '  ') + opts[i][0], cx, y);
      ctx.fillStyle = sel ? '#fff' : '#666';
      ctx.font = '13px monospace';
      ctx.fillText(opts[i][1], cx, y + 26);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#9c9';
    ctx.fillText('Стрелки/W/S — выбор, Enter — подтвердить, Esc — назад', cx, 500);
    if (lobbyDisconnectMsg) {
      ctx.fillStyle = '#ff8060';
      ctx.fillText(lobbyDisconnectMsg, cx, 530);
    }
  }

  function drawNetLobbyHost() {
    ctx.fillStyle = '#244';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    const cx = C.CANVAS_W / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#fff060';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('КОМНАТА СОЗДАНА', cx, 80);

    ctx.fillStyle = '#ddd';
    ctx.font = '14px monospace';
    ctx.fillText('Скиньте этот код другу:', cx, 150);

    // Большой код
    if (lobbyCode) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(cx - 200, 200, 400, 100);
      ctx.strokeStyle = '#fff060';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 200, 200, 400, 100);
      ctx.fillStyle = '#fff060';
      ctx.font = 'bold 56px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(lobbyCode, cx, 250);
      ctx.textBaseline = 'top';
    } else {
      ctx.fillStyle = '#aaa';
      ctx.font = '20px monospace';
      ctx.fillText('...', cx, 240);
    }

    ctx.fillStyle = '#a0e0ff';
    ctx.font = '16px monospace';
    ctx.fillText(lobbyStatus || 'Жду друга...', cx, 340);

    ctx.fillStyle = '#9c9';
    ctx.font = '12px monospace';
    ctx.fillText('Друг: открывает тот же URL → «По сети» → «Войти в комнату» → код', cx, 420);
    ctx.fillText('Esc — отменить и вернуться', cx, 450);
  }

  function drawNetLobbyJoin() {
    ctx.fillStyle = '#244';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    const cx = C.CANVAS_W / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#fff060';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('ВВЕДИТЕ КОД КОМНАТЫ', cx, 80);

    ctx.fillStyle = '#ddd';
    ctx.font = '14px monospace';
    ctx.fillText('Друг прислал вам короткий код. Наберите его на клавиатуре.', cx, 150);

    // Поле ввода
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 200, 200, 400, 100);
    ctx.strokeStyle = '#a0e0ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 200, 200, 400, 100);
    ctx.fillStyle = '#a0e0ff';
    ctx.font = 'bold 56px monospace';
    ctx.textBaseline = 'middle';
    const cursor = (Math.floor(time * 2) % 2) ? '_' : ' ';
    ctx.fillText(joinCodeBuffer + cursor, cx, 250);
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#a0e0ff';
    ctx.font = '16px monospace';
    ctx.fillText(lobbyStatus || 'Введите код и нажмите Enter', cx, 340);

    ctx.fillStyle = '#9c9';
    ctx.font = '12px monospace';
    ctx.fillText('Enter — подключиться, Backspace — стереть, Esc — назад', cx, 420);
  }

  function drawPaused() {
    const cx = C.CANVAS_W / 2;
    // Тёмная подложка
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Заголовок
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#222';
    ctx.fillText('ПАУЗА', cx + 2, 30);
    ctx.fillStyle = '#fff060';
    ctx.fillText('ПАУЗА', cx, 28);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Краткие правила. Esc — продолжить, M — в меню', cx, 76);

    // Заголовок раздела
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#a0e0ff';
    ctx.fillText('ЛОВУШКИ', cx, 108);

    // Список ловушек: иконка + название + описание
    const rules = [
      {
        type: 'mousetrap',
        name: 'Мышеловка',
        desc: 'Срабатывает при наступании: урон 1, ломается. До 3 в инвентаре.',
      },
      {
        type: 'puddle',
        name: 'Лужа',
        desc: 'Скольжение в направлении движения, без урона. Лежит 8 сек. До 3 в инвентаре.',
      },
      {
        type: 'firecracker',
        name: 'Петарда',
        desc: 'Фитиль 0.735 сек, взрыв в радиусе 3 тайла, урон 1. До 3 в инвентаре.',
      },
      {
        type: 'trapdoor',
        name: 'Люк',
        desc: 'Невидим противнику. Урон 1 + проваливает на 2 сек. До 3 в инвентаре.',
      },
      {
        type: 'banana',
        name: 'Банановая кожура',
        desc: 'Бросок на 3 тайла вперёд. Урон 1 + длинное скольжение без управления. До 3 в инвентаре.',
      },
    ];

    const startY = 138;
    const rowH = 56;
    const iconSize = 40;
    const leftX = cx - 320;
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const y = startY + i * rowH;
      // Подложка строки
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(leftX - 8, y - 4, 640, rowH - 4);
      // Иконка
      const sprite = G.sprites.traps[r.type];
      if (sprite) ctx.drawImage(sprite, leftX, y, iconSize, iconSize);
      // Название
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#ffe060';
      ctx.fillText(r.name, leftX + iconSize + 14, y + 4);
      // Описание
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ddd';
      ctx.fillText(r.desc, leftX + iconSize + 14, y + 24);
    }

    // Подсказка по управлению снизу
    ctx.textAlign = 'center';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#9c9';
    const baseY = startY + rules.length * rowH + 14;
    ctx.fillText('Управление 1 (Дворник): WASD движение, F поставить, Q/E переключить', cx, baseY);
    ctx.fillStyle = '#9cc';
    ctx.fillText('Управление 2 (Енот): стрелки, «.» поставить, «,» переключить', cx, baseY + 18);
    ctx.fillStyle = '#ccc';
    ctx.fillText('Получил 5 ударов — проиграл. Активных ловушек одновременно: до 10.', cx, baseY + 40);
    ctx.fillStyle = '#a0e0ff';
    ctx.fillText('После 120 сек наступает ночь на 60 сек: динамика видна только в луче фонарика.', cx, baseY + 62);
    ctx.fillStyle = '#ffe060';
    ctx.fillText('Алмаз дворника и пицца енота притягивают соперника через всю карту.', cx, baseY + 84);
  }

  function drawOverlay(title, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(title, C.CANVAS_W / 2, C.CANVAS_H / 2 - 8);
    ctx.font = '12px monospace';
    ctx.fillText(sub, C.CANVAS_W / 2, C.CANVAS_H / 2 + 18);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px monospace';
    let title;
    if (winnerId === 1) title = 'ПОБЕДИЛ ДВОРНИК!';
    else if (winnerId === 2) title = 'ПОБЕДИЛ ЕНОТ!';
    else title = 'НИЧЬЯ!';
    ctx.fillStyle = '#222';
    ctx.fillText(title, C.CANVAS_W / 2 + 2, C.CANVAS_H / 2 - 6);
    ctx.fillStyle = '#fff060';
    ctx.fillText(title, C.CANVAS_W / 2, C.CANVAS_H / 2 - 8);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#fff';
    const hint = mode === 'net'
      ? 'M — в меню'
      : 'R — рестарт, M — в меню';
    ctx.fillText(hint, C.CANVAS_W / 2, C.CANVAS_H / 2 + 20);
  }

  requestAnimationFrame(frame);
})();
