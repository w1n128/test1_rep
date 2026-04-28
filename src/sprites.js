// Процедурно сгенерированные пиксельные спрайты 48×48 в стиле PNG-референса.
// Используются хелперы blank/fillRect/setPx для построения на основе примитивов.
(function () {
  const G = window.G;
  const P = G.PALETTE;

  function makeBitmap(rows, palette) {
    const w = rows[0].length;
    const h = rows.length;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        const idx = (y * w + x) * 4;
        if (ch === '.' || ch === ' ') {
          img.data[idx + 3] = 0;
        } else {
          const hex = palette[ch];
          if (!hex) {
            img.data[idx + 3] = 0;
          } else {
            img.data[idx]     = parseInt(hex.slice(1, 3), 16);
            img.data[idx + 1] = parseInt(hex.slice(3, 5), 16);
            img.data[idx + 2] = parseInt(hex.slice(5, 7), 16);
            img.data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function loadPngSprite(path, fallback) {
    const c = document.createElement('canvas');
    c.width = fallback.width;
    c.height = fallback.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fallback, 0, 0);

    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const nextCtx = c.getContext('2d');
      nextCtx.imageSmoothingEnabled = false;
      nextCtx.clearRect(0, 0, c.width, c.height);
      nextCtx.drawImage(img, 0, 0);
    };
    img.src = path;
    return c;
  }

  function blank(w, h) {
    return Array.from({ length: h }, () => '.'.repeat(w).split(''));
  }
  function setPx(r, x, y, ch) {
    if (r[y] && r[y][x] !== undefined) r[y][x] = ch;
  }
  function fillRect(r, x, y, w, h, ch) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) setPx(r, x + dx, y + dy, ch);
  }
  function fillEllipse(r, cx, cy, rx, ry, ch) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) setPx(r, x, y, ch);
      }
    }
  }
  function strokeRect(r, x, y, w, h, ch) {
    fillRect(r, x, y, w, 1, ch);
    fillRect(r, x, y + h - 1, w, 1, ch);
    fillRect(r, x, y, 1, h, ch);
    fillRect(r, x + w - 1, y, 1, h, ch);
  }
  function rowsToStrs(rows) { return rows.map((r) => r.join('')); }
  function flipH(rows) { return rows.map((r) => r.split('').reverse().join('')); }
  function scaleRowsX(rows, scale, center = 23.5) {
    const source = rows.map((row) => Array.isArray(row) ? row : row.split(''));
    const h = source.length;
    const w = source[0].length;
    const next = blank(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = source[y][x];
        if (ch === '.' || ch === ' ') continue;
        const nx = Math.round(center + (x - center) * scale);
        setPx(next, nx, y, ch);
      }
    }
    return rowsToStrs(next);
  }

  // --- Тайлы 48×48 ---

  function makeFloor() {
    const r = blank(48, 48);
    fillRect(r, 0, 0, 48, 48, 'a');
    // Пятна более тёмной зелени, рассыпью
    const shades = [
      [4, 3], [11, 5], [18, 2], [26, 6], [34, 4], [42, 8],
      [7, 10], [16, 13], [25, 11], [33, 14], [41, 12],
      [3, 19], [12, 17], [22, 21], [30, 19], [38, 22],
      [6, 26], [14, 28], [23, 27], [32, 30], [40, 28],
      [4, 34], [13, 36], [21, 33], [30, 37], [39, 35],
      [8, 42], [17, 44], [26, 41], [35, 44], [43, 43],
    ];
    for (const [x, y] of shades) {
      setPx(r, x, y, 'b');
      setPx(r, x + 1, y, 'b');
      setPx(r, x, y + 1, 'b');
    }
    // Пучки травы (метёлки 3px высотой)
    const tufts = [
      [7, 6], [19, 8], [29, 5], [38, 9], [44, 4],
      [10, 15], [21, 17], [33, 16], [42, 19],
      [5, 23], [15, 24], [27, 22], [37, 26], [44, 23],
      [9, 31], [20, 33], [29, 31], [39, 33],
      [6, 39], [16, 41], [25, 38], [34, 40], [43, 38],
      [12, 11], [28, 12], [16, 31], [33, 22],
    ];
    for (const [x, y] of tufts) {
      setPx(r, x, y, 'c');
      setPx(r, x, y + 1, 'c');
      setPx(r, x - 1, y + 1, 'b');
      setPx(r, x + 1, y + 1, 'b');
      setPx(r, x, y + 2, 'b');
    }
    return rowsToStrs(r);
  }

  function makeBin() {
    const r = blank(48, 48);
    // Ручка крышки (сверху)
    fillRect(r, 20, 1, 8, 2, 'b');
    fillRect(r, 19, 3, 10, 2, 'b');
    fillRect(r, 21, 2, 6, 1, 'd');
    // Крышка (нависает шире тела)
    fillRect(r, 4, 5, 40, 5, 'b');
    fillRect(r, 5, 6, 38, 1, 'c');     // блик сверху
    fillRect(r, 5, 8, 38, 1, 'd');     // тень снизу
    // Тело бака
    fillRect(r, 7, 10, 34, 32, 'c');
    strokeRect(r, 7, 10, 34, 32, 'b');
    // Рёбра жёсткости (вертикальные тёмные полосы)
    for (let x = 11; x < 41; x += 5) {
      fillRect(r, x, 12, 1, 28, 'd');
    }
    // Блик слева
    fillRect(r, 9, 12, 1, 28, 'd');
    fillRect(r, 8, 12, 1, 28, 'b');
    // Дополнительный обод снизу бака (декоративный)
    fillRect(r, 7, 38, 34, 1, 'b');
    // База / тень
    fillRect(r, 9, 42, 30, 2, 'b');
    fillRect(r, 12, 44, 24, 2, 'b');
    fillRect(r, 16, 46, 16, 1, 'b');
    return rowsToStrs(r);
  }

  function makeCrate() {
    const r = blank(48, 48);
    // Внешняя рамка
    fillRect(r, 0, 0, 48, 48, 'e');
    strokeRect(r, 0, 0, 48, 48, 'f');
    strokeRect(r, 1, 1, 46, 46, 'f');
    // Угловые металлические скобы
    fillRect(r, 2, 2, 7, 2, 'f');
    fillRect(r, 2, 2, 2, 7, 'f');
    fillRect(r, 39, 2, 7, 2, 'f');
    fillRect(r, 44, 2, 2, 7, 'f');
    fillRect(r, 2, 44, 7, 2, 'f');
    fillRect(r, 2, 39, 2, 7, 'f');
    fillRect(r, 39, 44, 7, 2, 'f');
    fillRect(r, 44, 39, 2, 7, 'f');
    // Шурупы по углам
    setPx(r, 5, 5, 'g'); setPx(r, 42, 5, 'g');
    setPx(r, 5, 42, 'g'); setPx(r, 42, 42, 'g');
    // Диагональный крест X (две полосы толщиной 3)
    for (let i = 0; i < 44; i++) {
      const x = 2 + i;
      const y1 = 2 + i;
      const y2 = 45 - i;
      setPx(r, x, y1, 'g'); setPx(r, x + 1, y1, 'g'); setPx(r, x + 2, y1, 'g');
      setPx(r, x, y2, 'g'); setPx(r, x + 1, y2, 'g'); setPx(r, x + 2, y2, 'g');
    }
    // Текстура досок (горизонтальные тонкие линии между тёмными)
    for (let y = 8; y < 47; y += 8) {
      for (let x = 4; x < 44; x++) {
        if (r[y][x] === 'e') setPx(r, x, y, 'f');
      }
    }
    return rowsToStrs(r);
  }

  function makePallet() {
    const r = blank(48, 48);
    // 5 горизонтальных досок (высота 8, зазор 2)
    for (let i = 0; i < 5; i++) {
      const y = i * 10;
      // Основа доски
      fillRect(r, 0, y, 48, 8, 'p');
      // Верх и низ доски (тёмные канты)
      fillRect(r, 0, y, 48, 1, 'g');
      fillRect(r, 0, y + 7, 48, 1, 'g');
      // Текстура — вертикальные штрихи
      for (let x = 5; x < 47; x += 6) {
        fillRect(r, x, y + 2, 1, 4, 'g');
      }
      // Гвозди по краям
      setPx(r, 2, y + 3, 'g'); setPx(r, 2, y + 5, 'g');
      setPx(r, 45, y + 3, 'g'); setPx(r, 45, y + 5, 'g');
    }
    // Боковые опоры (вертикальные)
    fillRect(r, 0, 0, 3, 48, 'g');
    fillRect(r, 45, 0, 3, 48, 'g');
    fillRect(r, 22, 0, 4, 48, 'g');
    return rowsToStrs(r);
  }

  function makeFence() {
    const r = blank(48, 48);
    // Рамка-стойки (металлические)
    fillRect(r, 0, 0, 48, 3, 'p');
    fillRect(r, 0, 45, 48, 3, 'p');
    fillRect(r, 0, 0, 3, 48, 'p');
    fillRect(r, 45, 0, 3, 48, 'p');
    // Сетка-ромбы внутри: шаг 6
    for (let y = 3; y < 45; y++) {
      for (let x = 3; x < 45; x++) {
        const dx = x - 3, dy = y - 3;
        const a = (dx + dy) % 6;
        const b = (dx - dy + 60) % 6;
        if (a === 0) setPx(r, x, y, 'i');
        if (b === 0) setPx(r, x, y, 'i');
      }
    }
    // Тени внутри (один шаг тёмного рядом со светлой нитью)
    for (let y = 4; y < 44; y++) {
      for (let x = 4; x < 44; x++) {
        if (r[y][x] === '.') {
          const dx = x - 3, dy = y - 3;
          if ((dx + dy) % 6 === 1 || (dx - dy + 60) % 6 === 1) setPx(r, x, y, 'j');
        }
      }
    }
    // Болты по углам столбов
    setPx(r, 1, 1, 'i'); setPx(r, 46, 1, 'i');
    setPx(r, 1, 46, 'i'); setPx(r, 46, 46, 'i');
    return rowsToStrs(r);
  }

  function makeBush() {
    const r = blank(48, 48);
    const cx = 24, cy = 24;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) + Math.sin((x + y) * 0.5) * 2;
        if (d < 20) setPx(r, x, y, 'k');
        else if (d < 22) setPx(r, x, y, 'j');
      }
    }
    // Светлые блики (листья)
    const leaves = [
      [14, 11], [22, 9], [30, 11], [36, 14],
      [12, 17], [20, 15], [28, 16], [34, 19],
      [11, 24], [18, 22], [26, 23], [33, 24], [38, 25],
      [13, 30], [21, 29], [29, 30], [35, 31],
      [15, 35], [23, 36], [31, 35],
      [19, 41], [27, 40],
    ];
    for (const [x, y] of leaves) {
      setPx(r, x, y, 'k');
      setPx(r, x + 1, y, 'k');
      setPx(r, x, y + 1, 'k');
    }
    // Тёмные пучки веток
    const dark = [[18, 19], [27, 25], [16, 33], [32, 22], [22, 38]];
    for (const [x, y] of dark) setPx(r, x, y, 'j');
    return rowsToStrs(r);
  }

  // Палитры тайлов
  const tilePalette = {
    a: P.bg, b: P.bgDark, c: P.bgTuft,
    e: P.crate, f: P.crateDark, g: P.crateLine,
    j: P.bushDark, k: P.bush,
  };
  const binPalette = {
    b: P.binDark, c: P.bin, d: P.binHi,
  };
  const palletPalette = {
    g: P.palletDark, p: P.pallet,
  };
  const fencePalette = {
    p: P.fencePost, i: P.fence, j: P.fenceDark,
  };

  G.tiles = {
    floor:  makeBitmap(makeFloor(),  tilePalette),
    bin:    makeBitmap(makeBin(),    binPalette),
    crate:  makeBitmap(makeCrate(),  tilePalette),
    pallet: makeBitmap(makePallet(), palletPalette),
    fence:  makeBitmap(makeFence(),  fencePalette),
    bush:   makeBitmap(makeBush(),   tilePalette),
  };

  // --- Дворник 48×48 ---
  // Палитра: E=capDark e=cap s=skin S=skinDark M=eyes/boot
  // J=jacketDark j=jacket v=vest V=vestStripe p=pants P=pantsDark b=boot B=beard

  function makeJanitor(dir, frame, pose = 'normal') {
    const r = blank(48, 48);

    // === Кепка (rows 0-9) ===
    // Тёмный кант сверху
    fillRect(r, 14, 0, 20, 1, 'E');
    fillRect(r, 12, 1, 24, 1, 'E');
    fillRect(r, 11, 2, 26, 1, 'E');
    // Оранжевый купол
    fillRect(r, 12, 2, 24, 5, 'e');
    fillRect(r, 13, 1, 22, 1, 'e');
    fillRect(r, 14, 0, 20, 1, 'e');
    // Боковой кант кепки
    setPx(r, 11, 3, 'E'); setPx(r, 36, 3, 'E');
    setPx(r, 10, 4, 'E'); setPx(r, 37, 4, 'E');
    fillRect(r, 11, 4, 1, 4, 'e');
    fillRect(r, 36, 4, 1, 4, 'e');
    // Тень внутри кепки
    fillRect(r, 13, 5, 22, 1, 'E');
    // Лента кепки (тёмная)
    fillRect(r, 10, 8, 28, 2, 'E');
    // Козырёк
    if (dir === 'down') {
      fillRect(r, 11, 10, 26, 2, 'E');
      fillRect(r, 13, 12, 22, 1, 'E');
    } else if (dir === 'left') {
      fillRect(r, 4, 10, 22, 2, 'E');
      fillRect(r, 5, 12, 20, 1, 'E');
    }
    // (для 'right' козырёк появляется через flipH)

    // === Лицо (rows 10-22) ===
    if (dir === 'up') {
      // Сзади только затылок (skin) под лентой
      fillRect(r, 12, 10, 24, 11, 's');
      fillRect(r, 12, 10, 24, 1, 'S');
      // Уши сбоку
      fillRect(r, 10, 14, 2, 4, 's');
      fillRect(r, 36, 14, 2, 4, 's');
      setPx(r, 10, 17, 'S'); setPx(r, 37, 17, 'S');
    } else {
      // Анфас/профиль
      fillRect(r, 13, 13, 22, 9, 's');
      fillRect(r, 14, 12, 20, 1, 's');
      fillRect(r, 14, 22, 20, 1, 's');
      // Тень снизу подбородка
      fillRect(r, 15, 22, 18, 1, 'S');
      // Уши
      fillRect(r, 11, 15, 2, 4, 's');
      fillRect(r, 35, 15, 2, 4, 's');
      setPx(r, 11, 18, 'S');
      setPx(r, 36, 18, 'S');
    }

    // Глаза + борода
    if (dir === 'down') {
      // Брови
      fillRect(r, 16, 14, 4, 1, 'B');
      fillRect(r, 28, 14, 4, 1, 'B');
      // Глаза 3×2
      fillRect(r, 16, 15, 3, 2, 'M');
      fillRect(r, 29, 15, 3, 2, 'M');
      // Блик в глазах
      setPx(r, 17, 15, 's');
      setPx(r, 30, 15, 's');
      // Нос
      fillRect(r, 23, 16, 2, 3, 'S');
      // Борода: усы под носом + густая щетина по подбородку
      fillRect(r, 18, 19, 12, 1, 'B');
      fillRect(r, 16, 20, 16, 2, 'B');
      fillRect(r, 17, 22, 14, 1, 'B');
      // Рот — узкая щель в бороде
      fillRect(r, 21, 20, 6, 1, 'S');
    } else if (dir === 'left') {
      // Профиль слева — оба глаза смещены влево
      fillRect(r, 14, 14, 4, 1, 'B');
      fillRect(r, 24, 14, 4, 1, 'B');
      fillRect(r, 14, 15, 3, 2, 'M');
      fillRect(r, 25, 15, 3, 2, 'M');
      setPx(r, 15, 15, 's');
      setPx(r, 26, 15, 's');
      // Нос торчит влево
      fillRect(r, 11, 17, 3, 2, 'S');
      setPx(r, 11, 17, 's');
      // Борода (в профиль чуть длиннее снизу)
      fillRect(r, 14, 19, 14, 1, 'B');
      fillRect(r, 13, 20, 16, 2, 'B');
      fillRect(r, 14, 22, 14, 1, 'B');
      fillRect(r, 17, 20, 7, 1, 'S');
    }

    // === Воротник + торс (rows 22-35) ===
    // Шея/воротник
    fillRect(r, 17, 22, 14, 2, 'J');
    fillRect(r, 18, 24, 12, 1, 'J');
    // Плечи
    fillRect(r, 9, 24, 30, 2, 'J');
    fillRect(r, 8, 25, 32, 2, 'J');
    // Корпус (куртка под жилетом)
    fillRect(r, 10, 26, 28, 9, 'j');
    // Швы куртки
    fillRect(r, 23, 26, 2, 9, 'J');
    // === Жилет (поверх куртки) ===
    if (dir === 'up') {
      // Сзади жилет почти весь виден
      fillRect(r, 11, 26, 26, 9, 'v');
      fillRect(r, 11, 28, 26, 1, 'V');
      fillRect(r, 11, 32, 26, 1, 'V');
      // Воротник жилета
      fillRect(r, 13, 26, 22, 1, 'V');
    } else {
      // Спереди — жилет распахнут, видна куртка по центру
      fillRect(r, 9, 26, 8, 9, 'v');
      fillRect(r, 31, 26, 8, 9, 'v');
      // Светоотражающие полосы (горизонтальные)
      fillRect(r, 9, 28, 8, 1, 'V');
      fillRect(r, 31, 28, 8, 1, 'V');
      fillRect(r, 9, 32, 8, 1, 'V');
      fillRect(r, 31, 32, 8, 1, 'V');
      // Тёмная окантовка жилета вдоль распашонки
      setPx(r, 17, 26, 'E'); setPx(r, 17, 27, 'E'); setPx(r, 17, 28, 'E');
      setPx(r, 17, 29, 'E'); setPx(r, 17, 30, 'E'); setPx(r, 17, 31, 'E');
      setPx(r, 17, 32, 'E'); setPx(r, 17, 33, 'E'); setPx(r, 17, 34, 'E');
      setPx(r, 30, 26, 'E'); setPx(r, 30, 27, 'E'); setPx(r, 30, 28, 'E');
      setPx(r, 30, 29, 'E'); setPx(r, 30, 30, 'E'); setPx(r, 30, 31, 'E');
      setPx(r, 30, 32, 'E'); setPx(r, 30, 33, 'E'); setPx(r, 30, 34, 'E');
    }

    // === Руки ===
    if (pose === 'dance_left' || pose === 'dance_right') {
      const leftUp = pose === 'dance_left';
      if (leftUp) {
        fillRect(r, 5, 14, 4, 16, 'j');
        fillRect(r, 4, 12, 5, 4, 's');
        fillRect(r, 38, 27, 3, 8, 'j');
        fillRect(r, 38, 34, 3, 2, 's');
      } else {
        fillRect(r, 39, 14, 4, 16, 'j');
        fillRect(r, 39, 12, 5, 4, 's');
        fillRect(r, 7, 27, 3, 8, 'j');
        fillRect(r, 7, 34, 3, 2, 's');
      }
      // Весёлый открытый рот во время танца.
      fillRect(r, 22, 20, 4, 2, 'S');
      fillRect(r, 23, 21, 2, 1, 'M');
    } else if (pose === 'throw') {
      // Нерабочая рука прижата
      fillRect(r, 7, 27, 3, 7, 'j');
      if (dir === 'left') {
        fillRect(r, 0, 24, 10, 3, 'j');
        fillRect(r, 0, 25, 3, 2, 's');   // кисть
      } else if (dir === 'up') {
        fillRect(r, 35, 12, 4, 14, 'j');
        fillRect(r, 35, 10, 4, 2, 's');
      } else if (dir === 'down') {
        fillRect(r, 36, 24, 4, 14, 'j');
        fillRect(r, 36, 38, 4, 2, 's');
      } else {
        // 'right'
        fillRect(r, 38, 24, 10, 3, 'j');
        fillRect(r, 45, 25, 3, 2, 's');
      }
    } else if (pose === 'slide') {
      // Обе руки разведены в стороны
      fillRect(r, 0, 26, 10, 3, 'j');
      fillRect(r, 38, 26, 10, 3, 'j');
      fillRect(r, 0, 27, 3, 2, 's');
      fillRect(r, 45, 27, 3, 2, 's');
    } else if (dir === 'left') {
      // Левая рука вынесена вперёд
      fillRect(r, 7, 27, 3, 7, 'j');
      fillRect(r, 5, 30, 4, 3, 's');
    } else if (dir !== 'up') {
      fillRect(r, 7, 27, 3, 7, 'j');
      fillRect(r, 38, 27, 3, 7, 'j');
      fillRect(r, 7, 32, 3, 2, 's');
      fillRect(r, 38, 32, 3, 2, 's');
    } else {
      fillRect(r, 7, 27, 3, 7, 'j');
      fillRect(r, 38, 27, 3, 7, 'j');
    }

    // === Пояс штанов (rows 34-36) ===
    fillRect(r, 13, 34, 22, 2, 'P');
    // Пряжка
    fillRect(r, 22, 34, 4, 2, 'V');
    setPx(r, 23, 34, 'P');
    setPx(r, 24, 34, 'P');

    // === Штаны (rows 36-43) ===
    fillRect(r, 13, 36, 22, 8, 'p');
    // Шов посередине
    for (let y = 36; y < 44; y++) {
      setPx(r, 23, y, 'P');
      setPx(r, 24, y, 'P');
    }
    // Боковые тени штанов
    fillRect(r, 13, 36, 1, 8, 'P');
    fillRect(r, 34, 36, 1, 8, 'P');

    // === Ноги + ботинки (rows 43-47) ===
    if (frame === 0) {
      // Стойка
      fillRect(r, 13, 43, 9, 1, 'p');
      fillRect(r, 26, 43, 9, 1, 'p');
      fillRect(r, 13, 44, 9, 4, 'b');
      fillRect(r, 26, 44, 9, 4, 'b');
      // Подошва (светлая полоска)
      fillRect(r, 13, 47, 9, 1, 'P');
      fillRect(r, 26, 47, 9, 1, 'P');
    } else {
      // Шаг — одна нога чуть сзади
      fillRect(r, 13, 43, 9, 2, 'p');
      fillRect(r, 26, 43, 9, 1, 'p');
      fillRect(r, 13, 45, 9, 3, 'b');
      fillRect(r, 26, 44, 9, 4, 'b');
    }

    return rowsToStrs(r);
  }

  const janitorPalette = {
    E: P.capDark, e: P.cap,
    s: P.skin, S: P.skinDark, M: P.boot,
    B: P.beard,
    J: P.jacketDark, j: P.jacket,
    v: P.vest, V: P.vestStripe,
    p: P.pants, P: P.pantsDark,
    b: P.boot,
  };

  G.sprites = G.sprites || {};
  function jb(rows) { return makeBitmap(rows, janitorPalette); }
  G.sprites.janitor = {
    down:  [jb(makeJanitor('down', 0)), jb(makeJanitor('down', 1))],
    up:    [jb(makeJanitor('up',   0)), jb(makeJanitor('up',   1))],
    left:  [jb(makeJanitor('left', 0)), jb(makeJanitor('left', 1))],
    right: [jb(flipH(makeJanitor('left', 0))), jb(flipH(makeJanitor('left', 1)))],
    throw_down:  jb(makeJanitor('down',  0, 'throw')),
    throw_up:    jb(makeJanitor('up',    0, 'throw')),
    throw_left:  jb(makeJanitor('left',  0, 'throw')),
    throw_right: jb(flipH(makeJanitor('left', 0, 'throw'))),
    slide_down:  jb(makeJanitor('down',  0, 'slide')),
    slide_up:    jb(makeJanitor('up',    0, 'slide')),
    slide_left:  jb(makeJanitor('left',  0, 'slide')),
    slide_right: jb(flipH(makeJanitor('left', 0, 'slide'))),
    dance: [jb(makeJanitor('down', 0, 'dance_left')), jb(makeJanitor('down', 1, 'dance_right'))],
  };

  // --- Енот 48×48 ---
  // r=raccoon1 (светлый мех), R=raccoon2 (тёмный мех/контур),
  // w=raccoonE (морда/глаза), m=raccoonM (маска/нос/чёрный)

  function makeRaccoon(dir, frame, pose = 'normal') {
    const r = blank(48, 48);

    // === Уши (большие округлые, rows 0-7) ===
    // Левое ухо
    fillRect(r, 6, 2, 8, 5, 'r');
    fillRect(r, 7, 1, 6, 1, 'r');
    fillRect(r, 8, 0, 4, 1, 'R');
    fillRect(r, 7, 1, 1, 1, 'R');
    fillRect(r, 12, 1, 1, 1, 'R');
    fillRect(r, 6, 2, 1, 5, 'R');
    fillRect(r, 13, 2, 1, 5, 'R');
    fillRect(r, 6, 6, 8, 1, 'R');
    // Внутренняя часть уха (тёмная сердцевина)
    fillRect(r, 9, 3, 3, 3, 'm');
    setPx(r, 10, 4, 'R');
    // Правое ухо
    fillRect(r, 34, 2, 8, 5, 'r');
    fillRect(r, 35, 1, 6, 1, 'r');
    fillRect(r, 36, 0, 4, 1, 'R');
    fillRect(r, 35, 1, 1, 1, 'R');
    fillRect(r, 40, 1, 1, 1, 'R');
    fillRect(r, 34, 2, 1, 5, 'R');
    fillRect(r, 41, 2, 1, 5, 'R');
    fillRect(r, 34, 6, 8, 1, 'R');
    fillRect(r, 36, 3, 3, 3, 'm');
    setPx(r, 37, 4, 'R');

    // === Голова (rows 5-22) — круглая с пушистым контуром ===
    // Светло-серая заливка головы
    fillRect(r, 9, 5, 30, 16, 'r');
    fillRect(r, 8, 7, 1, 11, 'r');
    fillRect(r, 39, 7, 1, 11, 'r');
    fillRect(r, 7, 9, 1, 7, 'r');
    fillRect(r, 40, 9, 1, 7, 'r');
    // Контур головы
    fillRect(r, 10, 5, 28, 1, 'R');
    setPx(r, 9, 6, 'R'); setPx(r, 38, 6, 'R');
    setPx(r, 8, 7, 'R'); setPx(r, 39, 7, 'R');
    setPx(r, 8, 8, 'R'); setPx(r, 39, 8, 'R');
    setPx(r, 7, 9, 'R'); setPx(r, 40, 9, 'R');
    setPx(r, 7, 15, 'R'); setPx(r, 40, 15, 'R');
    setPx(r, 8, 16, 'R'); setPx(r, 39, 16, 'R');
    setPx(r, 8, 17, 'R'); setPx(r, 39, 17, 'R');
    fillRect(r, 9, 18, 30, 1, 'R');

    if (dir !== 'up') {
      // === Маска: широкая чёрная полоса вокруг глаз ===
      fillRect(r, 9, 9, 12, 5, 'm');
      fillRect(r, 27, 9, 12, 5, 'm');
      // Перемычка маски через переносицу
      fillRect(r, 21, 11, 6, 3, 'm');
      // Светло-серое пятно между глазами на лбу (чтобы маска не была монолитной)
      fillRect(r, 22, 9, 4, 2, 'r');
      // Узкие "усики" маски, спускающиеся к носу
      fillRect(r, 20, 14, 2, 2, 'm');
      fillRect(r, 26, 14, 2, 2, 'm');

      // === Глаза (большие круглые внутри маски) ===
      fillRect(r, 12, 10, 6, 4, 'w');
      fillRect(r, 30, 10, 6, 4, 'w');
      // Внутренняя обводка глаз (мягко-серая)
      fillRect(r, 12, 10, 6, 1, 'R');
      fillRect(r, 30, 10, 6, 1, 'R');
      // Зрачки
      fillRect(r, 14, 11, 2, 2, 'm');
      fillRect(r, 32, 11, 2, 2, 'm');
      // Блик в глазах
      setPx(r, 13, 11, 'w');
      setPx(r, 31, 11, 'w');

      // === Морда (белая часть от носа к подбородку) ===
      fillRect(r, 18, 14, 12, 7, 'w');
      fillRect(r, 19, 21, 10, 1, 'w');
      // Контур морды
      fillRect(r, 18, 14, 1, 7, 'R');
      fillRect(r, 29, 14, 1, 7, 'R');
      fillRect(r, 19, 21, 10, 1, 'R');

      // === Нос (большой тёмный треугольник) ===
      fillRect(r, 22, 14, 4, 2, 'm');
      fillRect(r, 22, 16, 4, 1, 'm');
      fillRect(r, 23, 17, 2, 1, 'm');

      // === Рот: асимметричная ухмылка ===
      setPx(r, 21, 19, 'm');
      setPx(r, 22, 19, 'm');
      setPx(r, 23, 20, 'm');
      setPx(r, 24, 20, 'm');
      setPx(r, 25, 19, 'm');
      setPx(r, 26, 18, 'm');
      setPx(r, 27, 18, 'm');

      // === Усики ===
      setPx(r, 16, 17, 'R');
      setPx(r, 17, 18, 'R');
      setPx(r, 30, 17, 'R');
      setPx(r, 31, 18, 'R');
    } else {
      // Сзади (затылок) — серый с тёмными полосами
      fillRect(r, 9, 8, 30, 13, 'r');
      fillRect(r, 11, 10, 26, 1, 'm');
      fillRect(r, 11, 14, 26, 1, 'm');
      fillRect(r, 11, 18, 26, 1, 'm');
    }

    // === Тело (rows 21-38) — короткое, компактное ===
    fillRect(r, 11, 21, 26, 17, 'r');
    fillRect(r, 10, 23, 1, 12, 'r');
    fillRect(r, 37, 23, 1, 12, 'r');
    // Контур тела
    fillRect(r, 11, 21, 26, 1, 'R');
    fillRect(r, 11, 37, 26, 1, 'R');
    fillRect(r, 10, 23, 1, 12, 'R');
    fillRect(r, 37, 23, 1, 12, 'R');

    if (dir !== 'up') {
      // Светлый живот
      fillRect(r, 17, 23, 14, 13, 'w');
      // Боковые тени живота
      fillRect(r, 16, 23, 1, 13, 'R');
      fillRect(r, 31, 23, 1, 13, 'R');
      // Лёгкие штрихи на серых боках
      fillRect(r, 13, 25, 3, 1, 'R');
      fillRect(r, 32, 25, 3, 1, 'R');
      fillRect(r, 13, 30, 3, 1, 'R');
      fillRect(r, 32, 30, 3, 1, 'R');
    } else {
      // Тёмные полосы через всю спину
      fillRect(r, 12, 24, 24, 1, 'm');
      fillRect(r, 12, 28, 24, 1, 'm');
      fillRect(r, 12, 32, 24, 1, 'm');
      fillRect(r, 12, 36, 24, 1, 'm');
    }

    // === Хвост — большой полосатый, выходит сбоку ===
    if (dir === 'left') {
      // Хвост слева
      fillRect(r, 1, 23, 9, 16, 'r');
      fillRect(r, 2, 21, 7, 2, 'r');
      // Контур
      fillRect(r, 1, 23, 1, 16, 'R');
      fillRect(r, 9, 23, 1, 16, 'R');
      fillRect(r, 1, 38, 9, 1, 'R');
      fillRect(r, 2, 21, 1, 2, 'R');
      fillRect(r, 8, 21, 1, 2, 'R');
      fillRect(r, 2, 20, 7, 1, 'R');
      // Тёмные кольца (3 широких чёрно-серых полосы)
      fillRect(r, 2, 25, 7, 2, 'R');
      fillRect(r, 3, 25, 5, 2, 'm');
      fillRect(r, 2, 30, 7, 2, 'R');
      fillRect(r, 3, 30, 5, 2, 'm');
      fillRect(r, 2, 35, 7, 2, 'R');
      fillRect(r, 3, 35, 5, 2, 'm');
      // Чёрный кончик
      fillRect(r, 1, 19, 6, 2, 'm');
      setPx(r, 0, 20, 'm');
    } else {
      // Хвост справа (для down/up/right)
      fillRect(r, 38, 23, 9, 16, 'r');
      fillRect(r, 39, 21, 7, 2, 'r');
      fillRect(r, 38, 23, 1, 16, 'R');
      fillRect(r, 46, 23, 1, 16, 'R');
      fillRect(r, 38, 38, 9, 1, 'R');
      fillRect(r, 39, 21, 1, 2, 'R');
      fillRect(r, 45, 21, 1, 2, 'R');
      fillRect(r, 39, 20, 7, 1, 'R');
      fillRect(r, 39, 25, 7, 2, 'R');
      fillRect(r, 40, 25, 5, 2, 'm');
      fillRect(r, 39, 30, 7, 2, 'R');
      fillRect(r, 40, 30, 5, 2, 'm');
      fillRect(r, 39, 35, 7, 2, 'R');
      fillRect(r, 40, 35, 5, 2, 'm');
      fillRect(r, 41, 19, 6, 2, 'm');
      setPx(r, 47, 20, 'm');
    }

    // === Лапы (rows 38-46) ===
    if (pose === 'dance_left' || pose === 'dance_right') {
      const leftUp = pose === 'dance_left';
      if (leftUp) {
        fillRect(r, 5, 12, 5, 17, 'R');
        fillRect(r, 4, 10, 6, 3, 'w');
        fillRect(r, 37, 25, 5, 12, 'R');
        fillRect(r, 37, 35, 5, 2, 'm');
      } else {
        fillRect(r, 38, 12, 5, 17, 'R');
        fillRect(r, 38, 10, 6, 3, 'w');
        fillRect(r, 6, 25, 5, 12, 'R');
        fillRect(r, 6, 35, 5, 2, 'm');
      }
      // Улыбка и чуть подпрыгнувшие ступни.
      fillRect(r, 21, 19, 6, 1, 'm');
      setPx(r, 20, 18, 'm');
      setPx(r, 27, 18, 'm');
      fillRect(r, 13, 39, 6, 5, 'R');
      fillRect(r, 29, 39, 6, 5, 'R');
      fillRect(r, 13, 43, 6, 2, 'm');
      fillRect(r, 29, 43, 6, 2, 'm');
    } else if (pose === 'throw') {
      // Задние лапы стоят
      fillRect(r, 13, 38, 6, 7, 'R');
      fillRect(r, 13, 44, 6, 2, 'm');
      fillRect(r, 29, 38, 6, 7, 'R');
      fillRect(r, 29, 44, 6, 2, 'm');
      // Передняя лапа вытянута в сторону действия
      if (dir === 'left') {
        fillRect(r, 0, 28, 9, 3, 'R');
        fillRect(r, 0, 29, 3, 2, 'w');
      } else if (dir === 'up') {
        fillRect(r, 36, 8, 4, 14, 'R');
        fillRect(r, 36, 6, 4, 2, 'm');
      } else if (dir === 'down') {
        fillRect(r, 36, 26, 4, 14, 'R');
        fillRect(r, 36, 38, 4, 2, 'w');
      } else {
        fillRect(r, 39, 28, 9, 3, 'R');
        fillRect(r, 45, 29, 3, 2, 'w');
      }
    } else if (pose === 'slide') {
      // Все лапы веером
      fillRect(r, 0, 32, 12, 3, 'R');
      fillRect(r, 36, 32, 12, 3, 'R');
      fillRect(r, 0, 33, 3, 2, 'm');
      fillRect(r, 45, 33, 3, 2, 'm');
      fillRect(r, 13, 38, 6, 6, 'R');
      fillRect(r, 29, 38, 6, 6, 'R');
      fillRect(r, 13, 42, 6, 2, 'm');
      fillRect(r, 29, 42, 6, 2, 'm');
    } else {
      // Обычные лапы со step-анимацией
      const fOff = frame === 0 ? 0 : 1;
      if (dir === 'left' || dir === 'right') {
        fillRect(r, 13, 38, 6, 7 + fOff, 'R');
        fillRect(r, 29, 38, 6, 7 - fOff, 'R');
        fillRect(r, 13, 44 + fOff, 6, 2, 'm');
        fillRect(r, 29, 44 - fOff, 6, 2, 'm');
      } else {
        fillRect(r, 13, 38, 6, 7 + (frame ? 1 : 0), 'R');
        fillRect(r, 29, 38, 6, 7 - (frame ? 1 : 0), 'R');
        fillRect(r, 13, 44 + (frame ? 1 : 0), 6, 2, 'm');
        fillRect(r, 29, 44 - (frame ? 1 : 0), 6, 2, 'm');
      }
    }

    return scaleRowsX(r, 0.86);
  }

  const raccoonPalette = {
    r: P.raccoon1,
    R: P.raccoon2,
    w: P.raccoonE,
    m: P.raccoonM,
  };

  function rb(rows) { return makeBitmap(rows, raccoonPalette); }
  G.sprites.raccoon = {
    down:  [rb(makeRaccoon('down', 0)), rb(makeRaccoon('down', 1))],
    up:    [rb(makeRaccoon('up',   0)), rb(makeRaccoon('up',   1))],
    left:  [rb(makeRaccoon('left', 0)), rb(makeRaccoon('left', 1))],
    right: [rb(flipH(makeRaccoon('left', 0))), rb(flipH(makeRaccoon('left', 1)))],
    throw_down:  rb(makeRaccoon('down',  0, 'throw')),
    throw_up:    rb(makeRaccoon('up',    0, 'throw')),
    throw_left:  rb(makeRaccoon('left',  0, 'throw')),
    throw_right: rb(flipH(makeRaccoon('left', 0, 'throw'))),
    slide_down:  rb(makeRaccoon('down',  0, 'slide')),
    slide_up:    rb(makeRaccoon('up',    0, 'slide')),
    slide_left:  rb(makeRaccoon('left',  0, 'slide')),
    slide_right: rb(flipH(makeRaccoon('left', 0, 'slide'))),
    dance: [rb(makeRaccoon('down', 0, 'dance_left')), rb(makeRaccoon('down', 1, 'dance_right'))],
  };

  // --- Ловушки 48×48 ---

  function makeMousetrap() {
    const r = blank(48, 48);
    fillRect(r, 9, 43, 30, 3, 'h');
    fillRect(r, 8, 5, 32, 39, 'm');
    strokeRect(r, 8, 5, 32, 39, 's');
    fillRect(r, 10, 7, 28, 3, 'M');
    fillRect(r, 10, 40, 28, 2, 's');
    for (let x = 14; x <= 34; x += 7) fillRect(r, x, 8, 2, 33, 's');
    fillRect(r, 12, 9, 1, 31, 'M');
    fillRect(r, 36, 9, 1, 31, 'M');

    // Spring-loaded metal frame from the reference.
    strokeRect(r, 14, 12, 20, 18, 'M');
    strokeRect(r, 13, 11, 22, 20, 's');
    fillRect(r, 14, 27, 20, 3, 's');
    for (let x = 15; x < 34; x += 3) fillRect(r, x, 27, 2, 7, 'M');
    fillRect(r, 23, 1, 4, 32, 'M');
    fillRect(r, 22, 2, 1, 31, 's');
    fillRect(r, 27, 2, 1, 31, 's');
    fillRect(r, 24, 6, 2, 22, 's');

    fillRect(r, 19, 33, 10, 8, 'y');
    strokeRect(r, 18, 32, 12, 10, 's');
    setPx(r, 21, 35, 'h'); setPx(r, 26, 35, 'h');
    setPx(r, 22, 38, 'h'); setPx(r, 27, 39, 'h');
    return rowsToStrs(r);
  }

  function makePuddle() {
    const r = blank(48, 48);
    fillEllipse(r, 24, 25, 17, 13, 'd');
    fillEllipse(r, 14, 27, 10, 8, 'd');
    fillEllipse(r, 34, 28, 10, 8, 'd');
    fillEllipse(r, 24, 24, 16, 12, 'u');
    fillEllipse(r, 14, 26, 9, 7, 'u');
    fillEllipse(r, 34, 27, 9, 7, 'u');
    fillEllipse(r, 12, 14, 4, 5, 'd');
    fillEllipse(r, 12, 14, 3, 4, 'u');
    fillEllipse(r, 39, 15, 4, 4, 'd');
    fillEllipse(r, 39, 15, 3, 3, 'u');
    fillEllipse(r, 14, 39, 4, 4, 'd');
    fillEllipse(r, 14, 39, 3, 3, 'u');
    fillEllipse(r, 37, 39, 3, 3, 'd');
    fillEllipse(r, 37, 39, 2, 2, 'u');
    fillRect(r, 14, 17, 10, 2, 'v');
    fillRect(r, 18, 15, 6, 2, 'v');
    fillRect(r, 27, 18, 9, 2, 'v');
    fillRect(r, 11, 25, 7, 2, 'v');
    fillRect(r, 24, 32, 9, 2, 'v');
    return rowsToStrs(r);
  }

  function makeFirecracker() {
    const r = blank(48, 48);
    fillRect(r, 14, 39, 24, 3, 'f');
    for (let i = 0; i < 26; i++) {
      const x = 14 + Math.floor(i * 0.48);
      const y = 37 - i;
      fillRect(r, x, y, 14, 1, 'r');
      setPx(r, x - 1, y, 'f');
      setPx(r, x + 14, y, 'f');
      if (i % 9 < 3) {
        setPx(r, x, y, 'y');
        setPx(r, x + 13, y, 'y');
      }
      if (i > 5 && i < 22) fillRect(r, x + 3, y, 2, 1, 'y');
    }
    fillRect(r, 12, 36, 14, 5, 'f');
    fillRect(r, 13, 34, 13, 3, 'r');
    fillRect(r, 25, 10, 15, 5, 'f');
    fillRect(r, 24, 14, 14, 3, 'y');
    fillRect(r, 33, 7, 3, 5, 'b');
    fillRect(r, 36, 6, 7, 2, 'b');
    fillRect(r, 42, 4, 2, 2, 'b');
    fillRect(r, 43, 2, 3, 3, 'Y');
    setPx(r, 46, 1, 'S'); setPx(r, 47, 3, 'S');
    setPx(r, 45, 6, 'S'); setPx(r, 41, 1, 'Y');
    setPx(r, 47, 0, 'Y'); setPx(r, 44, 7, 'Y');

    return rowsToStrs(r);
  }

  function makeBanana() {
    const r = blank(48, 48);
    fillRect(r, 22, 7, 5, 7, 'd');
    fillRect(r, 23, 5, 3, 3, 'd');
    fillEllipse(r, 24, 21, 9, 11, 'y');
    fillRect(r, 20, 13, 9, 20, 'y');
    fillRect(r, 22, 14, 4, 20, 'h');
    fillRect(r, 28, 16, 2, 15, 'd');

    for (let i = 0; i < 24; i++) {
      const x = 23 - Math.floor(i * 0.72);
      const y = 22 + Math.floor(i * 0.55);
      fillRect(r, x, y, 8, 2, 'y');
      setPx(r, x, y + 2, 'd');
      setPx(r, x + 7, y + 2, 'd');
      if (i % 5 === 0) setPx(r, x + 3, y, 'h');
    }
    for (let i = 0; i < 24; i++) {
      const x = 18 + Math.floor(i * 0.72);
      const y = 22 + Math.floor(i * 0.55);
      fillRect(r, x, y, 8, 2, 'y');
      setPx(r, x, y + 2, 'd');
      setPx(r, x + 7, y + 2, 'd');
      if (i % 5 === 0) setPx(r, x + 3, y, 'h');
    }
    for (let i = 0; i < 20; i++) {
      const x = 20 + Math.floor(i * 0.12);
      const y = 24 + i;
      fillRect(r, x, y, 8, 2, 'y');
      setPx(r, x, y + 2, 'd');
      setPx(r, x + 7, y + 2, 'd');
    }
    fillRect(r, 11, 35, 10, 3, 'd');
    fillRect(r, 29, 35, 10, 3, 'd');
    fillRect(r, 20, 43, 9, 2, 'd');
    return rowsToStrs(r);
  }

  function makeTrapdoor() {
    const r = blank(48, 48);
    const cx = 24, cy = 24;
    const R = 22;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) setPx(r, x, y, 't');
      }
    }
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R - 2) setPx(r, x, y, 'h');
      }
    }
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R - 4 && dx + dy < -4) setPx(r, x, y, 'n');
      }
    }
    for (let y = 12; y <= 36; y += 5) {
      for (let x = 10; x <= 38; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < (R - 4) * (R - 4)) setPx(r, x, y, 't');
      }
    }
    for (let x = 12; x <= 36; x += 5) {
      for (let y = 10; y <= 38; y++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < (R - 4) * (R - 4)) setPx(r, x, y, 't');
      }
    }
    fillEllipse(r, 14, 29, 3, 4, 't');
    fillEllipse(r, 34, 29, 3, 4, 't');
    const rivetR = R - 5;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rx = Math.round(cx + Math.cos(ang) * rivetR);
      const ry = Math.round(cy + Math.sin(ang) * rivetR);
      setPx(r, rx, ry, 't');
    }

    return rowsToStrs(r);
  }

  const mousetrapPalette = {
    m: P.mousetrap, s: P.mtDark, c: P.mtDark,
    y: P.cheese, h: P.crateLine, M: P.mtSpring,
  };
  const puddlePalette = {
    u: P.puddle, v: P.puddleHi, d: P.puddleDark,
  };
  const firecrackerPalette = {
    f: P.fireworkD, r: P.firework, y: P.fireworkY,
    Y: P.sparkY, S: P.sparkO, b: P.fuseBrown,
  };
  const trapdoorPalette = {
    t: P.trapdoorH, h: P.trapdoor, n: P.trapdoorR,
  };
  const bananaPalette = {
    y: P.banana, d: P.bananaD, h: P.bananaH,
  };

  const fallbackTrapSprites = {
    mousetrap:   makeBitmap(makeMousetrap(),   mousetrapPalette),
    puddle:      makeBitmap(makePuddle(),      puddlePalette),
    firecracker: makeBitmap(makeFirecracker(), firecrackerPalette),
    trapdoor:    makeBitmap(makeTrapdoor(),    trapdoorPalette),
    banana:      makeBitmap(makeBanana(),      bananaPalette),
  };

  G.sprites.traps = {
    mousetrap:   loadPngSprite('./assets/traps/mousetrap.png',   fallbackTrapSprites.mousetrap),
    puddle:      loadPngSprite('./assets/traps/puddle.png',      fallbackTrapSprites.puddle),
    firecracker: loadPngSprite('./assets/traps/firecracker.png', fallbackTrapSprites.firecracker),
    trapdoor:    loadPngSprite('./assets/traps/trapdoor.png',    fallbackTrapSprites.trapdoor),
    banana:      loadPngSprite('./assets/traps/banana.png',      fallbackTrapSprites.banana),
  };

  // --- Power-ups 48×48 ---

  function makeStar() {
    const r = blank(48, 48);
    // 5-конечная звезда
    const cx = 24, cy = 25;
    // Точки звезды (приблизительно): верх, верхправ, низправ, низлев, верхлев
    // Заливка через простой алгоритм: выпуклая фигура из треугольников
    // Делаем поэтапно через fillRect
    // Верхний луч (стрелка вверх)
    fillRect(r, 22, 4, 4, 14, 'y');
    fillRect(r, 21, 8, 6, 10, 'y');
    fillRect(r, 20, 12, 8, 6, 'y');
    fillRect(r, 18, 14, 12, 4, 'y');
    fillRect(r, 16, 16, 16, 4, 'y');
    // Боковые лучи
    fillRect(r, 4, 17, 40, 5, 'y');
    fillRect(r, 6, 16, 36, 1, 'y');
    fillRect(r, 6, 22, 36, 1, 'y');
    // Верхний пик ярче
    fillRect(r, 23, 4, 2, 1, 'h');
    // Тело + центр
    fillRect(r, 14, 19, 20, 8, 'y');
    fillRect(r, 12, 21, 24, 4, 'y');
    // Нижние правые/левые лучи
    for (let i = 0; i < 12; i++) {
      const x1 = 20 - i;
      const x2 = 28 + i;
      const y = 22 + i;
      if (i < 10) {
        fillRect(r, x1, y, 4 + Math.max(0, 6 - i), 1, 'y');
        fillRect(r, x2 - Math.max(0, 6 - i), y, 4 + Math.max(0, 6 - i), 1, 'y');
      }
    }
    // Нижние «ноги»
    fillRect(r, 8, 26, 8, 6, 'y');
    fillRect(r, 32, 26, 8, 6, 'y');
    fillRect(r, 10, 32, 6, 4, 'y');
    fillRect(r, 32, 32, 6, 4, 'y');
    fillRect(r, 12, 36, 4, 4, 'y');
    fillRect(r, 32, 36, 4, 4, 'y');
    // Чуть тоньше к концам
    fillRect(r, 13, 39, 2, 2, 'y');
    fillRect(r, 33, 39, 2, 2, 'y');
    // Нижний центр-впадина
    fillRect(r, 22, 28, 4, 6, 'y');
    fillRect(r, 20, 30, 8, 4, 'y');

    // Контур (тёмно-оранжевый)
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        if (r[y][x] === 'y') {
          if ((x > 0 && r[y][x - 1] === '.') ||
              (x < 47 && r[y][x + 1] === '.') ||
              (y > 0 && r[y - 1][x] === '.') ||
              (y < 47 && r[y + 1][x] === '.')) {
            // оставим контур
            // ничего: контур ставим вторым проходом
          }
        }
      }
    }
    // Контур (отдельным проходом, чтобы не зацепить уже изменённые)
    const contour = [];
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        if (r[y][x] === '.') {
          if ((x > 0 && r[y][x - 1] === 'y') ||
              (x < 47 && r[y][x + 1] === 'y') ||
              (y > 0 && r[y - 1][x] === 'y') ||
              (y < 47 && r[y + 1][x] === 'y')) {
            contour.push([x, y]);
          }
        }
      }
    }
    for (const [x, y] of contour) setPx(r, x, y, 'o');

    // Блики на верхнем-левом луче
    fillRect(r, 22, 6, 2, 2, 'h');
    fillRect(r, 21, 9, 2, 2, 'h');
    fillRect(r, 20, 13, 2, 2, 'h');
    fillRect(r, 8, 18, 4, 2, 'h');

    return rowsToStrs(r);
  }

  function makeBroom() {
    const r = blank(48, 48);
    for (let i = 0; i < 30; i++) {
      const x = 34 - Math.floor(i * 0.55);
      const y = 3 + i;
      fillRect(r, x, y, 3, 1, 'b');
      setPx(r, x - 1, y, 'd');
    }
    fillRect(r, 31, 2, 6, 4, 'b');
    fillRect(r, 8, 27, 23, 4, 'd');
    fillRect(r, 10, 31, 19, 2, 'h');
    for (let i = 0; i < 21; i++) {
      const x = 9 + i;
      const len = 10 + (i % 4);
      fillRect(r, x, 33, 1, len, 'h');
      if (i % 3 === 0) fillRect(r, x, 34, 1, len - 1, 'd');
    }
    fillRect(r, 7, 43, 25, 2, 'd');
    fillRect(r, 11, 34, 4, 2, 'b');
    fillRect(r, 20, 35, 4, 2, 'b');

    return rowsToStrs(r);
  }

  function makeBoombox() {
    const r = blank(48, 48);
    fillRect(r, 5, 39, 38, 3, 'A');
    fillRect(r, 4, 14, 40, 25, 'B');
    strokeRect(r, 4, 14, 40, 25, 'A');
    fillRect(r, 6, 16, 36, 3, 'S');
    fillRect(r, 5, 36, 38, 2, 'A');
    fillRect(r, 17, 9, 14, 5, 'B');
    strokeRect(r, 17, 9, 14, 5, 'A');
    fillRect(r, 19, 11, 10, 2, 'S');

    // === Два динамика (круги) ===
    function speaker(cx, cy, R) {
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const dx = x - cx, dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < R - 3) setPx(r, x, y, 'A');
          else if (d < R) setPx(r, x, y, 'S');
        }
      }
      // Внутренняя сетка
      for (let y = cy - R + 3; y < cy + R - 3; y += 2) {
        for (let x = cx - R + 3; x < cx + R - 3; x += 2) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy < (R - 4) * (R - 4)) setPx(r, x, y, 'B');
        }
      }
      // Центральный круг (динамик)
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const dx = x - cx, dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 3) setPx(r, x, y, 'K');
          else if (d < 4) setPx(r, x, y, 'A');
        }
      }
    }
    speaker(13, 26, 8);
    speaker(35, 26, 8);

    fillRect(r, 20, 20, 8, 8, 'S');
    strokeRect(r, 20, 20, 8, 8, 'A');
    setPx(r, 22, 24, 'A'); setPx(r, 25, 24, 'A');
    fillRect(r, 20, 32, 3, 3, 'K');
    fillRect(r, 25, 32, 3, 3, 'K');
    fillRect(r, 30, 32, 3, 3, 'S');
    fillRect(r, 38, 4, 1, 8, 'A');
    setPx(r, 38, 3, 'K');
    setPx(r, 39, 2, 'K');

    return rowsToStrs(r);
  }

  function makePizza() {
    const r = blank(48, 48);
    // Треугольный кусок пиццы: сырная середина, корочка и пепперони.
    for (let y = 8; y < 40; y++) {
      const half = Math.floor((y - 8) * 0.45);
      fillRect(r, 24 - half, y, half * 2 + 1, 1, 'c');
    }
    for (let y = 8; y < 40; y++) {
      const half = Math.floor((y - 8) * 0.45);
      setPx(r, 24 - half, y, 'o');
      setPx(r, 24 + half, y, 'o');
    }
    fillRect(r, 9, 38, 31, 5, 'b');
    fillRect(r, 10, 37, 29, 2, 'o');
    fillEllipse(r, 20, 22, 3, 3, 'p');
    fillEllipse(r, 27, 30, 3, 3, 'p');
    fillEllipse(r, 23, 36, 2, 2, 'p');
    fillRect(r, 18, 27, 3, 1, 'h');
    fillRect(r, 28, 18, 5, 1, 'h');
    fillRect(r, 22, 12, 3, 1, 'h');
    return rowsToStrs(r);
  }

  function makeDiamond() {
    const r = blank(48, 48);
    const pts = [
      [24, 6], [38, 17], [31, 39], [17, 39], [10, 17],
    ];
    for (let y = 6; y <= 39; y++) {
      const topT = Math.max(0, Math.min(1, (y - 6) / 11));
      const botT = Math.max(0, Math.min(1, (39 - y) / 22));
      const half = y <= 17 ? Math.round(14 * topT) : Math.round(14 * botT);
      fillRect(r, 24 - half, y, half * 2 + 1, 1, 'd');
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const steps = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(a[0] + (b[0] - a[0]) * s / steps);
        const y = Math.round(a[1] + (b[1] - a[1]) * s / steps);
        setPx(r, x, y, 'o');
      }
    }
    fillRect(r, 17, 17, 15, 1, 'o');
    fillRect(r, 24, 7, 1, 31, 'h');
    for (let i = 0; i < 14; i++) {
      setPx(r, 11 + i, 17 - Math.floor(i * 0.75), 'h');
      setPx(r, 24 + i, 7 + Math.floor(i * 0.75), 'h');
      setPx(r, 17 + i, 39 - Math.floor(i * 1.55), 's');
    }
    fillRect(r, 17, 12, 9, 2, 'h');
    fillRect(r, 14, 18, 5, 2, 'h');
    return rowsToStrs(r);
  }

  function makeDust() {
    // Спрайт «облака пыли» 96×96 (3×3 тайла); рисуем как облачные комки
    const r = blank(96, 96);
    function blob(cx, cy, rx, ry) {
      for (let y = Math.max(0, cy - ry); y < Math.min(96, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x < Math.min(96, cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy < 1) setPx(r, x, y, 'd');
        }
      }
    }
    blob(48, 48, 38, 30);
    blob(28, 32, 18, 14);
    blob(68, 32, 18, 14);
    blob(28, 64, 18, 14);
    blob(68, 64, 18, 14);
    blob(48, 22, 14, 10);
    blob(48, 74, 14, 10);
    // Светлые блики
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        if (r[y][x] === 'd' && (x + y) % 7 === 0) setPx(r, x, y, 'D');
      }
    }
    // Контур чуть темнее
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        if (r[y][x] === '.' && (
          (x > 0 && r[y][x - 1] === 'd') ||
          (x < 95 && r[y][x + 1] === 'd') ||
          (y > 0 && r[y - 1][x] === 'd') ||
          (y < 95 && r[y + 1][x] === 'd')
        )) setPx(r, x, y, 'D');
      }
    }
    return rowsToStrs(r);
  }

  const starPalette = { y: P.starY, o: P.starO, h: P.starHi };
  const broomPalette = { b: P.broomB, h: P.broomH, d: P.broomD };
  const boomboxPalette = { B: P.boomboxB, S: P.boomboxS, A: P.boomboxA, K: P.boomboxK };
  const pizzaPalette = { c: '#ffd86a', b: '#c46a2a', o: '#8b3f19', p: '#e84242', h: '#fff1a8' };
  const diamondPalette = { d: '#45d8ff', o: '#08739a', h: '#d8fbff', s: '#1390ca' };
  const dustPalette = { d: P.dust, D: P.dustDark };

  G.sprites.powerups = {
    star:    makeBitmap(makeStar(),    starPalette),
    broom:   makeBitmap(makeBroom(),   broomPalette),
    boombox: makeBitmap(makeBoombox(), boomboxPalette),
  };
  G.sprites.baits = {
    pizza:   makeBitmap(makePizza(),   pizzaPalette),
    diamond: makeBitmap(makeDiamond(), diamondPalette),
  };
  G.sprites.dust = makeBitmap(makeDust(), dustPalette);
  // Алиасы power-up спрайтов в G.sprites.traps — чтобы существующий рендер
  // пикапов и тайл-объектов (uses G.sprites.traps[type]) находил спрайт
  G.sprites.traps.star = G.sprites.powerups.star;
  G.sprites.traps.broom = G.sprites.powerups.broom;
  G.sprites.traps.boombox = G.sprites.powerups.boombox;
  G.sprites.traps.pizza = G.sprites.baits.pizza;
  G.sprites.traps.diamond = G.sprites.baits.diamond;

  // --- Подсветка пикапов 32×32 (увеличена под TILE=48) ---

  function makePickupBg() {
    const r = blank(32, 32);
    const cx = 16, cy = 16;
    const R = 15;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R - 2) setPx(r, x, y, 'q');
        else if (d < R) setPx(r, x, y, 'l');
      }
    }
    return rowsToStrs(r);
  }

  G.sprites.pickupBg = makeBitmap(makePickupBg(), { l: '#ffee88', q: '#fff7c0' });

  // --- Сердечки 12×12 для HUD ---

  function makeHeart(empty) {
    const r = blank(12, 12);
    const ch = empty ? 'd' : 'r';
    fillRect(r, 1, 3, 10, 4, ch);
    fillRect(r, 2, 7, 8, 1, ch);
    fillRect(r, 3, 8, 6, 1, ch);
    fillRect(r, 4, 9, 4, 1, ch);
    fillRect(r, 5, 10, 2, 1, ch);
    fillRect(r, 2, 2, 3, 2, ch);
    fillRect(r, 7, 2, 3, 2, ch);
    if (!empty) {
      // Блик
      setPx(r, 3, 3, 'h');
      setPx(r, 4, 4, 'h');
    }
    return rowsToStrs(r);
  }

  G.sprites.heart = makeBitmap(makeHeart(false), {
    r: P.heart, h: '#ff8aa0', d: P.heartDark,
  });
  G.sprites.heartEmpty = makeBitmap(makeHeart(true), {
    r: P.heart, h: '#ff8aa0', d: P.heartDark,
  });

  // --- Эффект взрыва (программный, размер увеличен под 48-тайл) ---

  function explosionFrame(size, density) {
    const rows = [];
    const cx = size / 2;
    const cy = size / 2;
    for (let y = 0; y < size; y++) {
      let row = '';
      for (let x = 0; x < size; x++) {
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < density * 0.45) row += 'y';
        else if (r < density * 0.85) row += 'o';
        else if (r < density * 1.0) row += 'r';
        else row += '.';
      }
      rows.push(row);
    }
    return rows;
  }

  const explPalette = { y: P.explosionY, o: P.explosion, r: P.firework };
  G.sprites.explosion = [
    makeBitmap(explosionFrame(96, 45), explPalette),
    makeBitmap(explosionFrame(96, 70), explPalette),
    makeBitmap(explosionFrame(96, 90), explPalette),
  ];

  G.spriteFrame = function (anim, t, frameTime = 0.18) {
    const idx = Math.floor(t / frameTime) % anim.length;
    return anim[idx];
  };
})();
