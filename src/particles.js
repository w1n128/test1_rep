// Частицы (искры, брызги, пыль, звёзды). Хранятся в мировых координатах,
// рисуются внутри clipped/translated viewport как прочая динамика.
(function () {
  const G = (window.G = window.G || {});
  const list = [];

  function spawn(x, y, opts) {
    list.push({
      x, y,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      ay: opts.ay ?? 0,
      drag: opts.drag ?? 0,
      lifetime: opts.lifetime ?? 0.5,
      t: 0,
      kind: opts.kind ?? 'dot',
      color: opts.color ?? '#fff',
      color2: opts.color2 ?? null,
      size: opts.size ?? 2,
    });
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function burstSparks(x, y) {
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = rand(80, 220);
      spawn(x, y, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        ay: 200,
        drag: 1.5,
        lifetime: rand(0.3, 0.7),
        color: Math.random() < 0.5 ? '#ffee44' : '#ff8822',
        size: rand(1, 3),
      });
    }
  }

  function burstSplash(x, y) {
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI + Math.random() * Math.PI; // вверх
      const sp = rand(40, 110);
      spawn(x, y, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        ay: 280,
        lifetime: rand(0.3, 0.55),
        color: Math.random() < 0.5 ? '#9addff' : '#5aaadd',
        size: rand(1, 2),
      });
    }
  }

  function spawnDust(x, y) {
    spawn(x + rand(-2, 2), y, {
      vx: rand(-10, 10),
      vy: rand(-25, -5),
      ay: 30,
      lifetime: 0.3,
      color: 'rgba(180,180,150,0.8)',
      size: 2,
    });
  }

  function burstStars(x, y) {
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI / 2 + rand(-0.6, 0.6);
      const sp = rand(40, 90);
      spawn(x, y, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        ay: 180,
        lifetime: rand(0.5, 0.8),
        kind: 'star',
        color: '#ffe860',
        color2: '#ff8822',
        size: 4,
      });
    }
  }

  function burstHearts(x, y) {
    for (let i = 0; i < 4; i++) {
      spawn(x + rand(-6, 6), y, {
        vx: rand(-20, 20),
        vy: rand(-60, -30),
        ay: 80,
        lifetime: 0.7,
        kind: 'heart',
        color: '#ee2244',
        size: 4,
      });
    }
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.ay * dt;
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
      }
      p.t += dt;
      if (p.t >= p.lifetime) list.splice(i, 1);
    }
  }

  function clear() { list.length = 0; }

  function draw(ctx, isVisibleAt) {
    for (const p of list) {
      if (isVisibleAt && !isVisibleAt(p.x, p.y)) continue;
      const k = 1 - p.t / p.lifetime;
      const a = Math.max(0, Math.min(1, k));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'star') {
        // Пиксельная звёздочка — крестик
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y, s, 1);
        ctx.fillRect(p.x, p.y - s / 2, 1, s);
        if (p.color2) {
          ctx.fillStyle = p.color2;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
          ctx.fillStyle = p.color;
        }
      } else if (p.kind === 'heart') {
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y - s / 2 + 1, s, s - 1);
        ctx.fillRect(p.x - s / 2 + 1, p.y + s / 2 - 1, s - 2, 1);
        ctx.fillRect(p.x - s / 2 - 1, p.y - s / 2, 2, 2);
        ctx.fillRect(p.x + s / 2 - 1, p.y - s / 2, 2, 2);
      } else {
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function spawnDustCloud(cx, cy) {
    // Большой плоский «взрыв» пыли — много мягких частиц
    const C = window.G && window.G.config;
    const tile = C ? C.TILE : 48;
    const radius = tile * 1.5;
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const sp = rand(20, 70);
      spawn(cx + Math.cos(ang) * r * 0.3, cy + Math.sin(ang) * r * 0.3, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - rand(0, 30),
        ay: 30,
        drag: 1.4,
        lifetime: rand(0.6, 1.2),
        color: Math.random() < 0.5 ? 'rgba(212,200,160,0.85)' : 'rgba(180,168,130,0.75)',
        size: Math.floor(rand(2, 5)),
      });
    }
  }

  G.particles = {
    spawn, update, draw, clear,
    burstSparks, burstSplash, spawnDust, burstStars, burstHearts,
    spawnDustCloud,
  };
})();
