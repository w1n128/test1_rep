// Отрисовка HUD: HP, инвентарь, активная ловушка, мини-карта.
(function () {
  const G = window.G;
  const C = G.config;

  const CHARACTER_NAME = {
    janitor: 'ДВОРНИК',
    raccoon: 'ЕНОТ',
  };

  let minimapCanvas = null;

  function buildMinimap() {
    const W = 96, H = 72;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a6a2a';
    ctx.fillRect(2, 2, W - 4, H - 4);
    const sx = (W - 4) / C.ARENA_W;
    const sy = (H - 4) / C.ARENA_H;
    for (const [tx, ty, kind] of G.arena.obstacles) {
      if (kind === 'fence') ctx.fillStyle = '#888';
      else if (kind === 'bin') ctx.fillStyle = '#222';
      else if (kind === 'crate') ctx.fillStyle = '#8a5a2a';
      else if (kind === 'pallet') ctx.fillStyle = '#caa066';
      else if (kind === 'bush') ctx.fillStyle = '#2e5a1e';
      else continue;
      ctx.fillRect(2 + tx * sx, 2 + ty * sy, Math.max(1, sx), Math.max(1, sy));
    }
    return c;
  }

  function drawMinimap(ctx, vx, vy, vw, vh, viewer, players, traps, pickups) {
    if (!minimapCanvas) minimapCanvas = buildMinimap();
    const W = minimapCanvas.width;
    const H = minimapCanvas.height;
    const x = vx + (vw - W) / 2;
    const y = vy + 4;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
    ctx.drawImage(minimapCanvas, x, y);

    const sx = (W - 4) / C.ARENA_W;
    const sy = (H - 4) / C.ARENA_H;

    // Пикапы — жёлтые точки
    if (pickups) {
      ctx.fillStyle = '#ffe060';
      for (const pk of pickups.list) {
        ctx.fillRect(x + 2 + pk.tileX * sx, y + 2 + pk.tileY * sy, 2, 2);
      }
    }

    // Видимые ловушки
    if (traps) {
      for (const t of traps.list) {
        if (t.destroyed) continue;
        if (t.ownerId === viewer.id) ctx.fillStyle = '#5af0c0';
        else if (t.armed && t.type !== 'trapdoor') ctx.fillStyle = '#ff5050';
        else continue;
        ctx.fillRect(x + 2 + t.tileX * sx, y + 2 + t.tileY * sy, 2, 2);
      }
    }

    // Игроки
    for (const p of players) {
      if (!p.alive) continue;
      const px = x + 2 + p.tileX * sx;
      const py = y + 2 + p.tileY * sy;
      const isSelf = p.id === viewer.id;
      // Скрытность енота — не отображать его на чужой минимапе тоже
      const stealth = (
        p.character === 'raccoon' &&
        viewer.character === 'janitor' &&
        viewer.id !== p.id &&
        p.idleT > C.STEALTH_IDLE_TIME + C.STEALTH_FADE_TIME
      );
      if (stealth) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = isSelf
        ? (p.character === 'janitor' ? '#ffe060' : '#a0e0ff')
        : (p.character === 'janitor' ? '#ee7c2a' : '#888');
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  function drawHUD(ctx, player, players, traps, pickups, viewportX, viewportY, viewportW, viewportH) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // HP сердечки
    const heartsY = viewportY + 6;
    for (let i = 0; i < C.PLAYER_MAX_HP; i++) {
      const sprite = i < player.hp ? G.sprites.heart : G.sprites.heartEmpty;
      ctx.drawImage(sprite, viewportX + 8 + i * 14, heartsY);
    }

    // Инвентарь — 5 слотов справа: иконка + «x3»
    const slotW = 38, slotH = 22;
    const slotGap = 2;
    const iconSize = 18;
    const right = viewportX + viewportW - 8;
    const invY = viewportY + 4;

    const types = C.TRAP_TYPES;
    for (let i = 0; i < types.length; i++) {
      const x = right - (types.length - i) * (slotW + slotGap);
      const isActive = player.selectedTrap === i;
      // Фон слота
      ctx.fillStyle = isActive ? '#ffee88' : 'rgba(20,20,20,0.85)';
      ctx.fillRect(x, invY, slotW, slotH);
      // Контур активного
      if (isActive) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, invY + 0.5, slotW - 1, slotH - 1);
      }
      // Иконка ловушки (32×32 → 18×18)
      const sprite = G.sprites.traps[types[i]];
      if (sprite) {
        const iy = invY + (slotH - iconSize) / 2;
        ctx.drawImage(sprite, x + 2, iy, iconSize, iconSize);
      }
      // Счётчик
      ctx.fillStyle = isActive ? '#222' : '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('x' + player.inventory[types[i]], x + 2 + iconSize + 2, invY + slotH / 2 + 1);
      ctx.textBaseline = 'top';
    }

    // Имя игрока в углу (на русском)
    const name = CHARACTER_NAME[player.character] || player.character.toUpperCase();
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(name, viewportX + 9, viewportY + viewportH - 19);
    ctx.fillStyle = player.id === 1 ? '#ffe060' : '#a0e0ff';
    ctx.fillText(name, viewportX + 8, viewportY + viewportH - 20);

    // Минимапа сверху по центру
    if (players && traps && pickups) {
      drawMinimap(ctx, viewportX, viewportY, viewportW, viewportH, player, players, traps, pickups);
    }
  }

  G.hud = { drawHUD };
})();
