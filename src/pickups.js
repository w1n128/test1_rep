// Менеджер припасов: спавн, подбор, лимиты.
(function () {
  const G = window.G;
  const C = G.config;

  class PickupManager {
    constructor() {
      this.list = [];
      this.spawnTimer = 1.5;
      this.nextSpawn = 1.5;
      this.players = null;
      this.traps = null;
    }
    serialize() {
      return {
        list: this.list.map(p => ({
          type: p.type, tileX: p.tileX, tileY: p.tileY, animT: p.animT,
        })),
      };
    }
    applySnapshot(s) {
      this.list = s.list.map(p => ({ ...p }));
    }
    setRefs(players, traps) {
      this.players = players;
      this.traps = traps;
    }
    pickupAtTile(tx, ty) {
      for (const p of this.list) if (p.tileX === tx && p.tileY === ty) return p;
      return null;
    }
    isTileBlocked(tx, ty) {
      if (G.arena.isSolidTile(tx, ty)) return true;
      if (this.traps && this.traps.trapAtTile(tx, ty)) return true;
      if (this.pickupAtTile(tx, ty)) return true;
      if (this.players) {
        for (const p of this.players) {
          if (p.tileX === tx && p.tileY === ty) return true;
        }
      }
      return false;
    }
    spawnRandom() {
      // С шансом POWERUP_SPAWN_CHANCE — power-up, иначе обычная ловушка
      let type;
      if (Math.random() < C.POWERUP_SPAWN_CHANCE) {
        type = C.POWERUP_TYPES[Math.floor(Math.random() * C.POWERUP_TYPES.length)];
      } else {
        type = C.TRAP_TYPES[Math.floor(Math.random() * C.TRAP_TYPES.length)];
      }
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = 1 + Math.floor(Math.random() * (C.ARENA_W - 2));
        const y = 1 + Math.floor(Math.random() * (C.ARENA_H - 2));
        if (this.isTileBlocked(x, y)) continue;
        this.list.push({ type, tileX: x, tileY: y, animT: 0 });
        return;
      }
    }
    update(dt) {
      this.spawnTimer += dt;
      if (this.list.length < C.PICKUP_LIMIT_ON_MAP && this.spawnTimer >= this.nextSpawn) {
        this.spawnRandom();
        this.spawnTimer = 0;
        this.nextSpawn = C.PICKUP_SPAWN_MIN + Math.random() * (C.PICKUP_SPAWN_MAX - C.PICKUP_SPAWN_MIN);
      }
      for (const p of this.list) p.animT += dt;

      if (!this.players) return;
      for (const player of this.players) {
        if (!player.alive || player.fallen > 0) continue;
        if (player.dancing) continue; // танцующий не подбирает
        const pk = this.pickupAtTile(player.tileX, player.tileY);
        if (pk) {
          if (C.POWERUP_TYPES.indexOf(pk.type) >= 0) {
            // Power-up: активируется мгновенно
            player.activatePowerup(pk.type);
            this.list = this.list.filter((p) => p !== pk);
            G.fx.audio('pickup');
            G.fx.particles('burstStars', player.x, player.y - 8);
          } else if (player.addPickup(pk.type)) {
            this.list = this.list.filter((p) => p !== pk);
            G.fx.audio('pickup');
            G.fx.particles('burstStars', player.x, player.y - 8);
          }
        }
      }
    }
  }

  G.PickupManager = PickupManager;
})();
