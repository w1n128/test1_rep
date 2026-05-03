// Виртуальное управление для Android/WebView и touch-устройств.
(function () {
  const G = window.G;
  if (!G || !G.input || !G.platform) return;

  const enabled = !!(G.platform.android || G.platform.touch);
  G.mobileControls = { enabled };
  if (!enabled) return;

  const devices = [G.input.p1, G.input.netAlt].filter(Boolean);
  const sys = G.input.sys;

  function setAction(action, down) {
    for (const device of devices) device.setAction(action, down);
  }

  function setSys(action, down) {
    if (sys) sys.setAction(action, down);
  }

  function makeButton(label, action, className, opts = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touch-btn ' + (className || '');
    btn.textContent = label;
    btn.setAttribute('aria-label', opts.aria || label);
    btn.dataset.action = action;

    const press = (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      setAction(action, true);
      if (opts.confirm) setSys('confirm', true);
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      setAction(action, false);
      if (opts.confirm) setSys('confirm', false);
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    return btn;
  }

  function makeSysButton(label, action, className, opts = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touch-btn ' + (className || '');
    btn.textContent = label;
    btn.setAttribute('aria-label', opts.aria || label);

    const press = (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      setSys(action, true);
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      setSys(action, false);
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    return btn;
  }

  function makeJoystick() {
    const zone = document.createElement('div');
    zone.className = 'touch-joystick-zone';
    zone.setAttribute('aria-label', 'Стик движения');

    const base = document.createElement('div');
    base.className = 'touch-joystick-base';
    const knob = document.createElement('div');
    knob.className = 'touch-joystick-knob';
    base.appendChild(knob);
    zone.appendChild(base);

    const radius = 54;
    const deadzone = 12;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let current = { left: false, right: false, up: false, down: false };

    function setDirections(next) {
      for (const action of ['left', 'right', 'up', 'down']) {
        if (current[action] !== next[action]) setAction(action, next[action]);
      }
      current = next;
    }

    function updateFromPoint(clientX, clientY) {
      const rawX = clientX - startX;
      const rawY = clientY - startY;
      const dist = Math.hypot(rawX, rawY);
      const scale = dist > radius ? radius / dist : 1;
      const x = rawX * scale;
      const y = rawY * scale;
      knob.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

      if (dist < deadzone) {
        setDirections({ left: false, right: false, up: false, down: false });
        return;
      }
      const nx = rawX / Math.max(dist, 1);
      const ny = rawY / Math.max(dist, 1);
      const threshold = 0.34;
      setDirections({
        left: nx < -threshold,
        right: nx > threshold,
        up: ny < -threshold,
        down: ny > threshold,
      });
    }

    function start(e) {
      if (pointerId !== null) return;
      e.preventDefault();
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      base.style.left = startX + 'px';
      base.style.top = startY + 'px';
      base.classList.add('is-active');
      try { zone.setPointerCapture(pointerId); } catch (err) {}
      updateFromPoint(e.clientX, e.clientY);
    }

    function move(e) {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      updateFromPoint(e.clientX, e.clientY);
    }

    function stop(e) {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      pointerId = null;
      base.classList.remove('is-active');
      knob.style.transform = 'translate(0, 0)';
      setDirections({ left: false, right: false, up: false, down: false });
    }

    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', stop);
    zone.addEventListener('pointercancel', stop);
    return zone;
  }

  function init() {
    document.body.classList.add('mobile-controls-enabled');

    const root = document.createElement('div');
    root.className = 'touch-controls';
    root.setAttribute('aria-hidden', 'false');

    const system = document.createElement('div');
    system.className = 'touch-system';
    system.appendChild(makeSysButton('ESC', 'pause', 'touch-system-btn touch-esc', { aria: 'Пауза или назад' }));
    const pauseControls = document.createElement('div');
    pauseControls.className = 'touch-pause-controls';
    pauseControls.appendChild(makeSysButton('R', 'restart', 'touch-system-btn touch-restart', { aria: 'Рестарт' }));
    pauseControls.appendChild(makeSysButton('M', 'menu', 'touch-system-btn touch-menu', { aria: 'В меню' }));
    system.appendChild(pauseControls);

    const actions = document.createElement('div');
    actions.className = 'touch-actions';
    actions.appendChild(makeButton('F', 'place', 'touch-action-use', { aria: 'Использовать', confirm: true }));
    actions.appendChild(makeButton('⤴', 'dash', 'touch-action-dash', { aria: 'Рывок' }));
    actions.appendChild(makeButton('‹', 'switchPrev', 'touch-action-small', { aria: 'Предыдущий предмет' }));
    actions.appendChild(makeButton('›', 'switchNext', 'touch-action-small', { aria: 'Следующий предмет' }));

    const slots = document.createElement('div');
    slots.className = 'touch-slots';
    for (let i = 0; i < 7; i++) {
      slots.appendChild(makeButton(String(i + 1), 'select' + i, 'touch-slot', { aria: 'Предмет ' + (i + 1) }));
    }

    root.appendChild(system);
    root.appendChild(makeJoystick());
    root.appendChild(slots);
    root.appendChild(actions);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
