// Сетевой модуль: host-authoritative протокол.
// По умолчанию ntfy.sh используется только для signaling, а игровой канал идет через WebRTC + TURN.
// PeerJS и ntfy relay остались запасными режимами.
// Хост держит "истинное" состояние и шлёт снапшоты + события клиенту.
// Клиент шлёт свой ввод хосту.
(function () {
  const G = (window.G = window.G || {});

  const PROTOCOL_VERSION = 1;
  const ROOM_PREFIX = 'tjvse-'; // префикс к коду чтобы не пересекаться с чужими peer-id
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без 0/O/1/I/L
  const CONNECT_TIMEOUT_MS = 20000;
  const RELAY_FALLBACK_TIMEOUT_MS = 10000;
  const SNAPSHOT_BUFFER_LIMIT = 16 * 1024;
  const PEER_OPEN_TIMEOUT_MS = 10000;
  const PEER_OPEN_ATTEMPTS = 3;
  const PEER_RETRY_DELAYS = [0, 900, 1800];
  const SIGNAL_BASE = 'https://ntfy.sh';
  const SIGNAL_PREFIX = 'svalkus-net-v2-';
  const RELAY_SNAP_MS = 110;
  const RELAY_INPUT_MS = 45;

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
  let relayActive = false;
  let relayRemoteId = '';
  let relayLastSnap = 0;
  let relayLastInput = 0;
  let connectedNotified = false;
  let relayTimers = [];

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

  function queryParams() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function customIceServers() {
    const qs = queryParams();
    const servers = [];
    const rawIce = qs.get('ice');
    if (rawIce) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawIce));
        if (Array.isArray(parsed)) servers.push(...parsed);
      } catch (e) {
        console.warn('[net] cannot parse ice param', e);
      }
    }

    const turnUrls = qs.getAll('turnUrl').filter(Boolean);
    const turnHost = qs.get('turnHost');
    if (!turnUrls.length && turnHost) {
      const host = turnHost.replace(/^turns?:\/\//, '');
      turnUrls.push('turn:' + host + ':80');
      turnUrls.push('turn:' + host + ':80?transport=tcp');
      turnUrls.push('turn:' + host + ':443');
      turnUrls.push('turn:' + host + ':443?transport=tcp');
      turnUrls.push('turns:' + host + ':443?transport=tcp');
    }
    if (turnUrls.length) {
      const turn = { urls: turnUrls };
      const user = qs.get('turnUser');
      const cred = qs.get('turnCred') || qs.get('turnCredential');
      if (user) turn.username = user;
      if (cred) turn.credential = cred;
      servers.push(turn);
    }
    return servers;
  }

  function rtcConfig() {
    const custom = customIceServers();
    const qs = queryParams();
    const hasCustomTurn = custom.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => typeof url === 'string' && (url.indexOf('turn:') === 0 || url.indexOf('turns:') === 0));
    });
    const relayOnly = qs.get('iceRelay') === '1' || qs.get('icePolicy') === 'relay' || hasCustomTurn;
    return {
      iceTransportPolicy: relayOnly ? 'relay' : 'all',
      iceServers: [
        ...custom,
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
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

  function forceRelay() {
    try {
      const qs = queryParams();
      return qs.get('netRelay') === '1' || qs.get('relay') === '1';
    } catch (e) {
      return false;
    }
  }

  function preferDirectWebrtc() {
    try {
      const qs = queryParams();
      if (forceRelay()) return false;
      if (qs.get('netDirect') === '0' || qs.get('direct') === '0') return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function clearRelayTimers() {
    for (const t of relayTimers) {
      clearTimeout(t);
      clearInterval(t);
    }
    relayTimers = [];
  }

  function queueRelayTimer(timer) {
    relayTimers.push(timer);
    return timer;
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

  function notifyConnected() {
    connReady = true;
    if (connectedNotified) return;
    connectedNotified = true;
    if (onConnectedCb) onConnectedCb();
  }

  function shouldDropRelayData(data) {
    const now = performance.now();
    if (data && data.t === 'snap') {
      if (now - relayLastSnap < RELAY_SNAP_MS) return true;
      relayLastSnap = now;
    } else if (data && data.t === 'input' && (!data.justPressed || data.justPressed.length === 0)) {
      if (now - relayLastInput < RELAY_INPUT_MS) return true;
      relayLastInput = now;
    }
    return false;
  }

  function setupRelayChannel(remoteId) {
    if (!remoteId) return false;
    clearRelayTimers();
    relayActive = true;
    relayRemoteId = remoteId;
    relayLastSnap = 0;
    relayLastInput = 0;
    conn = {
      get open() { return relayActive; },
      bufferedAmount() { return 0; },
      send(data) {
        if (!relayActive || !relayRemoteId) return false;
        if (shouldDropRelayData(data)) return true;
        publishSignal({ type: 'relay', to: relayRemoteId, data }).catch(() => {});
        return true;
      },
      close() { relayActive = false; },
    };
    notifyConnected();
    return true;
  }

  function publishRelayReady(remoteId) {
    if (!remoteId || connReady) return;
    publishSignal({ type: 'relay-ready', to: remoteId }).catch(() => {});
  }

  function startRelayHost(remoteId) {
    if (!remoteId) return;
    relayRemoteId = remoteId;
    publishRelayReady(remoteId);
    queueRelayTimer(setInterval(() => publishRelayReady(remoteId), 800));
  }

  function sendRelayAck(remoteId) {
    if (!remoteId) return;
    for (let i = 0; i < 6; i++) {
      queueRelayTimer(setTimeout(() => {
        publishSignal({ type: 'relay-ack', to: remoteId }).catch(() => {});
      }, i * 350));
    }
  }

  function startJoinBroadcast() {
    const sendJoin = () => {
      if (connReady) return;
      publishSignal({ type: 'join' }).catch(() => {});
    };
    sendJoin();
    queueRelayTimer(setInterval(sendJoin, 1000));
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
      bufferedAmount() { return dc.bufferedAmount || 0; },
      send(data) {
        if (data && data.t === 'snap' && dc.bufferedAmount > SNAPSHOT_BUFFER_LIMIT) return false;
        dc.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      },
      close() { dc.close(); },
    };
    if (!relayActive) conn = wrapper;
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
      relayActive = false;
      conn = wrapper;
      notifyConnected();
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
    connectedNotified = false;
    lastError = null;
    roomCode = (opts.code || generateCode()).toUpperCase();
    selfSignalId = makeSignalId('host');
    remoteSignalId = '';
    rawCandidateQueue = [];
    const token = ++sessionToken;
    let timeout = null;
    let relayFallbackStarted = false;
    const fail = () => {
      if (connReady || token !== sessionToken) return;
      if (remoteSignalId && !relayFallbackStarted && !forceRelay()) {
        relayFallbackStarted = true;
        startRelayHost(remoteSignalId);
        if (opts.onFallback) opts.onFallback();
        timeout = setTimeout(fail, RELAY_FALLBACK_TIMEOUT_MS);
        return;
      }
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
          if (forceRelay() || !preferDirectWebrtc()) {
            startRelayHost(remoteSignalId);
            timeout = setTimeout(fail, CONNECT_TIMEOUT_MS);
            return;
          }
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
        if (msg.type === 'relay-ack') {
          setupRelayChannel(remoteSignalId);
        } else if (msg.type === 'relay') {
          if (onMessageCb) onMessageCb(msg.data);
        } else if (msg.type === 'answer' && rawPc) {
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
    connectedNotified = false;
    lastError = null;
    roomCode = code.toUpperCase();
    selfSignalId = makeSignalId('client');
    remoteSignalId = 'host';
    rawCandidateQueue = [];
    const token = ++sessionToken;
    let joined = false;
    let timeout = null;
    let relayFallbackWait = false;
    if (opts.onAttempt) opts.onAttempt(1, 1, null);
    const fail = () => {
      if (connReady || token !== sessionToken) return;
      if (remoteSignalId && remoteSignalId !== 'host' && !relayFallbackWait && !forceRelay()) {
        relayFallbackWait = true;
        if (opts.onFallback) opts.onFallback();
        timeout = setTimeout(fail, RELAY_FALLBACK_TIMEOUT_MS);
        return;
      }
      lastError = { type: 'timeout' };
      if (opts.onError) opts.onError(lastError);
    };
    openSignal(
      roomCode,
      token,
      async (msg) => {
        if (msg.type === 'relay-ready' && msg.to === selfSignalId) {
          remoteSignalId = msg.from;
          setupRelayChannel(remoteSignalId);
          sendRelayAck(remoteSignalId);
          return;
        }
        if (msg.type === 'relay' && msg.to === selfSignalId) {
          if (!remoteSignalId || remoteSignalId === 'host') remoteSignalId = msg.from;
          if (onMessageCb) onMessageCb(msg.data);
          return;
        }
        if (msg.type === 'offer' && msg.to === selfSignalId) {
          remoteSignalId = msg.from;
          if (forceRelay() || !preferDirectWebrtc()) {
            await publishSignal({ type: 'relay-ack', to: remoteSignalId });
            setupRelayChannel(remoteSignalId);
            sendRelayAck(remoteSignalId);
            return;
          }
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
          startJoinBroadcast();
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
    connectedNotified = false;
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
    connectedNotified = false;
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
      return conn.send(msg) !== false;
    } catch (e) {
      return false;
    }
  }

  function bufferedAmount() {
    if (!conn) return 0;
    if (typeof conn.bufferedAmount === 'function') return conn.bufferedAmount();
    if (conn._dc && typeof conn._dc.bufferedAmount === 'number') return conn._dc.bufferedAmount;
    return 0;
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
    relayActive = false;
    relayRemoteId = '';
    relayLastSnap = 0;
    relayLastInput = 0;
    connectedNotified = false;
    clearRelayTimers();
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
    host, join, send, bufferedAmount, disconnect,
    generateCode,
    isHost, isClient, isConnected, getRole, getCode, getError,
    flushEvents, applyEvents,
  };
})();
