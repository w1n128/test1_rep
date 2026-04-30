// Сетевой модуль: WebRTC P2P, host-authoritative протокол.
// По умолчанию signaling идёт через ntfy.sh; PeerJS остался запасным режимом.
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
  const SIGNAL_BASE = 'https://ntfy.sh';
  const SIGNAL_PREFIX = 'svalkus-net-v2-';
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
  let signalSource = null;
  let signalTopic = null;
  let rawPc = null;
  let rawCandidateQueue = [];
  let selfSignalId = '';
  let remoteSignalId = '';

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

  function rtcConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'stun:openrelay.metered.ca:80' },
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
    };
  }

  function ensurePeer(id) {
    if (typeof Peer === 'undefined') {
      throw new Error('PeerJS не загружен. Проверь интернет и CDN-скрипт в index.html.');
    }
    return new Peer(id, {
      ...peerServerOptionsFromUrl(),
      debug: 3,
      config: rtcConfig(),
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

  function signalBackend() {
    try {
      const qs = new URLSearchParams(window.location.search);
      return (qs.get('signal') || 'ntfy').toLowerCase();
    } catch (e) {
      return 'ntfy';
    }
  }

  function makeSignalId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
  }

  function roomTopic(code) {
    return SIGNAL_PREFIX + code.toLowerCase();
  }

  function closeRawOnly() {
    const oldSource = signalSource;
    const oldPc = rawPc;
    const oldConn = conn;
    signalSource = null;
    rawPc = null;
    conn = null;
    connReady = false;
    rawCandidateQueue = [];
    try { if (oldSource) oldSource.close(); } catch (e) {}
    try { if (oldConn && oldConn.close) oldConn.close(); } catch (e) {}
    try { if (oldPc) oldPc.close(); } catch (e) {}
  }

  function publishSignal(msg) {
    if (!signalTopic) return Promise.reject(new Error('no signal topic'));
    msg.app = 'svalkus';
    msg.v = PROTOCOL_VERSION;
    msg.room = roomCode;
    msg.from = selfSignalId;
    msg.ts = Date.now();
    return fetch(SIGNAL_BASE + '/' + signalTopic, {
      method: 'POST',
      body: JSON.stringify(msg),
    });
  }

  function openSignal(code, token, onSignal, onOpen, onError) {
    signalTopic = roomTopic(code);
    const since = Math.floor(Date.now() / 1000);
    const openedAt = Date.now();
    const es = new EventSource(SIGNAL_BASE + '/' + signalTopic + '/sse?since=' + since);
    signalSource = es;
    es.onopen = () => {
      if (token !== sessionToken) return;
      if (onOpen) onOpen();
    };
    es.onmessage = (ev) => {
      if (token !== sessionToken) return;
      let envelope;
      try { envelope = JSON.parse(ev.data); } catch (e) { return; }
      if (!envelope || envelope.event !== 'message' || !envelope.message) return;
      let msg;
      try { msg = JSON.parse(envelope.message); } catch (e) { return; }
      if (!msg || msg.app !== 'svalkus' || msg.v !== PROTOCOL_VERSION) return;
      if (msg.ts && msg.ts < openedAt - 5000) return;
      if (msg.room !== roomCode || msg.from === selfSignalId) return;
      if (msg.to && msg.to !== selfSignalId) return;
      onSignal(msg);
    };
    es.onerror = () => {
      if (token !== sessionToken || connReady) return;
      lastError = { type: 'signal-network' };
      if (onError) onError(lastError);
    };
  }

  function setupRawChannel(dc) {
    const wrapper = {
      get open() { return dc.readyState === 'open'; },
      send(data) {
        dc.send(typeof data === 'string' ? data : JSON.stringify(data));
      },
      close() { dc.close(); },
    };
    conn = wrapper;
    dc.onmessage = (ev) => {
      let data = ev.data;
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return; }
      if (onMessageCb) onMessageCb(data);
    };
    dc.onclose = () => {
      if (conn !== wrapper) return;
      if (onClosedCb) onClosedCb('peer closed');
      teardown();
    };
    dc.onerror = () => {
      if (conn !== wrapper) return;
      lastError = { type: 'webrtc' };
      if (onClosedCb) onClosedCb('error: webrtc');
      teardown();
    };
    dc.onopen = () => {
      connReady = true;
      if (onConnectedCb) onConnectedCb();
    };
    if (dc.readyState === 'open') dc.onopen();
  }

  function createRawPeer(token, onIceError) {
    rawPc = new RTCPeerConnection(rtcConfig());
    rawPc.onicecandidate = (ev) => {
      if (token !== sessionToken || !ev.candidate || !remoteSignalId) return;
      publishSignal({ type: 'candidate', to: remoteSignalId, candidate: ev.candidate }).catch(() => {});
    };
    rawPc.onicecandidateerror = (ev) => {
      console.warn('[net] raw icecandidateerror:', ev.url, ev.errorCode, ev.errorText);
      if (onIceError) onIceError(ev);
    };
    rawPc.onconnectionstatechange = () => {
      console.log('[net] raw connectionState =', rawPc.connectionState);
      if ((rawPc.connectionState === 'failed' || rawPc.connectionState === 'closed') && !connReady) {
        lastError = { type: 'webrtc' };
      }
    };
    rawPc.oniceconnectionstatechange = () => {
      console.log('[net] raw iceConnectionState =', rawPc.iceConnectionState);
    };
    return rawPc;
  }

  async function addRawCandidate(candidate) {
    if (!candidate) return;
    if (!rawPc) {
      rawCandidateQueue.push(candidate);
      return;
    }
    if (!rawPc.remoteDescription) {
      rawCandidateQueue.push(candidate);
      return;
    }
    try { await rawPc.addIceCandidate(candidate); } catch (e) { console.warn('[net] addIceCandidate failed', e); }
  }

  async function flushRawCandidates() {
    if (!rawPc || !rawPc.remoteDescription) return;
    const q = rawCandidateQueue;
    rawCandidateQueue = [];
    for (const c of q) await addRawCandidate(c);
  }

  function hostNtfy(opts) {
    if (peer || rawPc || signalSource) disconnect();
    role = 'host';
    onMessageCb = opts.onMessage || null;
    onClosedCb = opts.onClose || null;
    onConnectedCb = opts.onConnect || null;
    lastError = null;
    roomCode = (opts.code || generateCode()).toUpperCase();
    selfSignalId = makeSignalId('host');
    remoteSignalId = '';
    rawCandidateQueue = [];
    const token = ++sessionToken;
    let timeout = null;
    const fail = () => {
      if (connReady || token !== sessionToken) return;
      lastError = { type: 'timeout' };
      if (opts.onError) opts.onError(lastError);
    };
    if (opts.onAttempt) opts.onAttempt(1, 1, null);
    openSignal(
      roomCode,
      token,
      async (msg) => {
        if (msg.type === 'join' && !remoteSignalId) {
          remoteSignalId = msg.from;
          if (opts.onPending) opts.onPending();
          timeout = setTimeout(fail, CONNECT_TIMEOUT_MS);
          const pc = createRawPeer(token);
          const dc = pc.createDataChannel('game');
          setupRawChannel(dc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await publishSignal({ type: 'offer', to: remoteSignalId, sdp: pc.localDescription });
          return;
        }
        if (!remoteSignalId || msg.from !== remoteSignalId) return;
        if (msg.type === 'answer' && rawPc) {
          await rawPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushRawCandidates();
        } else if (msg.type === 'candidate') {
          await addRawCandidate(msg.candidate);
        }
      },
      () => {
        if (opts.onReady) opts.onReady(roomCode);
      },
      (err) => {
        if (timeout) clearTimeout(timeout);
        if (opts.onError) opts.onError(err);
      }
    );
    return roomCode;
  }

  function joinNtfy(code, opts) {
    if (peer || rawPc || signalSource) disconnect();
    role = 'client';
    onMessageCb = opts.onMessage || null;
    onClosedCb = opts.onClose || null;
    onConnectedCb = opts.onConnect || null;
    lastError = null;
    roomCode = code.toUpperCase();
    selfSignalId = makeSignalId('client');
    remoteSignalId = 'host';
    rawCandidateQueue = [];
    const token = ++sessionToken;
    let joined = false;
    let timeout = null;
    if (opts.onAttempt) opts.onAttempt(1, 1, null);
    const fail = () => {
      if (connReady || token !== sessionToken) return;
      lastError = { type: 'timeout' };
      if (opts.onError) opts.onError(lastError);
    };
    openSignal(
      roomCode,
      token,
      async (msg) => {
        if (msg.type === 'offer' && msg.to === selfSignalId) {
          remoteSignalId = msg.from;
          const pc = createRawPeer(token);
          pc.ondatachannel = (ev) => setupRawChannel(ev.channel);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushRawCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await publishSignal({ type: 'answer', to: remoteSignalId, sdp: pc.localDescription });
          return;
        }
        if (msg.to === selfSignalId && msg.type === 'candidate') {
          if (!remoteSignalId || remoteSignalId === 'host') remoteSignalId = msg.from;
          await addRawCandidate(msg.candidate);
        }
      },
      () => {
        if (opts.onReady) opts.onReady(roomCode);
        if (!joined) {
          joined = true;
          timeout = setTimeout(fail, CONNECT_TIMEOUT_MS);
          publishSignal({ type: 'join' }).catch((err) => {
            if (opts.onError) opts.onError(normalizePeerError(err, 'signal-network'));
          });
        }
      },
      (err) => {
        if (timeout) clearTimeout(timeout);
        if (opts.onError) opts.onError(err);
      }
    );
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

  function peerjsHost(opts) {
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

  function peerjsJoin(code, opts) {
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

  function host(opts) {
    return signalBackend() === 'peerjs' ? peerjsHost(opts) : hostNtfy(opts);
  }

  function join(code, opts) {
    return signalBackend() === 'peerjs' ? peerjsJoin(code, opts) : joinNtfy(code, opts);
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
    const oldPc = rawPc;
    const oldSource = signalSource;
    conn = null;
    peer = null;
    rawPc = null;
    signalSource = null;
    role = null;
    roomCode = null;
    connReady = false;
    rawCandidateQueue = [];
    selfSignalId = '';
    remoteSignalId = '';
    signalTopic = null;
    try { if (oldConn) oldConn.close(); } catch (e) {}
    try { if (oldPeer) oldPeer.destroy(); } catch (e) {}
    try { if (oldPc) oldPc.close(); } catch (e) {}
    try { if (oldSource) oldSource.close(); } catch (e) {}
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
