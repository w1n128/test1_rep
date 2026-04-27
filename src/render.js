// Отрисовка: split-screen камеры, сцена, ловушки (с правилами видимости),
// пикапы, эффекты, игроки. Пол + препятствия запекаются один раз в worldCanvas.
(function () {
  const G = window.G;
  const C = G.config;

  let worldCanvas = null;
  let shakeI = 0;
  let shakeT = 0;

  function shake(intensity, duration) {
    shakeI = Math.max(shakeI, intensity);
    shakeT = Math.max(shakeT, duration);
  }
  function updateShake(dt) {
    if (shakeT > 0) {
      shakeT -= dt;
      shakeI *= Math.exp(-3 * dt);
      if (shakeT <= 0) { shakeT = 0; shakeI = 0; }
    }
  }
  function shakeOffset() {
    if (shakeT <= 0) return [0, 0];
    return [
      (Math.random() - 0.5) * shakeI * 2,
      (Math.random() - 0.5) * shakeI * 2,
    ];
  }

  function init() {
    worldCanvas = document.createElement('canvas');
    worldCanvas.width = C.ARENA_PX_W;
    worldCanvas.height = C.ARENA_PX_H;
    const wctx = worldCanvas.getContext('2d');
    // Пол
    for (let y = 0; y < C.ARENA_H; y++) {
      for (let x = 0; x < C.ARENA_W; x++) {
        wctx.drawImage(G.tiles.floor, x * C.TILE, y * C.TILE);
      }
    }
    // Препятствия
    for (const [tx, ty, kind] of G.arena.obstacles) {
      const sprite = G.tiles[kind];
      if (sprite) wctx.drawImage(sprite, tx * C.TILE, ty * C.TILE);
    }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function isTrapVisible(trap, viewerId) {
    // Банан во время полёта (armDelay > 0) не показываем никому — будет проектил.
    if (trap.type === 'banana' && !trap.armed) return false;
    if (trap.ownerId === viewerId) return true;
    if (trap.type === 'trapdoor') return false;
    if (!trap.armed) return false;
    return true;
  }

  function drawTraps(ctx, traps, viewerId, time) {
    for (const trap of traps.list) {
      if (!isTrapVisible(trap, viewerId)) continue;
      const sprite = G.sprites.traps[trap.type];
      const px = trap.tileX * C.TILE;
      const py = trap.tileY * C.TILE;
      let alpha = 1;
      if (trap.ownerId === viewerId && !trap.armed) alpha = 0.55;
      if (trap.type === 'firecracker' && trap.armed) {
        // мерцание ближе к взрыву
        const blink = Math.floor((C.FIRECRACKER_FUSE - trap.fuse) * 8) % 2;
        alpha = blink ? 1 : 0.7;
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, px, py);
      ctx.globalAlpha = 1;
      // Контур люка для владельца — чтобы помнить, где поставил
      if (trap.type === 'trapdoor' && trap.ownerId === viewerId) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, C.TILE - 1, C.TILE - 1);
      }
    }
  }

  function drawPickups(ctx, pickups, time) {
    const bgW = G.sprites.pickupBg.width;
    const bgOff = (C.TILE - bgW) / 2;
    const iconSize = C.TILE / 2;
    const iconOff = (C.TILE - iconSize) / 2;
    for (const pk of pickups.list) {
      const px = pk.tileX * C.TILE;
      const py = pk.tileY * C.TILE;
      const bob = Math.sin(pk.animT * 4) * 1.5;
      // Жёлтый светящийся круг — фон
      ctx.drawImage(G.sprites.pickupBg, px + bgOff, py + bgOff + bob);
      // Иконка ловушки в 2 раза меньше тайла, центрирована
      const trap = G.sprites.traps[pk.type];
      ctx.drawImage(trap, px + iconOff, py + iconOff + bob, iconSize, iconSize);
    }
  }

  function drawEffects(ctx, effects) {
    for (const eff of effects) {
      if (eff.kind === 'explosion') {
        const frames = G.sprites.explosion;
        const idx = Math.min(frames.length - 1, Math.floor(eff.t / eff.lifetime * frames.length));
        const sprite = frames[idx];
        ctx.drawImage(sprite, eff.x - sprite.width / 2, eff.y - sprite.height / 2);
      } else if (eff.kind === 'snap') {
        ctx.fillStyle = `rgba(255,255,255,${1 - eff.t / eff.lifetime})`;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, 12 + eff.t * 64, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.kind === 'banana_throw') {
        const a = Math.min(1, eff.t / eff.lifetime);
        const x = eff.fromX + (eff.toX - eff.fromX) * a;
        // Параболическая дуга: пиковая высота 28 px в середине
        const arc = 28 * Math.sin(a * Math.PI);
        const y = eff.fromY + (eff.toY - eff.fromY) * a - arc;
        const sprite = G.sprites.traps.banana;
        const size = 24;
        // Лёгкое вращение через scaleX знак
        const flip = (Math.floor(eff.t * 16) % 2) ? -1 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flip, 1);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }

  function drawPlayer(ctx, p, viewer, time) {
    if (p.fallen > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (p.invincibility > 0 && Math.floor(time * 16) % 2 === 0) return;
    if (!p.alive) return;

    // Скрытность Енота: для камеры Дворника после паузы становится прозрачным
    let alpha = 1;
    if (
      p.character === 'raccoon' &&
      viewer && viewer.id !== p.id &&
      viewer.character === 'janitor' &&
      p.idleT > C.STEALTH_IDLE_TIME
    ) {
      const fade = (p.idleT - C.STEALTH_IDLE_TIME) / C.STEALTH_FADE_TIME;
      if (fade >= 1) return; // полностью невидим
      alpha = 1 - fade * 0.92; // оставим лёгкий призрак
    }

    const sprites = G.sprites[p.character];
    let frame;
    if (p.sliding) {
      frame = sprites['slide_' + p.dir] || sprites[p.dir][0];
    } else if (p.throwT > 0) {
      frame = sprites['throw_' + p.dir] || sprites[p.dir][0];
    } else {
      const anim = sprites[p.dir];
      frame = anim[0];
      if (p.moving) {
        const idx = Math.floor(p.walkT / 0.18) % anim.length;
        frame = anim[idx];
      }
    }
    const half = C.TILE / 2;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(frame, Math.round(p.x - half), Math.round(p.y - half));
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  function drawViewport(ctx, viewer, players, traps, pickups, x, y, w, h, time) {
    const camX = clamp(viewer.x - w / 2, 0, Math.max(0, C.ARENA_PX_W - w));
    const camY = clamp(viewer.y - h / 2, 0, Math.max(0, C.ARENA_PX_H - h));

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.translate(x - Math.round(camX), y - Math.round(camY));

    // Запечённый мир
    ctx.drawImage(worldCanvas, 0, 0);

    // Динамика
    drawPickups(ctx, pickups, time);
    drawTraps(ctx, traps, viewer.id, time);
    drawEffects(ctx, traps.effects);
    if (G.particles) G.particles.draw(ctx);
    for (const p of players) drawPlayer(ctx, p, viewer, time);

    ctx.restore();
  }

  function drawSplitScreen(ctx, players, traps, pickups, time) {
    const C_ = C;
    const vw = C_.VIEWPORT_W;
    const vh = C_.VIEWPORT_H;
    const gap = C_.SPLIT_GAP;

    const [sx, sy] = shakeOffset();
    if (sx || sy) {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    // Фон между половинами
    ctx.fillStyle = G.PALETTE.splitBar;
    ctx.fillRect(0, vh, C_.CANVAS_W, gap);

    drawViewport(ctx, players[0], players, traps, pickups, 0, 0, vw, vh, time);
    drawViewport(ctx, players[1], players, traps, pickups, 0, vh + gap, vw, vh, time);

    if (sx || sy) ctx.restore();

    // HUD поверх (без шейка)
    G.hud.drawHUD(ctx, players[0], players, traps, pickups, 0, 0, vw, vh);
    G.hud.drawHUD(ctx, players[1], players, traps, pickups, 0, vh + gap, vw, vh);
  }

  function drawSingleScreen(ctx, viewer, players, traps, pickups, time) {
    const C_ = C;
    const [sx, sy] = shakeOffset();
    if (sx || sy) {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    drawViewport(ctx, viewer, players, traps, pickups, 0, 0, C_.CANVAS_W, C_.CANVAS_H, time);

    if (sx || sy) ctx.restore();

    // HUD на полную ширину
    G.hud.drawHUD(ctx, viewer, players, traps, pickups, 0, 0, C_.CANVAS_W, C_.CANVAS_H);
  }

  G.render = { init, drawSplitScreen, drawSingleScreen, shake, updateShake };
})();
