// Случайные события двора: ветер, мусорный дождь и сирена.
(function () {
  const G = window.G;
  const C = G.config;

  const EVENT_NAMES = {
    wind: 'ВЕТЕР',
    trash: 'МУСОРНЫЙ ДОЖДЬ',
  };

  function randNext() {
    return C.ARENA_EVENT_MIN + Math.random() * (C.ARENA_EVENT_MAX - C.ARENA_EVENT_MIN);
  }
  function dirVec(dir) {
    if (dir === 'left') return { x: -1, y: 0 };
    if (dir === 'right') return { x: 1, y: 0 };
    if (dir === 'up') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }
  function randomFreeTile(players, traps, pickups) {
    for (let i = 0; i < 80; i++) {
      const tx = 1 + Math.floor(Math.random() * (C.ARENA_W - 2));
      const ty = 1 + Math.floor(Math.random() * (C.ARENA_H - 2));
      if (G.arena.isSolidTile(tx, ty)) continue;
      if (traps && traps.trapAtTile(tx, ty)) continue;
      if (pickups && pickups.pickupAtTile(tx, ty)) continue;
      if (players && players.some((p) => p.tileX === tx && p.tileY === ty)) continue;
      return [tx, ty];
    }
    return null;
  }

  class ArenaEventManager {
    constructor() {
      this.nextEvent = randNext();
      this.active = null;
      this.bannerT = 0;
    }

    start(type, players, traps, pickups) {
      this.active = {
        type,
        t: 0,
        duration: C.ARENA_EVENT_DURATION,
        dir: ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)],
      };
      this.bannerT = 2.2;
      if (G.fx) G.fx.audio(type === 'trash' ? 'event_trash' : 'event_wind');
      if (type === 'wind') this.pushLooseStuff(players, traps, pickups);
      if (type === 'trash') this.spawnTrash(players, traps, pickups);
    }

    pushLooseStuff(players, traps, pickups) {
      const d = dirVec(this.active.dir);
      const occupied = new Set();
      for (const p of players || []) occupied.add(p.tileX + ',' + p.tileY);
      for (const t of traps ? traps.list : []) {
        if (!t.destroyed) occupied.add(t.tileX + ',' + t.tileY);
      }
      for (const pk of pickups ? pickups.list : []) occupied.add(pk.tileX + ',' + pk.tileY);

      for (const pk of pickups ? pickups.list : []) {
        const nx = pk.tileX + d.x;
        const ny = pk.tileY + d.y;
        const key = nx + ',' + ny;
        if (G.arena.isSolidTile(nx, ny) || occupied.has(key)) continue;
        occupied.delete(pk.tileX + ',' + pk.tileY);
        pk.tileX = nx; pk.tileY = ny;
        occupied.add(key);
      }
      for (const t of traps ? traps.list : []) {
        if (t.destroyed || (t.type !== 'banana' && t.type !== 'puddle')) continue;
        const nx = t.tileX + d.x;
        const ny = t.tileY + d.y;
        const key = nx + ',' + ny;
        if (G.arena.isSolidTile(nx, ny) || occupied.has(key)) continue;
        occupied.delete(t.tileX + ',' + t.tileY);
        t.tileX = nx; t.tileY = ny;
        occupied.add(key);
      }
      if (G.particles) {
        for (let i = 0; i < 24; i++) {
          G.particles.spawn(
            Math.random() * C.ARENA_PX_W,
            Math.random() * C.ARENA_PX_H,
            { vx: d.x * 110 + (Math.random() - 0.5) * 30, vy: d.y * 110 + (Math.random() - 0.5) * 30, lifetime: 0.6, color: 'rgba(220,230,210,0.45)', size: 2 }
          );
        }
      }
    }

    spawnTrash(players, traps, pickups) {
      if (!pickups) return;
      const types = C.TRAP_TYPES;
      for (let i = 0; i < 3; i++) {
        const tile = randomFreeTile(players, traps, pickups);
        if (!tile) continue;
        pickups.list.push({
          type: types[Math.floor(Math.random() * types.length)],
          tileX: tile[0],
          tileY: tile[1],
          animT: 0,
        });
        if (G.particles) {
          const x = tile[0] * C.TILE + C.TILE / 2;
          const y = tile[1] * C.TILE + C.TILE / 2;
          G.particles.spawnDustCloud(x, y);
        }
      }
    }

    update(dt, players, traps, pickups) {
      if (this.bannerT > 0) this.bannerT = Math.max(0, this.bannerT - dt);
      if (this.active) {
        this.active.t += dt;
        if (this.active.t >= this.active.duration) {
          this.active = null;
          this.nextEvent = randNext();
        }
        return;
      }
      this.nextEvent -= dt;
      if (this.nextEvent <= 0) {
        const type = ['wind', 'trash'][Math.floor(Math.random() * 2)];
        this.start(type, players, traps, pickups);
      }
    }

    speedMul() {
      return 1;
    }

    label() {
      if (!this.active || this.bannerT <= 0) return '';
      return EVENT_NAMES[this.active.type] || '';
    }

    serialize() {
      return {
        nextEvent: this.nextEvent,
        active: this.active ? { ...this.active } : null,
        bannerT: this.bannerT,
      };
    }

    applySnapshot(s) {
      this.nextEvent = s && typeof s.nextEvent === 'number' ? s.nextEvent : randNext();
      this.active = s && s.active ? { ...s.active } : null;
      this.bannerT = s && typeof s.bannerT === 'number' ? s.bannerT : 0;
    }
  }

  G.ArenaEventManager = ArenaEventManager;
})();
