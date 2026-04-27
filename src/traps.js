// Менеджер ловушек.
// Все ловушки лежат в одном списке, эффекты (взрывы) — в отдельном.
(function () {
  const G = window.G;
  const C = G.config;

  class Trap {
    constructor(type, ownerId, tileX, tileY) {
      this.type = type;
      this.ownerId = ownerId;
      this.tileX = tileX;
      this.tileY = tileY;
      this.armDelay = C.TRAP_ARM_DELAY;
      this.destroyed = false;
      this.age = 0;
      // Тип-специфика
      if (type === 'firecracker') this.fuse = C.FIRECRACKER_FUSE;
      if (type === 'puddle') this.life = C.PUDDLE_LIFETIME;
      if (type === 'banana') {
        this.life = C.BANANA_LIFETIME;
        this.armDelay = 0; // мгновенно активен — это «брошенная» кожура
      }
    }
    get armed() { return this.armDelay <= 0; }

    update(dt, manager) {
      this.age += dt;
      if (this.armDelay > 0) this.armDelay -= dt;

      if (this.type === 'firecracker' && this.armed) {
        this.fuse -= dt;
        if (this.fuse <= 0 && !this.destroyed) {
          manager.detonateFirecracker(this);
          this.destroyed = true;
        }
      }
      if (this.type === 'puddle' || this.type === 'banana') {
        this.life -= dt;
        if (this.life <= 0) this.destroyed = true;
      }
    }
  }

  class TrapManager {
    constructor() {
      this.list = [];
      this.effects = [];
      this.players = null;
    }
    setPlayers(players) { this.players = players; }

    countByOwner(ownerId) {
      let n = 0;
      for (const t of this.list) {
        if (!t.destroyed && t.ownerId === ownerId) n++;
      }
      return n;
    }

    trapAtTile(tileX, tileY) {
      for (const t of this.list) {
        if (!t.destroyed && t.tileX === tileX && t.tileY === tileY) return t;
      }
      return null;
    }

    tryPlace(player) {
      const type = player.selectedType();
      if (player.inventory[type] <= 0) return false;
      if (this.countByOwner(player.id) >= C.TRAP_LIMIT_PER_PLAYER) return false;

      let tx = player.tileX, ty = player.tileY;

      if (type === 'banana') {
        // Бросок: 3 тайла в текущем направлении.
        const d = dirVec(player.dir);
        let placedAt = null;
        for (let step = 1; step <= C.BANANA_THROW_TILES; step++) {
          const nx = tx + d.x * step;
          const ny = ty + d.y * step;
          if (G.arena.isSolidTile(nx, ny)) break;
          if (this.trapAtTile(nx, ny)) break;
          placedAt = [nx, ny];
        }
        if (!placedAt) return false; // некуда бросить
        tx = placedAt[0]; ty = placedAt[1];
      } else {
        if (G.arena.isSolidTile(tx, ty)) return false;
        if (this.trapAtTile(tx, ty)) return false;
      }

      const trap = new Trap(type, player.id, tx, ty);
      this.list.push(trap);
      player.inventory[type] -= 1;
      G.fx.audio(type === 'banana' ? 'throw' : 'place');
      return true;
    }

    update(dt) {
      for (const t of this.list) t.update(dt, this);
      this.list = this.list.filter((t) => !t.destroyed);
      for (const eff of this.effects) eff.t += dt;
      this.effects = this.effects.filter((eff) => eff.t < eff.lifetime);
    }

    triggerForPlayer(player, tx, ty) {
      if (!player.alive || player.fallen > 0) return;
      // Может быть несколько ловушек на одном тайле? По правилам tryPlace — нет.
      const trap = this.trapAtTile(tx, ty);
      if (!trap) return;
      if (!trap.armed) return;
      const cx = trap.tileX * C.TILE + C.TILE / 2;
      const cy = trap.tileY * C.TILE + C.TILE / 2;
      const fx = G.fx;
      if (trap.type === 'mousetrap') {
        if (player.damage(1)) {
          trap.destroyed = true;
          this.effects.push({ kind: 'snap', x: cx, y: cy, t: 0, lifetime: 0.25 });
          fx.audio('snap');
          fx.shake(4, 0.15);
          fx.particles('burstStars', cx, cy - 8);
        }
      } else if (trap.type === 'puddle') {
        if (!player.sliding) {
          const d = dirVec(player.dir);
          if (d.x !== 0 || d.y !== 0) {
            player.sliding = { dx: d.x, dy: d.y };
            fx.audio('splash');
            fx.particles('burstSplash', cx, cy);
          }
        }
      } else if (trap.type === 'banana') {
        if (!player.sliding) {
          const d = dirVec(player.dir);
          if (d.x !== 0 || d.y !== 0) {
            player.sliding = { dx: d.x, dy: d.y };
            trap.destroyed = true;
            fx.audio('slip');
            fx.particles('burstStars', cx, cy - 8);
          }
        }
      } else if (trap.type === 'trapdoor') {
        player.fallIntoTrapdoor();
        trap.destroyed = true;
        fx.audio('fall');
        fx.shake(5, 0.2);
      }
      // Firecracker не триггерится наступанием — взрывается по таймеру.
    }

    // --- Сериализация для сетевой синхронизации ---
    serialize() {
      return {
        list: this.list.filter(t => !t.destroyed).map(t => ({
          type: t.type,
          ownerId: t.ownerId,
          tileX: t.tileX,
          tileY: t.tileY,
          armDelay: t.armDelay,
          age: t.age,
          fuse: t.fuse,
          life: t.life,
        })),
      };
    }
    applySnapshot(s) {
      this.list = s.list.map(td => {
        const t = new Trap(td.type, td.ownerId, td.tileX, td.tileY);
        t.armDelay = td.armDelay;
        t.age = td.age;
        if (td.fuse !== undefined) t.fuse = td.fuse;
        if (td.life !== undefined) t.life = td.life;
        return t;
      });
    }

    detonateFirecracker(trap) {
      const cx = trap.tileX, cy = trap.tileY;
      const r = C.FIRECRACKER_RADIUS_TILES;
      const px = cx * C.TILE + C.TILE / 2;
      const py = cy * C.TILE + C.TILE / 2;
      this.effects.push({
        kind: 'explosion',
        x: px, y: py,
        t: 0, lifetime: 0.45,
      });
      G.fx.audio('boom');
      G.fx.shake(12, 0.4);
      G.fx.particles('burstSparks', px, py);
      if (!this.players) return;
      for (const p of this.players) {
        if (!p.alive || p.fallen > 0) continue;
        const ptx = p.tileX, pty = p.tileY;
        const dx = ptx - cx;
        const dy = pty - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= r) {
          p.damage(1);
        }
      }
    }
  }

  function dirVec(dir) {
    switch (dir) {
      case 'left':  return { x: -1, y: 0 };
      case 'right': return { x: 1,  y: 0 };
      case 'up':    return { x: 0,  y: -1 };
      case 'down':  return { x: 0,  y: 1 };
    }
    return { x: 0, y: 0 };
  }

  G.Trap = Trap;
  G.TrapManager = TrapManager;
})();
