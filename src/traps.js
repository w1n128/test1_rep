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
      if (this.type === 'banana') {
        this.life -= dt;
        if (this.life <= 0) this.destroyed = true;
      }
    }
  }

  class TrapManager {
    constructor() {
      this.list = [];
      this.effects = [];
      this.pulls = [];
      this.players = null;
    }
    setPlayers(players) { this.players = players; }

    countByOwner(ownerId) {
      let n = 0;
      for (const t of this.list) {
        if (!t.destroyed && t.ownerId === ownerId && t.type !== 'boombox') n++;
      }
      return n;
    }

    boomboxOf(ownerId) {
      for (const t of this.list) {
        if (!t.destroyed && t.type === 'boombox' && t.ownerId === ownerId) return t;
      }
      return null;
    }

    removeBoomboxFor(ownerId) {
      let removed = false;
      for (const t of this.list) {
        if (!t.destroyed && t.type === 'boombox' && t.ownerId === ownerId) {
          t.destroyed = true;
          removed = true;
        }
      }
      return removed;
    }

    placeBoombox(player) {
      // Снимем старый магнитофон того же владельца, если был
      const old = this.boomboxOf(player.id);
      if (old) old.destroyed = true;
      const trap = new Trap('boombox', player.id, player.tileX, player.tileY);
      trap.armDelay = 0;
      this.list.push(trap);
    }

    trapAtTile(tileX, tileY) {
      for (const t of this.list) {
        if (!t.destroyed && t.tileX === tileX && t.tileY === tileY) return t;
      }
      return null;
    }

    pullFor(playerId) {
      for (const p of this.pulls) {
        if (p.targetId === playerId && p.t < p.lifetime) return p;
      }
      return null;
    }

    useBait(player, type) {
      if (C.BAIT_TYPES.indexOf(type) < 0) return false;
      if (player.inventory[type] <= 0) return false;
      if (!this.players) return false;
      const target = this.players.find((p) => p.id !== player.id && p.alive);
      if (!target) return false;
      player.inventory[type] -= 1;
      this.pulls = this.pulls.filter((p) => p.targetId !== target.id);
      this.pulls.push({
        type,
        sourceId: player.id,
        targetId: target.id,
        x: player.x,
        y: player.y,
        t: 0,
        lifetime: C.BAIT_PULL_DURATION,
      });
      if (G.fx) {
        G.fx.audio(type === 'pizza' ? 'bait_pizza' : 'bait_diamond');
        G.fx.particles('burstStars', player.x, player.y - 8);
      }
      return true;
    }

    tryPlace(player) {
      const type = player.selectedType();
      if (player.inventory[type] <= 0) return false;
      if (C.COMBAT_TYPES.indexOf(type) >= 0) return false;
      if (C.BAIT_TYPES.indexOf(type) >= 0) return this.useBait(player, type);
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
      // Запустить анимацию броска для банана
      if (type === 'banana') {
        player.throwT = C.THROW_ANIM_TIME;
        const fromX = player.x;
        const fromY = player.y;
        const toX = tx * C.TILE + C.TILE / 2;
        const toY = ty * C.TILE + C.TILE / 2;
        this.effects.push({
          kind: 'banana_throw',
          fromX, fromY, toX, toY,
          t: 0, lifetime: C.BANANA_FLIGHT_TIME,
        });
        // Пока банан летит — задержим его активацию: вместо обычного armDelay
        // используем длительность полёта.
        trap.armDelay = C.BANANA_FLIGHT_TIME;
      }
      return true;
    }

    playerInFrontOf(player) {
      if (!this.players) return null;
      const d = dirVec(player.dir);
      const tx = player.tileX + d.x;
      const ty = player.tileY + d.y;
      return this.players.find((p) => (
        p.id !== player.id &&
        p.alive &&
        p.fallen <= 0 &&
        p.tileX === tx &&
        p.tileY === ty
      )) || null;
    }

    tryMelee(player) {
      const type = player.selectedType();
      if (C.COMBAT_TYPES.indexOf(type) < 0) return false;
      if (player.inventory[type] <= 0) return false;

      const d = dirVec(player.dir);
      const tx = player.tileX + d.x;
      const ty = player.tileY + d.y;
      const cx = tx * C.TILE + C.TILE / 2;
      const cy = ty * C.TILE + C.TILE / 2;
      const target = this.playerInFrontOf(player);
      player.attackT = C.MELEE_EFFECT_TIME;

      if (G.fx) {
        G.fx.audio(type === 'cone' ? 'cone_swing' : 'melee_swing');
        this.effects.push({ kind: type === 'cone' ? 'cone_swing' : 'melee_swing', x: cx, y: cy, dir: player.dir, t: 0, lifetime: C.MELEE_EFFECT_TIME });
      }
      if (!target) return false;

      if (type === 'branch') {
        if (target.damage(1)) {
          player.inventory.branch = Math.max(0, player.inventory.branch - 1);
          if (G.fx) {
            G.fx.audio(target.character === 'raccoon' ? 'melee_hit_raccoon' : 'melee_hit_janitor');
            G.fx.shake(4, 0.14);
            G.fx.particles('burstStars', target.x, target.y - 14);
            this.effects.push({ kind: 'bonk', x: target.x, y: target.y - 18, t: 0, lifetime: 0.55 });
          }
        }
      } else if (type === 'cone') {
        target.stunWithCone();
        player.inventory.cone = Math.max(0, player.inventory.cone - 1);
        if (G.fx) {
          G.fx.audio('cone_hit');
          G.fx.shake(3, 0.12);
          G.fx.particles('burstStars', target.x, target.y - 16);
          this.effects.push({ kind: 'cone_pop', x: target.x, y: target.y - 20, t: 0, lifetime: 0.55 });
        }
      }
      return true;
    }

    update(dt) {
      for (const t of this.list) t.update(dt, this);
      this.list = this.list.filter((t) => !t.destroyed);
      for (const p of this.pulls) p.t += dt;
      this.pulls = this.pulls.filter((p) => p.t < p.lifetime);
      for (const eff of this.effects) eff.t += dt;
      this.effects = this.effects.filter((eff) => eff.t < eff.lifetime);
    }

    triggerForPlayer(player, tx, ty) {
      if (!player.alive || player.fallen > 0) return;
      // Магнитофон обрабатываем отдельно: при пробегании ДРУГОГО игрока — выключаем
      for (const t of this.list) {
        if (t.destroyed) continue;
        if (t.type === 'boombox' && t.tileX === tx && t.tileY === ty && t.ownerId !== player.id) {
          // Найти владельца и снять танец
          if (this.players) {
            for (const p of this.players) {
              if (p.id === t.ownerId) {
                p.dancing = false;
                p.danceHealT = 0;
              }
            }
          }
          t.destroyed = true;
          if (G.fx) G.fx.audio('boombox_off');
        }
      }
      // Может быть несколько ловушек на одном тайле? По правилам tryPlace — нет.
      const trap = this.trapAtTile(tx, ty);
      if (!trap) return;
      if (!trap.armed) return;
      if (trap.type === 'boombox') return; // дальнейшая логика — только обычные ловушки
      const cx = trap.tileX * C.TILE + C.TILE / 2;
      const cy = trap.tileY * C.TILE + C.TILE / 2;
      const fx = G.fx;
      if (trap.type === 'mousetrap') {
        if (player.damage(1)) {
          trap.destroyed = true;
          this.effects.push({ kind: 'snap', x: cx, y: cy, t: 0, lifetime: 0.25 });
          fx.audio('mousetrap_snap');
          fx.audio('trap_mousetrap_hit');
          fx.shake(5, 0.18);
          this.effects.push({ kind: 'bonk', x: player.x, y: player.y - 18, t: 0, lifetime: 0.55 });
          // Звёздочки от удара — спавним прямо около персонажа
          fx.particles('burstStars', player.x, player.y - 14);
          fx.particles('burstStars', player.x - 8, player.y - 8);
          fx.particles('burstStars', player.x + 8, player.y - 8);
        }
      } else if (trap.type === 'banana') {
        if (!player.sliding) {
          const d = dirVec(player.dir);
          if (d.x !== 0 || d.y !== 0) {
            // Сначала урон, потом скольжение (damage() сбрасывает sliding).
            player.damage(1);
            player.sliding = { dx: d.x, dy: d.y };
            player.slideT = C.SLIDE_MIN_TIME;
            trap.destroyed = true;
            fx.audio('slip');
            fx.audio('trap_banana_hit');
            fx.particles('burstStars', cx, cy - 8);
            this.effects.push({ kind: 'spin', x: player.x, y: player.y - 18, t: 0, lifetime: 0.6 });
          }
        }
      } else if (trap.type === 'trapdoor') {
        // Сначала урон, затем падение (damage пропускает игроков с fallen>0).
        player.damage(1);
        player.fallIntoTrapdoor();
        trap.destroyed = true;
        fx.audio('fall');
        fx.audio('trap_trapdoor_hit');
        fx.shake(5, 0.2);
        fx.particles('burstStars', cx, cy - 8);
        this.effects.push({ kind: 'fall_puff', x: cx, y: cy, t: 0, lifetime: 0.55 });
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
        pulls: this.pulls.map(p => ({ ...p })),
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
      this.pulls = (s.pulls || []).map(p => ({ ...p }));
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
          if (p.damage(1)) {
            G.fx.audio('trap_firecracker_hit');
            this.effects.push({ kind: 'scorch', x: p.x, y: p.y - 18, t: 0, lifetime: 0.7 });
          }
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
