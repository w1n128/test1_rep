// Арена: сетка тайлов, препятствия и проверки коллизий.
(function () {
  const G = window.G;
  const C = G.config;

  // Список препятствий: [tileX, tileY, kind]
  // kind: 'bin' | 'crate' | 'pallet' | 'bush' | 'fence'
  // Куст ('bush') проходим, остальные блокируют.
  const OBSTACLES = [];

  // Периметр-забор
  for (let x = 0; x < C.ARENA_W; x++) {
    OBSTACLES.push([x, 0, 'fence']);
    OBSTACLES.push([x, C.ARENA_H - 1, 'fence']);
  }
  for (let y = 1; y < C.ARENA_H - 1; y++) {
    OBSTACLES.push([0, y, 'fence']);
    OBSTACLES.push([C.ARENA_W - 1, y, 'fence']);
  }

  // Декоративные кусты (проходимы)
  const bushes = [
    [3, 2], [20, 2], [3, 15], [20, 15],
    [11, 3], [12, 3], [11, 14], [12, 14],
  ];
  for (const [x, y] of bushes) OBSTACLES.push([x, y, 'bush']);

  // Деревянные ящики
  const crateGroups = [
    // Углы: верх-лево / верх-право
    [3, 4], [4, 4], [3, 5],
    [19, 4], [20, 4], [20, 5],
    // Углы: низ-лево / низ-право
    [3, 12], [3, 13], [4, 13],
    [20, 12], [19, 13], [20, 13],
    // Центральная формация 4x2
    [10, 8], [11, 8], [12, 8], [13, 8],
    [10, 9], [11, 9], [12, 9], [13, 9],
  ];
  for (const [x, y] of crateGroups) OBSTACLES.push([x, y, 'crate']);

  // Мусорные баки — парами по бокам и сверху/снизу
  const bins = [
    [7, 2], [8, 2], [15, 2], [16, 2],
    [7, 15], [8, 15], [15, 15], [16, 15],
    [2, 7], [2, 8], [21, 7], [21, 8],
    [2, 10], [2, 11], [21, 10], [21, 11],
  ];
  for (const [x, y] of bins) OBSTACLES.push([x, y, 'bin']);

  // Поддоны — диагональные пары между углами и центром
  const pallets = [
    [6, 6], [17, 6],
    [6, 11], [17, 11],
    [11, 5], [12, 5],
    [11, 12], [12, 12],
  ];
  for (const [x, y] of pallets) OBSTACLES.push([x, y, 'pallet']);

  // Сетки solid и kind
  const solid = [];
  const kind = [];
  for (let y = 0; y < C.ARENA_H; y++) {
    solid.push(new Array(C.ARENA_W).fill(false));
    kind.push(new Array(C.ARENA_W).fill(null));
  }
  for (const [x, y, k] of OBSTACLES) {
    if (x < 0 || y < 0 || x >= C.ARENA_W || y >= C.ARENA_H) continue;
    kind[y][x] = k;
    if (k !== 'bush') solid[y][x] = true;
  }

  function isSolidPx(px, py, halfBox = C.PLAYER_HITBOX / 2) {
    const x0 = Math.floor((px - halfBox) / C.TILE);
    const x1 = Math.floor((px + halfBox - 1) / C.TILE);
    const y0 = Math.floor((py - halfBox) / C.TILE);
    const y1 = Math.floor((py + halfBox - 1) / C.TILE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= C.ARENA_W || y >= C.ARENA_H) return true;
        if (solid[y][x]) return true;
      }
    }
    return false;
  }

  function isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= C.ARENA_W || ty >= C.ARENA_H) return true;
    return solid[ty][tx];
  }

  function tileKind(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= C.ARENA_W || ty >= C.ARENA_H) return null;
    return kind[ty][tx];
  }

  function findFreeTilesNear(tx, ty, maxRadius = 3) {
    const out = [];
    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (!isSolidTile(x, y)) out.push([x, y]);
        }
      }
      if (out.length) return out;
    }
    return out;
  }

  function randomFreeTile() {
    while (true) {
      const x = 1 + Math.floor(Math.random() * (C.ARENA_W - 2));
      const y = 1 + Math.floor(Math.random() * (C.ARENA_H - 2));
      if (!isSolidTile(x, y)) return [x, y];
    }
  }

  G.arena = {
    solid,
    kind,
    isSolidPx,
    isSolidTile,
    tileKind,
    findFreeTilesNear,
    randomFreeTile,
    obstacles: OBSTACLES,
    spawn: {
      p1: { x: 2 * C.TILE + C.TILE / 2, y: 2 * C.TILE + C.TILE / 2 },
      p2: { x: 21 * C.TILE + C.TILE / 2, y: 15 * C.TILE + C.TILE / 2 },
    },
  };
})();
