// Класс Player: движение, HP, инвентарь, состояния (sliding/fallen).
// Получает ввод через объект, реализующий isDown(action) / wasPressed(action) / consume().
(function () {
  const G = window.G;
  const C = G.config;

  class Player {
    constructor({ id, character, x, y, input }) {
      this.id = id;             // 1 | 2
      this.character = character; // 'janitor' | 'raccoon'
      this.x = x;
      this.y = y;
      this.input = input;
      this.dir = id === 1 ? 'down' : 'up';
      this.hp = C.PLAYER_MAX_HP;
      this.invincibility = 0;
      this.sliding = null;        // { dx, dy }
      this.fallen = 0;            // секунды в люке
      this.fallReturnAt = null;   // позиция возврата
      this.alive = true;
      this.walkT = 0;
      this.moving = false;
      this.idleT = 0;
      this.stepT = 0;
      this.throwT = 0;
      this.slideT = 0;
      this.inventory = { mousetrap: 0, puddle: 0, firecracker: 0, trapdoor: 0, banana: 0 };
      this.selectedTrap = 0;
      // Power-up состояния
      this.starT = 0;           // звезда: бессмертие + 2x скорость
      this.hiddenT = 0;         // метла: невидимость
      this.dancing = false;     // магнитофон: танец
      this.danceHealT = 0;      // накопитель для heal каждые BOOMBOX_HEAL_INTERVAL
      this.starTouchT = 0;      // cooldown между уронами от касания звездой
      // Стартовые припасы — чтобы прототип сразу был интерактивным.
      this.inventory.mousetrap = 2;
      this.inventory.firecracker = 1;
      this.inventory.puddle = 1;
      this.inventory.trapdoor = 1;
      this.inventory.banana = 1;
    }

    get tileX() { return Math.floor(this.x / C.TILE); }
    get tileY() { return Math.floor(this.y / C.TILE); }

    selectedType() {
      return C.TRAP_TYPES[this.selectedTrap];
    }

    addPickup(type) {
      if (this.inventory[type] >= C.INVENTORY_MAX_PER_TYPE) return false;
      this.inventory[type] += 1;
      return true;
    }

    damage(amount) {
      if (!this.alive) return false;
      if (this.invincibility > 0) return false;
      if (this.starT > 0) return false; // звезда — полный иммунитет
      if (this.fallen > 0) return false;
      this.hp = Math.max(0, this.hp - amount);
      this.invincibility = C.INVINCIBILITY_AFTER_HIT;
      this.sliding = null;
      if (window.G && window.G.audio) {
        window.G.audio.play(this.character === 'raccoon' ? 'hurt_raccoon' : 'hurt_janitor');
      }
      if (this.hp <= 0) {
        this.alive = false;
      }
      return true;
    }

    heal(amount) {
      if (!this.alive) return;
      this.hp = Math.min(C.PLAYER_MAX_HP, this.hp + amount);
    }

    activatePowerup(type) {
      const fx = window.G && window.G.fx;
      if (type === 'star') {
        this.starT = C.STAR_DURATION;
        if (fx) fx.audio('star');
      } else if (type === 'broom') {
        this.hiddenT = C.BROOM_HIDDEN;
        if (fx) {
          fx.audio('broom');
          // Пылевое облако вокруг персонажа (3×3 тайла)
          fx.particles('spawnDustCloud', this.x, this.y);
        }
      } else if (type === 'boombox') {
        // Создать тайл-магнитофон на текущей клетке
        if (window.G && window.G.trapManager) {
          window.G.trapManager.placeBoombox(this);
        }
        this.dancing = true;
        this.danceHealT = 0;
        if (window.G && window.G.audio && window.G.audio.music && window.G.audio.music.setMode) {
          window.G.audio.music.setMode('disco');
        }
        if (fx) fx.audio('boombox_on');
      }
    }

    fallIntoTrapdoor() {
      if (this.fallen > 0) return;
      this.fallen = C.TRAPDOOR_FALL_TIME;
      this.fallReturnAt = { x: this.x, y: this.y };
      this.sliding = null;
    }

    update(dt, traps) {
      if (!this.alive) return;
      if (this.invincibility > 0) this.invincibility -= dt;

      // === Power-up таймеры ===
      if (this.starT > 0) {
        this.starT = Math.max(0, this.starT - dt);
        this.starTouchT = Math.max(0, this.starTouchT - dt);
      }
      if (this.hiddenT > 0) this.hiddenT = Math.max(0, this.hiddenT - dt);

      // === Танец под магнитофон: блокирует движение, лечит ===
      if (this.dancing) {
        if (this.input.wasPressed && this.input.wasPressed('place')) {
          this.dancing = false;
          this.danceHealT = 0;
          if (traps && traps.removeBoomboxFor) traps.removeBoomboxFor(this.id);
          if (window.G && window.G.fx) window.G.fx.audio('boombox_off');
          this.input.consume && this.input.consume();
          return;
        }
        this.danceHealT += dt;
        if (this.danceHealT >= C.BOOMBOX_HEAL_INTERVAL) {
          this.danceHealT -= C.BOOMBOX_HEAL_INTERVAL;
          this.heal(C.BOOMBOX_HEAL_AMOUNT);
          if (window.G && window.G.particles) window.G.particles.burstHearts(this.x, this.y - 16);
        }
        // Анимация: персонаж «топчется на месте», моргаем кадры walk
        this.walkT += dt * 2;
        this.moving = true;
        this.input.consume && this.input.consume();
        return;
      }

      if (this.fallen > 0) {
        this.fallen -= dt;
        if (this.fallen <= 0) {
          this.fallen = 0;
          if (this.fallReturnAt) {
            this.x = this.fallReturnAt.x;
            this.y = this.fallReturnAt.y;
          }
        }
        this.input.consume && this.input.consume();
        return;
      }

      // Скольжение по луже / банану
      if (this.sliding) {
        const speed = C.SLIDE_SPEED;
        const stepX = this.sliding.dx * speed * dt;
        const stepY = this.sliding.dy * speed * dt;
        let blocked = false;
        if (stepX !== 0 && !this.tryMove(stepX, 0)) blocked = true;
        if (stepY !== 0 && !this.tryMove(0, stepY)) blocked = true;
        this.slideT -= dt;
        // Останавливаем только если упёрлись в стену И прошло минимальное время скольжения.
        if (blocked && this.slideT <= 0) {
          this.sliding = null;
        }
        this.dir = dirFromVec(this.sliding ? this.sliding.dx : 0, this.sliding ? this.sliding.dy : 0) || this.dir;
        this.moving = true;
        this.walkT += dt;
        triggerTrapsAt(this, traps);
        return;
      }

      // Тики анимаций «бросок»
      if (this.throwT > 0) this.throwT = Math.max(0, this.throwT - dt);

      // Обычное управление
      let dx = 0, dy = 0;
      if (this.input.isDown('left'))  dx -= 1;
      if (this.input.isDown('right')) dx += 1;
      if (this.input.isDown('up'))    dy -= 1;
      if (this.input.isDown('down'))  dy += 1;

      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv; dy *= inv;
      }
      const speed = C.PLAYER_SPEED * (this.starT > 0 ? C.STAR_SPEED_MUL : 1);
      const moved = this.tryMove(dx * speed * dt, 0) | this.tryMove(0, dy * speed * dt);
      this.moving = (dx !== 0 || dy !== 0);
      if (this.moving) {
        this.walkT += dt;
        this.idleT = 0;
        // Звук шагов и пыль с интервалом
        this.stepT += dt;
        // Енот семенит чаще, дворник топает реже — ощущение веса
        const stepInterval = this.character === 'raccoon' ? 0.24 : 0.34;
        if (this.stepT >= stepInterval) {
          this.stepT = 0;
          if (window.G && window.G.audio) {
            window.G.audio.play(this.character === 'raccoon' ? 'step_raccoon' : 'step_janitor');
          }
          if (window.G && window.G.particles) window.G.particles.spawnDust(this.x, this.y + 12);
        }
        const d = dirFromVec(dx, dy);
        if (d) this.dir = d;
      } else {
        this.walkT = 0;
        this.idleT += dt;
        this.stepT = 0;
      }

      // Действия
      if (this.input.wasPressed && this.input.wasPressed('switchNext')) {
        this.selectedTrap = (this.selectedTrap + 1) % C.TRAP_TYPES.length;
      }
      if (this.input.wasPressed && this.input.wasPressed('switchPrev')) {
        const n = C.TRAP_TYPES.length;
        this.selectedTrap = (this.selectedTrap - 1 + n) % n;
      }
      if (this.input.wasPressed && this.input.wasPressed('place')) {
        traps.tryPlace(this);
      }

      triggerTrapsAt(this, traps);
    }

    tryMove(dx, dy) {
      if (dx === 0 && dy === 0) return false;
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (G.arena.isSolidPx(nx, this.y) && dx !== 0) return false;
      if (G.arena.isSolidPx(this.x, ny) && dy !== 0) return false;
      this.x = nx;
      this.y = ny;
      return true;
    }

    // --- Сериализация для сетевой синхронизации ---
    serialize() {
      return {
        id: this.id,
        character: this.character,
        x: this.x, y: this.y,
        dir: this.dir,
        hp: this.hp,
        invincibility: this.invincibility,
        sliding: this.sliding,
        fallen: this.fallen,
        alive: this.alive,
        walkT: this.walkT,
        moving: this.moving,
        idleT: this.idleT,
        throwT: this.throwT,
        inventory: { ...this.inventory },
        selectedTrap: this.selectedTrap,
        starT: this.starT,
        hiddenT: this.hiddenT,
        dancing: this.dancing,
        danceHealT: this.danceHealT,
      };
    }
    applySnapshot(s) {
      this.x = s.x; this.y = s.y;
      this.dir = s.dir;
      this.hp = s.hp;
      this.invincibility = s.invincibility;
      this.sliding = s.sliding;
      this.fallen = s.fallen;
      this.alive = s.alive;
      this.walkT = s.walkT;
      this.moving = s.moving;
      this.idleT = s.idleT;
      this.throwT = s.throwT || 0;
      this.inventory = { ...s.inventory };
      this.selectedTrap = s.selectedTrap;
      this.starT = s.starT || 0;
      this.hiddenT = s.hiddenT || 0;
      this.dancing = !!s.dancing;
      this.danceHealT = s.danceHealT || 0;
    }
  }

  function dirFromVec(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) return 'right';
      if (dx < 0) return 'left';
    } else {
      if (dy > 0) return 'down';
      if (dy < 0) return 'up';
    }
    return null;
  }

  function triggerTrapsAt(player, traps) {
    if (!player.alive || player.fallen > 0) return;
    const tx = player.tileX;
    const ty = player.tileY;
    traps.triggerForPlayer(player, tx, ty);
  }

  G.Player = Player;
})();
