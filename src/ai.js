// AI-противник: реализует тот же интерфейс, что и InputDevice.
// FSM: SEEK_PICKUP / PLACE_TRAP / WANDER. Путь — A* по тайлам.
(function () {
  const G = window.G;
  const C = G.config;

  function key(x, y) { return y * 1000 + x; }
  function heuristic(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

  // Какие тайлы AI считает заблокированными (с учётом «видимости» ловушек).
  function isAITileBlocked(tx, ty, ownerId) {
    if (G.arena.isSolidTile(tx, ty)) return true;
    if (!G.trapManager) return false;
    const trap = G.trapManager.trapAtTile(tx, ty);
    if (!trap) return false;
    if (trap.ownerId === ownerId) return true; // свою ловушку тоже обходим
    // Чужие: trapdoor невидим, остальные опасны
    if (trap.type === 'trapdoor') return false;
    return true;
  }

  function aStar(sx, sy, tx, ty, ownerId) {
    if (sx === tx && sy === ty) return [];
    const open = [];
    const cameFrom = new Map();
    const gScore = new Map();
    const startK = key(sx, sy);
    gScore.set(startK, 0);
    open.push({ x: sx, y: sy, f: heuristic(sx, sy, tx, ty) });
    const closed = new Set();

    while (open.length > 0) {
      // Маленькая сетка → линейный поиск минимума достаточен
      let bestI = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bestI].f) bestI = i;
      const cur = open.splice(bestI, 1)[0];
      const ck = key(cur.x, cur.y);
      if (cur.x === tx && cur.y === ty) {
        const path = [];
        let cx = tx, cy = ty;
        while (!(cx === sx && cy === sy)) {
          path.unshift([cx, cy]);
          const k2 = key(cx, cy);
          const prev = cameFrom.get(k2);
          if (!prev) break;
          [cx, cy] = prev;
        }
        return path;
      }
      closed.add(ck);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= C.ARENA_W || ny >= C.ARENA_H) continue;
        if (isAITileBlocked(nx, ny, ownerId)) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const tentativeG = (gScore.get(ck) ?? 0) + 1;
        if (tentativeG < (gScore.get(nk) ?? Infinity)) {
          cameFrom.set(nk, [cur.x, cur.y]);
          gScore.set(nk, tentativeG);
          open.push({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny, tx, ty) });
        }
      }
    }
    return null;
  }

  class AIController {
    constructor() {
      this.player = null;
      this.opponent = null;
      this.traps = null;
      this.pickups = null;
      this.path = [];
      this.placeIntent = null;
      this.repathT = 0;
      this.switchCD = 0;
      this.placeCD = 0;
      this.matchT = 0;
      this.baitCD = C.AI_BAIT_START_DELAY;
      this._actions = {};
      this._justPressed = {};
    }
    bind(player, opponent, traps, pickups) {
      this.player = player;
      this.opponent = opponent;
      this.traps = traps;
      this.pickups = pickups;
    }
    isDown(a) { return !!this._actions[a]; }
    wasPressed(a) { return !!this._justPressed[a]; }
    consume() { this._justPressed = {}; }

    pickAvailableTrap() {
      const have = C.TRAP_TYPES.filter((t) => this.player.inventory[t] > 0);
      if (!have.length) return null;
      return have[Math.floor(Math.random() * have.length)];
    }

    pickCombatItem() {
      if (this.player.inventory.branch > 0) return 'branch';
      return null;
    }

    canThrowAtOpponent() {
      if (!this.opponent || !this.opponent.alive || this.player.inventory.can <= 0) return null;
      const dx = this.opponent.tileX - this.player.tileX;
      const dy = this.opponent.tileY - this.player.tileY;
      if (dx !== 0 && dy !== 0) return null;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 2 || dist > C.PROJECTILE_RANGE_TILES) return null;
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      for (let i = 1; i <= dist; i++) {
        const tx = this.player.tileX + sx * i;
        const ty = this.player.tileY + sy * i;
        if (G.arena.isSolidTile(tx, ty)) return null;
      }
      return sx > 0 ? 'right' : sx < 0 ? 'left' : sy > 0 ? 'down' : 'up';
    }

    decide() {
      const px = this.player.tileX, py = this.player.tileY;

      // 1) Близкий пикап
      let bestPk = null, bestPkD = Infinity;
      for (const pk of this.pickups.list) {
        if (this.player.inventory[pk.type] >= C.INVENTORY_MAX_PER_TYPE) continue;
        const d = Math.abs(pk.tileX - px) + Math.abs(pk.tileY - py);
        if (d <= C.AI_PICKUP_RADIUS_TILES && d < bestPkD) {
          bestPkD = d; bestPk = pk;
        }
      }
      if (bestPk) {
        const path = aStar(px, py, bestPk.tileX, bestPk.tileY, this.player.id);
        if (path) {
          this.path = path;
          this.placeIntent = null;
          return;
        }
      }

      // 2) Противник близко — попробовать поставить ловушку
      if (this.opponent.alive) {
        const ox = this.opponent.tileX, oy = this.opponent.tileY;
        const dOp = Math.abs(ox - px) + Math.abs(oy - py);
        const bait = this.player.character === 'raccoon' ? 'pizza' : 'diamond';
        if (
          this.matchT >= C.AI_BAIT_START_DELAY &&
          this.baitCD <= 0 &&
          this.player.inventory[bait] > 0 &&
          dOp >= C.AI_BAIT_MIN_DISTANCE &&
          Math.random() < C.AI_BAIT_USE_CHANCE
        ) {
          this.placeIntent = { type: bait, atTile: [px, py] };
          this.baitCD = C.AI_BAIT_COOLDOWN;
          this.path = [];
          return;
        }
        if (dOp <= C.AI_THREAT_RADIUS_TILES) {
          const type = this.pickAvailableTrap();
          if (type && Math.random() < C.AI_PLACE_TRAP_CHANCE) {
            this.placeIntent = { type, atTile: [px, py] };
            this.path = [];
            return;
          }
        }
      }

      // 3) Wander: случайный достижимый тайл в радиусе 8
      for (let i = 0; i < 12; i++) {
        const dx = Math.floor(Math.random() * 17) - 8;
        const dy = Math.floor(Math.random() * 17) - 8;
        const tx = Math.max(1, Math.min(C.ARENA_W - 2, px + dx));
        const ty = Math.max(1, Math.min(C.ARENA_H - 2, py + dy));
        if (tx === px && ty === py) continue;
        const path = aStar(px, py, tx, ty, this.player.id);
        if (path && path.length > 0) {
          this.path = path;
          this.placeIntent = null;
          return;
        }
      }
    }

    update(dt) {
      this._actions = {};
      this._justPressed = {};
      if (!this.player || !this.player.alive || this.player.fallen > 0) return;

      this.matchT += dt;
      this.repathT -= dt;
      this.switchCD = Math.max(0, this.switchCD - dt);
      this.placeCD = Math.max(0, this.placeCD - dt);
      this.baitCD = Math.max(0, this.baitCD - dt);

      if (this.opponent && this.opponent.alive) {
        const throwDir = this.canThrowAtOpponent();
        if (throwDir && this.placeCD <= 0) {
          this._actions[throwDir] = true;
          if (this.player.selectedType() !== 'can') {
            if (this.switchCD === 0) {
              this._justPressed.switchNext = true;
              this.switchCD = 0.18;
            }
          } else {
            this._justPressed.place = true;
            this.placeCD = 0.7;
          }
          return;
        }
        const dx = this.opponent.tileX - this.player.tileX;
        const dy = this.opponent.tileY - this.player.tileY;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          if (Math.abs(dx) > Math.abs(dy)) this._actions[dx > 0 ? 'right' : 'left'] = true;
          else this._actions[dy > 0 ? 'down' : 'up'] = true;
          const combat = this.pickCombatItem();
          if (combat && this.placeCD <= 0) {
            if (this.player.selectedType() !== combat) {
              if (this.switchCD === 0) {
                this._justPressed.switchNext = true;
                this.switchCD = 0.18;
              }
            } else {
              this._justPressed.place = true;
              this.placeCD = 0.45;
            }
            return;
          }
        }
      }

      if (this.repathT <= 0 || (this.path.length === 0 && !this.placeIntent)) {
        this.decide();
        this.repathT = C.AI_REPATH_INTERVAL;
      }

      // Намерение поставить ловушку: переключить тип, потом нажать
      if (this.placeIntent) {
        const [tx, ty] = this.placeIntent.atTile;
        if (this.player.tileX === tx && this.player.tileY === ty) {
          if (this.placeCD > 0) return;
          if (this.player.selectedType() !== this.placeIntent.type) {
            if (this.switchCD === 0) {
              this._justPressed.switchNext = true;
              this.switchCD = 0.18;
            }
            return;
          }
          this._justPressed.place = true;
          this.placeCD = 0.4;
          this.placeIntent = null;
          this.path = [];
          this.repathT = 0.1;
          return;
        }
        // Не дошли до места установки → надо построить путь
        if (this.path.length === 0) {
          const p = aStar(this.player.tileX, this.player.tileY, tx, ty, this.player.id);
          if (p) this.path = p; else this.placeIntent = null;
        }
      }

      // Движение по пути
      if (this.path.length > 0) {
        const next = this.path[0];
        const cx = next[0] * C.TILE + C.TILE / 2;
        const cy = next[1] * C.TILE + C.TILE / 2;
        const dx = cx - this.player.x;
        const dy = cy - this.player.y;
        const arrive = Math.max(3, C.PLAYER_SPEED * dt * 1.1);
        if (Math.abs(dx) <= arrive && Math.abs(dy) <= arrive) {
          this.player.x = cx;
          this.player.y = cy;
          this.path.shift();
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          this._actions[dx > 0 ? 'right' : 'left'] = true;
          if (Math.abs(dy) > 6) this._actions[dy > 0 ? 'down' : 'up'] = true;
        } else {
          this._actions[dy > 0 ? 'down' : 'up'] = true;
          if (Math.abs(dx) > 6) this._actions[dx > 0 ? 'right' : 'left'] = true;
        }
        if (
          this.player.dashCD <= 0 &&
          this.opponent &&
          this.opponent.alive &&
          Math.abs(this.opponent.tileX - this.player.tileX) + Math.abs(this.opponent.tileY - this.player.tileY) >= 5 &&
          Math.random() < 0.025
        ) {
          this._justPressed.dash = true;
        }
      }
    }
  }

  G.AIController = AIController;
})();
