// Сетевой модуль: WebRTC через PeerJS, host-authoritative протокол.
// Хост держит "истинное" состояние и шлёт снапшоты + события клиенту.
// Клиент шлёт свой ввод хосту.
(function () {
  const G = (window.G = window.G || {});

  const PROTOCOL_VERSION = 1;
  const ROOM_PREFIX = 'tjvse-'; // префикс к коду чтобы не пересекаться с чужими peer-id
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без 0/O/1/I/L
  const CONNECT_TIMEOUT_MS = 20000;
  const PEER_OPEN_TIMEOUT_MS = 10000;
  const PEER_OPEN_ATTEMPTS = 3;
  const PEER_RETRY_DELAYS = [0, 900, 1800];
  const OPENRELAY_AUTH = {
    username: 'openrelayproject',
    credential: 'openrelayproject',
  };

  function generateCode(len = 6) {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return s;
  }

  // NetInputDevice — тот же интерфейс, что у InputDevice/AIController.
  // Для use на стороне хоста (отзеркаливает ввод от клиента).
  class NetInputDevice {
    constructor(name = 'net') {
      this.name = name;
      this.state = {};
      this.justPressed = {};
    }
    isDown(a) { return !!this.state[a]; }
    wasPressed(a) { return !!this.justPressed[a]; }
    consume() { this.justPressed = {}; }
    applyInput(msg) {
      if (msg.actions) this.state = msg.actions;
      if (msg.justPressed) {
        for (const a of msg.justPressed) this.justPressed[a] = true;
      }
    }
  }

  // Состояние модуля
  let peer = null;
  let conn = null;
  let role = null; // 'host' | 'client' | null
  let roomCode = null;
  let onMessageCb = null;
  let onClosedCb = null;
  let onConnectedCb = null;
  let lastError = null;
  let connReady = false;
  let sessionToken = 0;

  function normalizePeerError(err, fallback = 'network') {
    if (!err) return { type: fallback };
    if (typeof err === 'string') return { type: err };
    if (!err.type) err.type = fallback;
    return err;
  }

  function isRetryablePeerError(err) {
    const t = (err && err.type ? err.type : '').toLowerCase();
    return t === 'network' || t === 'server-error' || t === 'socket-error' ||
      t === 'socket-closed' || t === 'disconnected' || t === 'timeout';
  }

  function peerServerOptionsFromUrl() {
    try {
      const qs = new URLSearchParams(window.location.search);
      const host = qs.get('peerHost');
      if (!host) return {};
      const opts = { host };
      const port = parseInt(qs.get('peerPort') || '', 10);
      if (Number.isFinite(port)) opts.port = port;
      const path = qs.get('peerPath');
      if (path) opts.path = path;
      const key = qs.get('peerKey');
      if (key) opts.key = key;
      const secure = qs.get('peerSecure');
      if (secure != null) opts.secure = secure !== '0' && secure !== 'false';
      return opts;
    } catch (e) {
      return {};
    }
  }

  function closePeerOnly() {
    const oldConn = conn;
    const oldPeer = peer;
    conn = null;
    peer = null;
    connReady = false;
    try { if (oldConn) oldConn.close(); } catch (e) {}
    try { if (oldPeer) oldPeer.destroy(); } catch (e) {}
  }

  function ensurePeer(id) {
    if (typeof Peer === 'undefined') {
      throw new Error('PeerJS не загружен. Проверь интернет и CDN-скрипт в index.html.');
    }
    return new Peer(id, {
      ...peerServerOptionsFromUrl(),
      debug: 3,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.relay.metered.ca:80' },
          { urls: 'stun:openrelay.metered.ca:80' },
          // Бесплатный TURN от openrelayproject — fallback при симметричном NAT
          {
            urls: 'turn:openrelay.metered.ca:80',
            ...OPENRELAY_AUTH,
          },
          {
            urls: 'turn:openrelay.metered.ca:80?transport=tcp',
            ...OPENRELAY_AUTH,
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            ...OPENRELAY_AUTH,
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            ...OPENRELAY_AUTH,
          },
        ],
      },
    });
  }

  function openPeerWithRetry(idForAttempt, hooks) {
    const token = ++sessionToken;
    let attempt = 0;

    const launch = () => {
      if (token !== sessionToken) return;
      closePeerOnly();

      const id = idForAttempt(attempt);
      let p = null;
      try {
        p = ensurePeer(id);
        peer = p;
      } catch (err) {
        lastError = normalizePeerError(err);
        if (hooks.onError) hooks.onError(lastError);
        return;
      }

      if (hooks.onAttempt) hooks.onAttempt(attempt + 1, PEER_OPEN_ATTEMPTS, id);
      if (hooks.attach) hooks.attach(p, token);

      let opened = false;
      let settled = false;
      const timer = setTimeout(() => {
        handleOpenFailure({ type: 'timeout', message: 'PeerJS open timeout' });
      }, PEER_OPEN_TIMEOUT_MS);

      const retryOrFail = (err) => {
        if (settled) return;
        settled = true;
        lastError = normalizePeerError(err);
        closePeerOnly();
        if (isRetryablePeerError(lastError) && attempt < PEER_OPEN_ATTEMPTS - 1) {
          attempt++;
          if (hooks.onRetry) hooks.onRetry(attempt + 1, PEER_OPEN_ATTEMPTS, lastError);
          setTimeout(launch, PEER_RETRY_DELAYS[attempt] || 1000);
          return;
        }
        if (hooks.onError) hooks.onError(lastError);
      };

      function handleOpenFailure(err) {
        if (token !== sessionToken || opened || settled) return;
        clearTimeout(timer);
        retryOrFail(err);
      }

      function handlePostOpenProblem(err) {
        if (token !== sessionToken || settled) return;
        lastError = normalizePeerError(err);
        if (!connReady && isRetryablePeerError(lastError)) {
          clearTimeout(timer);
          retryOrFail(lastError);
          return;
        }
        settled = true;
        if (hooks.onError) hooks.onError(lastError);
      }

      p.on('open', (openedId) => {
        if (token !== sessionToken || settled) return;
        opened = true;
        clearTimeout(timer);
        if (hooks.onOpen) hooks.onOpen(openedId, p, token);
      });
      p.on('error', (err) => {
        if (!opened) handleOpenFailure(err);
        else handlePostOpenProblem(err);
      });
      p.on('disconnected', () => {
        const err = { type: 'network', message: 'PeerJS signaling disconnected' };
        if (!opened) handleOpenFailure(err);
        else handlePostOpenProblem(err);
      });
    };

    launch();
    return token;
  }

  function setupConn(c) {
    conn = c;
    connReady = false;
    // Diagnostic: log ICE state changes
    try {
      const pc = c.peerConnection;
      if (pc) {
        pc.addEventListener('iceconnectionstatechange', () => {
          console.log('[net] iceConnectionState =', pc.iceConnectionState);
        });
        pc.addEventListener('icegatheringstatechange', () => {
          console.log('[net] iceGatheringState =', pc.iceGatheringState);
        });
        pc.addEventListener('icecandidate', (ev) => {
          if (ev.candidate) {
            console.log('[net] candidate:', ev.candidate.candidate);
          } else {
            console.log('[net] candidate: end-of-candidates');
          }
        });
        pc.addEventListener('icecandidateerror', (ev) => {
          console.warn('[net] icecandidateerror:', ev.url, 'code', ev.errorCode, ev.errorText);
        });
      } else {
        // PeerJS sometimes lazily creates peerConnection — try again on signal
        c.on('iceStateChanged', (s) => console.log('[net] (peerjs) iceStateChanged =', s));
      }
    } catch (e) { console.warn('[net] cannot attach diagnostics:', e); }
    conn.on('data', (data) => {
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return; }
      if (onMessageCb) onMessageCb(data);
    });
    conn.on('close', () => {
      if (conn !== c) return;
      if (onClosedCb) onClosedCb('peer closed');
      teardown();
    });
    conn.on('error', (err) => {
      if (conn !== c) return;
      lastError = err;
      if (onClosedCb) onClosedCb('error: ' + err.type);
      teardown();
    });
  }

  function waitForOpen(c, onOpen, onTimeout) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timeout);
      connReady = true;
      onOpen();
    };
    const fail = () => {
      if (done) return;
      done = true;
      clearInterval(poll);
      const err = { type: 'timeout' };
      lastError = err;
      if (onTimeout) onTimeout(err);
    };
    const poll = setInterval(() => {
      if (c.open) finish();
    }, 100);
    const timeout = setTimeout(fail, CONNECT_TIMEOUT_MS);
    c.on('open', finish);
    c.on('error', (err) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timeout);
      lastError = err;
      if (onTimeout) onTimeout(err);
    });
    if (c.open) finish();
  }

  function host(opts) {
    if (peer) disconnect();
    role = 'host';
    onMessageCb = opts.onMessage || null;
    onClosedCb = opts.onClose || null;
    onConnectedCb = opts.onConnect || null;
    lastError = null;
    roomCode = (opts.code || generateCode()).toUpperCase();
    const id = ROOM_PREFIX + roomCode;
    openPeerWithRetry(
      () => id,
      {
        onAttempt: (n, max) => {
          if (opts.onAttempt) opts.onAttempt(n, max, lastError);
        },
        onRetry: (n, max, err) => {
          if (opts.onRetry) opts.onRetry(n, max, err);
        },
        attach: (p, token) => {
          p.on('connection', (c) => {
            if (token !== sessionToken) {
              c.close(); return;
            }
            if (conn) {
              c.close(); return; // только 1 клиент
            }
            setupConn(c);
            if (opts.onPending) opts.onPending();
            waitForOpen(
              c,
              () => { if (onConnectedCb) onConnectedCb(); },
              (err) => { if (opts.onError) opts.onError(err); }
            );
          });
        },
        onOpen: () => {
          if (opts.onReady) opts.onReady(roomCode);
        },
        onError: (err) => {
          lastError = normalizePeerError(err);
          if (opts.onError) opts.onError(lastError);
        },
      }
    );
    return roomCode;
  }

  function makeClientId(code, attempt = 0) {
    return ROOM_PREFIX + code + '-c-' + attempt + '-' + Math.random().toString(36).slice(2, 7);
  }

  function join(code, opts) {
    if (peer) disconnect();
    role = 'client';
    onMessageCb = opts.onMessage || null;
    onClosedCb = opts.onClose || null;
    onConnectedCb = opts.onConnect || null;
    lastError = null;
    roomCode = code.toUpperCase();
    const targetId = ROOM_PREFIX + roomCode;
    openPeerWithRetry(
      (attempt) => makeClientId(roomCode, attempt),
      {
        onAttempt: (n, max) => {
          if (opts.onAttempt) opts.onAttempt(n, max, lastError);
        },
        onRetry: (n, max, err) => {
          if (opts.onRetry) opts.onRetry(n, max, err);
        },
        onOpen: () => {
          const c = peer.connect(targetId, { reliable: true });
          setupConn(c);
          waitForOpen(
            c,
            () => {
              if (onConnectedCb) onConnectedCb();
              if (opts.onReady) opts.onReady(roomCode);
            },
            (err) => {
              lastError = normalizePeerError(err, 'timeout');
              if (opts.onError) opts.onError(lastError);
            }
          );
        },
        onError: (err) => {
          lastError = normalizePeerError(err);
          if (opts.onError) opts.onError(lastError);
        },
      }
    );
  }

  function send(msg) {
    if (!conn || !conn.open) return false;
    try {
      conn.send(msg);
      return true;
    } catch (e) {
      return false;
    }
  }

  function teardown() {
    sessionToken++;
    const oldConn = conn;
    const oldPeer = peer;
    conn = null;
    peer = null;
    role = null;
    roomCode = null;
    connReady = false;
    try { if (oldConn) oldConn.close(); } catch (e) {}
    try { if (oldPeer) oldPeer.destroy(); } catch (e) {}
  }

  function disconnect() {
    teardown();
  }

  function isHost() { return role === 'host'; }
  function isClient() { return role === 'client'; }
  function isConnected() { return !!(conn && conn.open && connReady); }
  function getRole() { return role; }
  function getCode() { return roomCode; }
  function getError() { return lastError; }

  // ===== FX-обёртка =====
  // Запускает локальный эффект и (если host) — буферит для отправки клиенту.
  let pendingEvents = [];

  function fxAudio(name) {
    if (G.audio) G.audio.play(name);
    if (role === 'host') pendingEvents.push({ k: 'a', n: name });
  }
  function fxShake(intensity, dur) {
    if (G.render && G.render.shake) G.render.shake(intensity, dur);
    if (role === 'host') pendingEvents.push({ k: 's', i: intensity, d: dur });
  }
  function fxParticles(method, ...args) {
    if (G.particles && G.particles[method]) G.particles[method](...args);
    if (role === 'host') pendingEvents.push({ k: 'p', m: method, a: args });
  }
  function flushEvents() {
    const e = pendingEvents;
    pendingEvents = [];
    return e;
  }
  function applyEvents(events) {
    if (!events) return;
    for (const ev of events) {
      if (ev.k === 'a' && G.audio) G.audio.play(ev.n);
      else if (ev.k === 's' && G.render && G.render.shake) G.render.shake(ev.i, ev.d);
      else if (ev.k === 'p' && G.particles && G.particles[ev.m]) G.particles[ev.m](...ev.a);
    }
  }

  G.fx = { audio: fxAudio, shake: fxShake, particles: fxParticles };

  G.net = {
    PROTOCOL_VERSION,
    NetInputDevice,
    host, join, send, disconnect,
    generateCode,
    isHost, isClient, isConnected, getRole, getCode, getError,
    flushEvents, applyEvents,
  };
})();
