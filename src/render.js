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
  function tileKey(tx, ty) { return tx + ',' + ty; }
  function pxToTile(v) { return Math.floor(v / C.TILE); }
  function dirVec(dir) {
    if (dir === 'left') return { x: -1, y: 0 };
    if (dir === 'right') return { x: 1, y: 0 };
    if (dir === 'up') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }
  function nightState(matchTime) {
    const cycle = C.NIGHT_DAY_DURATION + C.NIGHT_DURATION;
    const phase = ((matchTime % cycle) + cycle) % cycle;
    const active = phase >= C.NIGHT_DAY_DURATION;
    const remaining = active ? cycle - phase : C.NIGHT_DAY_DURATION - phase;
    return { active, remaining };
  }
  function buildLightTiles(viewer) {
    const lit = new Set();
    let tx = viewer.tileX;
    let ty = viewer.tileY;
    lit.add(tileKey(tx, ty));
    const d = dirVec(viewer.dir);
    for (let i = 0; i < C.FLASHLIGHT_TILES; i++) {
      tx += d.x;
      ty += d.y;
      if (tx < 0 || ty < 0 || tx >= C.ARENA_W || ty >= C.ARENA_H) break;
      if (G.arena.isSolidTile(tx, ty)) break;
      lit.add(tileKey(tx, ty));
    }
    return lit;
  }
  function isLitTile(lit, tx, ty) {
    return !lit || lit.has(tileKey(tx, ty));
  }
  function isLitPx(lit, x, y) {
    return isLitTile(lit, pxToTile(x), pxToTile(y));
  }

  function isTrapVisible(trap, viewerId) {
    // Банан во время полёта (armDelay > 0) не показываем никому — будет проектил.
    if (trap.type === 'banana' && !trap.armed) return false;
    if (trap.ownerId === viewerId) return true;
    if (trap.type === 'trapdoor') return false;
    if (!trap.armed) return false;
    return true;
  }

  function drawTraps(ctx, traps, viewerId, time, litTiles) {
    const trapDrawSize = Math.round(C.TILE * 2 / 3);
    const trapDrawOff = (C.TILE - trapDrawSize) / 2;
    for (const trap of traps.list) {
      if (!isTrapVisible(trap, viewerId)) continue;
      if (!isLitTile(litTiles, trap.tileX, trap.tileY)) continue;
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
      ctx.drawImage(sprite, px + trapDrawOff, py + trapDrawOff, trapDrawSize, trapDrawSize);
      ctx.globalAlpha = 1;
      // Контур люка для владельца — чтобы помнить, где поставил
      if (trap.type === 'trapdoor' && trap.ownerId === viewerId) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, C.TILE - 1, C.TILE - 1);
      }
    }
  }

  function drawPickups(ctx, pickups, time, litTiles) {
    const bgW = G.sprites.pickupBg.width;
    const bgOff = (C.TILE - bgW) / 2;
    const iconSize = 17;
    const iconOff = (C.TILE - iconSize) / 2;
    for (const pk of pickups.list) {
      if (!isLitTile(litTiles, pk.tileX, pk.tileY)) continue;
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

  function drawEffects(ctx, effects, litTiles) {
    for (const eff of effects) {
      if (eff.kind === 'explosion') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const frames = G.sprites.explosion;
        const idx = Math.min(frames.length - 1, Math.floor(eff.t / eff.lifetime * frames.length));
        const sprite = frames[idx];
        ctx.drawImage(sprite, eff.x - sprite.width / 2, eff.y - sprite.height / 2);
      } else if (eff.kind === 'snap') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
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
        if (!isLitPx(litTiles, x, y)) continue;
        const sprite = G.sprites.traps.banana;
        const size = 15;
        // Лёгкое вращение через scaleX знак
        const flip = (Math.floor(eff.t * 16) % 2) ? -1 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flip, 1);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else if (eff.kind === 'bonk') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffe860';
        for (let i = 0; i < 3; i++) {
          const a = k * 4 + i * Math.PI * 2 / 3;
          const x = eff.x + Math.cos(a) * (8 + k * 10);
          const y = eff.y + Math.sin(a) * (5 + k * 7);
          ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
        }
        ctx.restore();
      } else if (eff.kind === 'wet') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#9addff';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(Math.round(eff.x - 10 + i * 5), Math.round(eff.y + k * 18 - (i % 2) * 4), 2, 5);
        }
        ctx.restore();
      } else if (eff.kind === 'spin') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff060';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, 10 + k * 8, k * 8, k * 8 + Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      } else if (eff.kind === 'fall_puff') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillStyle = '#d4c8a0';
        ctx.beginPath();
        ctx.ellipse(eff.x, eff.y + 8, 20 + k * 18, 7 + k * 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (eff.kind === 'scorch') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#222';
        ctx.fillRect(Math.round(eff.x - 8), Math.round(eff.y + k * 6), 16, 8);
        ctx.fillStyle = '#ff8822';
        ctx.fillRect(Math.round(eff.x - 5), Math.round(eff.y - 5 - k * 8), 3, 6);
        ctx.fillRect(Math.round(eff.x + 3), Math.round(eff.y - 8 - k * 8), 3, 6);
        ctx.restore();
      } else if (eff.kind === 'melee_swing' || eff.kind === 'cone_swing') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        const sprite = eff.kind === 'cone_swing' ? G.sprites.traps.cone : G.sprites.traps.branch;
        const size = eff.kind === 'cone_swing' ? 22 : 26;
        const angle = eff.dir === 'right' ? 0.6 : eff.dir === 'left' ? -2.55 : eff.dir === 'up' ? -1.2 : 1.95;
        ctx.save();
        ctx.globalAlpha = 0.85 * (1 - k * 0.2);
        ctx.translate(eff.x, eff.y);
        ctx.rotate(angle + (k - 0.5) * 1.0);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else if (eff.kind === 'cone_pop') {
        if (!isLitPx(litTiles, eff.x, eff.y)) continue;
        const k = eff.t / eff.lifetime;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffb05a';
        ctx.fillRect(Math.round(eff.x - 12), Math.round(eff.y - 4 - k * 10), 24, 3);
        ctx.fillStyle = '#fff1d0';
        ctx.fillRect(Math.round(eff.x - 8), Math.round(eff.y - 8 - k * 10), 16, 2);
        ctx.restore();
      }
    }
  }

  function drawPulls(ctx, pulls, litTiles) {
    if (!pulls) return;
    for (const p of pulls) {
      if (!isLitPx(litTiles, p.x, p.y)) continue;
      const k = p.t / p.lifetime;
      const pulse = 0.5 + 0.5 * Math.sin(p.t * 18);
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - k * 0.35);
      ctx.strokeStyle = p.type === 'pizza' ? '#ffd86a' : '#45d8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.type === 'pizza' ? '#ffd86a' : '#d8fbff';
      for (let i = 0; i < 6; i++) {
        const a = p.t * 5 + i * Math.PI / 3;
        ctx.fillRect(
          Math.round(p.x + Math.cos(a) * (22 + pulse * 6) - 2),
          Math.round(p.y + Math.sin(a) * (22 + pulse * 6) - 2),
          4,
          4
        );
      }
      ctx.restore();
    }
  }

  function drawPlayer(ctx, p, viewer, time, litTiles) {
    if (p.fallen > 0) {
      if (p.id !== viewer.id && !isLitPx(litTiles, p.x, p.y)) return;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (p.invincibility > 0 && p.starT <= 0 && Math.floor(time * 16) % 2 === 0) return;
    if (!p.alive) return;
    if (p.id !== viewer.id && !isLitPx(litTiles, p.x, p.y)) return;

    // Невидимость от метлы: для чужого viewer полностью скрыт
    if (p.hiddenT > 0 && viewer && viewer.id !== p.id) {
      // лёгкий мерцающий «шорох» вокруг — намёк, где может быть
      if (Math.floor(time * 4) % 2 === 0) {
        ctx.fillStyle = 'rgba(180,168,130,0.18)';
        ctx.fillRect(p.x - 6, p.y - 4, 12, 8);
      }
      return;
    }

    // Свечение звезды: золотой ореол + лёгкая тёмно-оранжевая обводка
    if (p.starT > 0) {
      const pulse = 0.55 + 0.25 * Math.sin(time * 12);
      const half = C.TILE / 2;
      const grad = ctx.createRadialGradient(p.x, p.y, half * 0.4, p.x, p.y, half * 1.05);
      grad.addColorStop(0, `rgba(255, 232, 56, ${0.45 * pulse})`);
      grad.addColorStop(1, 'rgba(255, 148, 16, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, half * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // Свой игрок под метлой — полупрозрачный (видит сам себя как «призрак»)
    let alpha = 1;
    if (p.hiddenT > 0) alpha = 0.55;
    if (p.starT > 0 && Math.floor(time * 12) % 2 === 0) alpha = Math.min(alpha, 0.38);

    // Скрытность Енота: для камеры Дворника после паузы становится прозрачным
    if (
      p.character === 'raccoon' &&
      viewer && viewer.id !== p.id &&
      viewer.character === 'janitor' &&
      p.idleT > C.STEALTH_IDLE_TIME
    ) {
      const fade = (p.idleT - C.STEALTH_IDLE_TIME) / C.STEALTH_FADE_TIME;
      if (fade >= 1) return; // полностью невидим
      alpha = Math.min(alpha, 1 - fade * 0.92);
    }

    const sprites = G.sprites[p.character];
    let frame;
    if (p.dancing && sprites.dance) {
      frame = sprites.dance[Math.floor(time / 0.5) % sprites.dance.length];
    } else if (p.sliding) {
      frame = sprites['slide_' + p.dir] || sprites[p.dir][0];
    } else if (p.attackT > 0) {
      frame = sprites['throw_' + p.dir] || sprites[p.dir][0];
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
    const visualScale = p.character === 'raccoon' ? 0.8 : 1;
    const drawW = Math.round(C.TILE * visualScale);
    const drawH = Math.round(C.TILE * visualScale);
    const drawX = Math.round(p.x - drawW / 2);
    const drawY = Math.round(p.y - drawH / 2);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(frame, drawX, drawY, drawW, drawH);
    if (p.coneT > 0 && G.sprites.traps.cone) {
      const coneSize = Math.round(drawW * 0.5);
      ctx.drawImage(G.sprites.traps.cone, Math.round(p.x - coneSize / 2), Math.round(drawY - coneSize * 0.2), coneSize, coneSize);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
    if (p.starT > 0 && Math.floor(time * 12) % 2 === 1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.32;
      ctx.drawImage(frame, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawNightOverlay(ctx, litTiles) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 12, 38, 0.56)';
    ctx.fillRect(0, 0, C.ARENA_PX_W, C.ARENA_PX_H);
    ctx.globalCompositeOperation = 'screen';
    for (const key of litTiles) {
      const parts = key.split(',');
      const tx = Number(parts[0]);
      const ty = Number(parts[1]);
      const px = tx * C.TILE;
      const py = ty * C.TILE;
      const grad = ctx.createRadialGradient(
        px + C.TILE / 2, py + C.TILE / 2, C.TILE * 0.12,
        px + C.TILE / 2, py + C.TILE / 2, C.TILE * 0.78
      );
      grad.addColorStop(0, 'rgba(255, 244, 170, 0.34)');
      grad.addColorStop(1, 'rgba(255, 244, 170, 0.04)');
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, C.TILE, C.TILE);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawViewport(ctx, viewer, players, traps, pickups, x, y, w, h, time, night) {
    const camX = clamp(viewer.x - w / 2, 0, Math.max(0, C.ARENA_PX_W - w));
    const camY = clamp(viewer.y - h / 2, 0, Math.max(0, C.ARENA_PX_H - h));
    const litTiles = night.active ? buildLightTiles(viewer) : null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.translate(x - Math.round(camX), y - Math.round(camY));

    if (night.active) ctx.filter = 'saturate(50%)';

    // Запечённый мир
    ctx.drawImage(worldCanvas, 0, 0);

    // Динамика
    drawPickups(ctx, pickups, time, litTiles);
    drawTraps(ctx, traps, viewer.id, time, litTiles);
    drawEffects(ctx, traps.effects, litTiles);
    drawPulls(ctx, traps.pulls, litTiles);
    if (G.particles) G.particles.draw(ctx, litTiles ? ((px, py) => isLitPx(litTiles, px, py)) : null);
    for (const p of players) drawPlayer(ctx, p, viewer, time, litTiles);
    if (night.active) {
      ctx.filter = 'none';
      drawNightOverlay(ctx, litTiles);
    }

    ctx.restore();
  }

  function drawNightHud(ctx, night, x, y, w) {
    if (!night.active) return;
    const label = 'НОЧЬ ' + Math.ceil(night.remaining) + 'с';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace';
    const tx = x + w / 2;
    ctx.fillStyle = 'rgba(5,12,38,0.78)';
    ctx.fillRect(tx - 42, y + 78, 84, 18);
    ctx.strokeStyle = 'rgba(160,224,255,0.5)';
    ctx.strokeRect(tx - 42.5, y + 78.5, 83, 17);
    ctx.fillStyle = '#a0e0ff';
    ctx.fillText(label, tx, y + 81);
  }

  function drawEventHud(ctx, arenaEvents, x, y, w) {
    if (!arenaEvents || !arenaEvents.label) return;
    const label = arenaEvents.label();
    if (!label) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 13px monospace';
    const tx = x + w / 2;
    ctx.fillStyle = 'rgba(20,20,20,0.78)';
    ctx.fillRect(tx - 70, y + 100, 140, 20);
    ctx.strokeStyle = 'rgba(255,240,96,0.55)';
    ctx.strokeRect(tx - 70.5, y + 100.5, 139, 19);
    ctx.fillStyle = '#fff060';
    ctx.fillText(label, tx, y + 103);
  }

  function drawSplitScreen(ctx, players, traps, pickups, time, matchTime = 0, arenaEvents = null) {
    const C_ = C;
    const night = nightState(matchTime);
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

    drawViewport(ctx, players[0], players, traps, pickups, 0, 0, vw, vh, time, night);
    drawViewport(ctx, players[1], players, traps, pickups, 0, vh + gap, vw, vh, time, night);

    if (sx || sy) ctx.restore();

    // HUD поверх (без шейка)
    G.hud.drawHUD(ctx, players[0], players, traps, pickups, 0, 0, vw, vh);
    G.hud.drawHUD(ctx, players[1], players, traps, pickups, 0, vh + gap, vw, vh);
    drawNightHud(ctx, night, 0, 0, vw);
    drawNightHud(ctx, night, 0, vh + gap, vw);
    drawEventHud(ctx, arenaEvents, 0, 0, vw);
    drawEventHud(ctx, arenaEvents, 0, vh + gap, vw);
  }

  function drawSingleScreen(ctx, viewer, players, traps, pickups, time, matchTime = 0, arenaEvents = null) {
    const C_ = C;
    const night = nightState(matchTime);
    const [sx, sy] = shakeOffset();
    if (sx || sy) {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    drawViewport(ctx, viewer, players, traps, pickups, 0, 0, C_.CANVAS_W, C_.CANVAS_H, time, night);

    if (sx || sy) ctx.restore();

    // HUD на полную ширину
    G.hud.drawHUD(ctx, viewer, players, traps, pickups, 0, 0, C_.CANVAS_W, C_.CANVAS_H);
    drawNightHud(ctx, night, 0, 0, C_.CANVAS_W);
    drawEventHud(ctx, arenaEvents, 0, 0, C_.CANVAS_W);
  }

  G.render = { init, drawSplitScreen, drawSingleScreen, shake, updateShake };
})();
