// Унифицированный интерфейс ввода: для двух игроков и для AI.
// Каждое InputDevice предоставляет state (зажато) и justPressed (только что нажато).
(function () {
  const G = window.G;

  class InputDevice {
    constructor(name, map) {
      this.name = name;
      this.map = map; // KeyCode -> action
      this.state = {};
      this.justPressed = {};
    }
    isDown(action) { return !!this.state[action]; }
    wasPressed(action) { return !!this.justPressed[action]; }
    consume() { this.justPressed = {}; }
    setAction(action, down) {
      if (down) {
        if (!this.state[action]) this.justPressed[action] = true;
        this.state[action] = true;
      } else {
        this.state[action] = false;
      }
    }
  }

  const p1 = new InputDevice('p1', {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyF: 'place',
    KeyQ: 'switchPrev', KeyE: 'switchNext',
  });
  const p2 = new InputDevice('p2', {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Period: 'place', Comma: 'switchNext',
  });

  // Глобальное меню/системные команды.
  const sys = new InputDevice('sys', {
    Enter: 'confirm',
    Digit1: 'mode1',
    Digit2: 'mode2',
    Digit3: 'mode3',
    Escape: 'pause',
    KeyR: 'restart',
    KeyM: 'menu',
    Space: 'confirm',
  });

  // Клавиши, которые перехватывает игра — чтобы preventDefault не задевал ничего лишнего.
  const ALL_KEYS = new Set([
    ...Object.keys(p1.map),
    ...Object.keys(p2.map),
    ...Object.keys(sys.map),
  ]);

  let anyKeyJustPressed = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (ALL_KEYS.has(e.code)) e.preventDefault();
    anyKeyJustPressed = true;
    if (p1.map[e.code])  p1.setAction(p1.map[e.code], true);
    if (p2.map[e.code])  p2.setAction(p2.map[e.code], true);
    if (sys.map[e.code]) sys.setAction(sys.map[e.code], true);
  });

  window.addEventListener('keyup', (e) => {
    if (p1.map[e.code])  p1.setAction(p1.map[e.code], false);
    if (p2.map[e.code])  p2.setAction(p2.map[e.code], false);
    if (sys.map[e.code]) sys.setAction(sys.map[e.code], false);
  });

  G.InputDevice = InputDevice;
  G.input = {
    p1, p2, sys,
    anyKeyJustPressed: () => anyKeyJustPressed,
    consumeAll() {
      p1.consume();
      p2.consume();
      sys.consume();
      anyKeyJustPressed = false;
    },
  };
})();
