// Сетевой модуль: WebRTC через PeerJS, host-authoritative протокол.
// Хост держит "истинное" состояние и шлёт снапшоты + события клиенту.
// Клиент шлёт свой ввод хосту.
(function () {
  const G = (window.G = window.G || {});

  const PROTOCOL_VERSION = 1;
  const ROOM_PREFIX = 'tjvse-'; // префикс к коду чтобы не пересекаться с чужими peer-id
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без 0/O/1/I/L
  const CONNECT_TIMEOUT_MS = 20000;
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

  function ensurePeer(id) {
    if (typeof Peer === 'undefined') {
      throw new Error('PeerJS не загружен. Проверь интернет и CDN-скрипт в index.html.');
    }
    return new Peer(id, {
      debug: 0,
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

  function setupConn(c) {
    conn = c;
    connReady = false;
    conn.on('data', (data) => {
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return; }
      if (onMessageCb) onMessageCb(data);
    });
    conn.on('close', () => {
      if (onClosedCb) onClosedCb('peer closed');
      teardown();
    });
    conn.on('error', (err) => {
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
    peer = ensurePeer(id);
    peer.on('open', () => {
      if (opts.onReady) opts.onReady(roomCode);
    });
    peer.on('connection', (c) => {
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
    peer.on('error', (err) => {
      lastError = err;
      if (opts.onError) opts.onError(err);
    });
    return roomCode;
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
    const myId = ROOM_PREFIX + roomCode + '-c-' + Math.random().toString(36).slice(2, 7);
    peer = ensurePeer(myId);
    peer.on('open', () => {
      const c = peer.connect(targetId, { reliable: true });
      setupConn(c);
      waitForOpen(
        c,
        () => {
          if (onConnectedCb) onConnectedCb();
          if (opts.onReady) opts.onReady(roomCode);
        },
        (err) => { if (opts.onError) opts.onError(err); }
      );
    });
    peer.on('error', (err) => {
      lastError = err;
      if (opts.onError) opts.onError(err);
    });
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
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null;
    peer = null;
    role = null;
    roomCode = null;
    connReady = false;
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
