// Процедурно сгенерированные пиксельные спрайты 32×32 в стиле PNG-референса.
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
  function strokeRect(r, x, y, w, h, ch) {
    fillRect(r, x, y, w, 1, ch);
    fillRect(r, x, y + h - 1, w, 1, ch);
    fillRect(r, x, y, 1, h, ch);
    fillRect(r, x + w - 1, y, 1, h, ch);
  }
  function rowsToStrs(rows) { return rows.map((r) => r.join('')); }
  function flipH(rows) { return rows.map((r) => r.split('').reverse().join('')); }

  // --- Тайлы 32×32 ---

  function makeFloor() {
    const r = blank(32, 32);
    fillRect(r, 0, 0, 32, 32, 'a');
    // Пятна более тёмной зелени
    const shades = [
      [3, 6], [11, 4], [19, 7], [25, 3], [28, 13],
      [5, 15], [16, 17], [27, 19], [9, 22], [14, 27],
      [22, 25], [3, 26], [29, 27], [11, 30], [21, 11],
    ];
    for (const [x, y] of shades) setPx(r, x, y, 'b');
    // Пучки травы (тёмные точки в форме маленьких метёлок)
    const tufts = [
      [5, 4], [13, 9], [22, 5], [29, 9],
      [7, 13], [18, 14], [26, 16], [11, 18],
      [4, 21], [16, 23], [24, 22], [8, 27],
      [19, 28], [28, 25], [13, 16],
    ];
    for (const [x, y] of tufts) {
      setPx(r, x, y, 'c');
      setPx(r, x - 1, y, 'b');
      setPx(r, x + 1, y, 'b');
      setPx(r, x, y - 1, 'b');
    }
    return rowsToStrs(r);
  }

  function makeBin() {
    const r = blank(32, 32);
    // Ручка крышки (сверху)
    fillRect(r, 13, 1, 6, 1, 'b');
    fillRect(r, 12, 2, 8, 2, 'b');
    setPx(r, 13, 2, 'd');
    // Крышка (нависает)
    fillRect(r, 3, 4, 26, 3, 'b');
    fillRect(r, 4, 5, 24, 1, 'd');
    fillRect(r, 4, 4, 24, 1, 'c');
    // Тело бака
    fillRect(r, 5, 7, 22, 21, 'c');
    strokeRect(r, 5, 7, 22, 21, 'b');
    // Рёбра жёсткости (вертикальные тёмные полосы)
    for (let x = 8; x < 27; x += 4) {
      fillRect(r, x, 8, 1, 19, 'd');
    }
    // Лёгкий блик слева
    fillRect(r, 6, 8, 1, 19, 'd');
    // База / тень
    fillRect(r, 5, 28, 22, 1, 'b');
    fillRect(r, 7, 29, 18, 1, 'b');
    return rowsToStrs(r);
  }

  function makeCrate() {
    const r = blank(32, 32);
    // Внешняя рамка
    fillRect(r, 0, 0, 32, 32, 'e');
    strokeRect(r, 0, 0, 32, 32, 'f');
    strokeRect(r, 1, 1, 30, 30, 'f');
    // Угловые скобы
    fillRect(r, 2, 2, 4, 1, 'f');
    fillRect(r, 2, 2, 1, 4, 'f');
    fillRect(r, 26, 2, 4, 1, 'f');
    fillRect(r, 29, 2, 1, 4, 'f');
    fillRect(r, 2, 29, 4, 1, 'f');
    fillRect(r, 2, 26, 1, 4, 'f');
    fillRect(r, 26, 29, 4, 1, 'f');
    fillRect(r, 29, 26, 1, 4, 'f');
    // Диагональный крест X (две полосы)
    for (let i = 0; i < 28; i++) {
      const x = 2 + i;
      const y1 = 2 + i;
      const y2 = 29 - i;
      // Толщина 2 пикселя
      setPx(r, x, y1, 'g'); setPx(r, x + 1, y1, 'g');
      setPx(r, x, y2, 'g'); setPx(r, x + 1, y2, 'g');
    }
    // Обводка вокруг X для контраста
    // (оставим как есть — диагональная полоса уже видна)
    // Текстура досок (горизонтальные тонкие линии)
    for (let y = 5; y < 30; y += 6) {
      for (let x = 3; x < 29; x++) {
        if (r[y][x] === 'e') setPx(r, x, y, 'f');
      }
    }
    return rowsToStrs(r);
  }

  function makePallet() {
    const r = blank(32, 32);
    // 4 горизонтальные доски (высотой 6 каждая, с зазором 2)
    for (let i = 0; i < 4; i++) {
      const y = 1 + i * 8;
      // Основа доски
      fillRect(r, 0, y, 32, 6, 'p');
      // Верх и низ доски (тёмные канты)
      fillRect(r, 0, y, 32, 1, 'g');
      fillRect(r, 0, y + 5, 32, 1, 'g');
      // Текстура — несколько вертикальных штрихов
      for (let x = 4; x < 32; x += 5) {
        fillRect(r, x, y + 2, 1, 2, 'g');
      }
    }
    // Боковые опоры (вертикальные)
    fillRect(r, 0, 0, 2, 32, 'g');
    fillRect(r, 30, 0, 2, 32, 'g');
    fillRect(r, 15, 0, 2, 32, 'g');
    return rowsToStrs(r);
  }

  function makeFence() {
    const r = blank(32, 32);
    // Рамка-стойки
    fillRect(r, 0, 0, 32, 2, 'p');
    fillRect(r, 0, 30, 32, 2, 'p');
    fillRect(r, 0, 0, 2, 32, 'p');
    fillRect(r, 30, 0, 2, 32, 'p');
    // Сетка-ромбы внутри
    for (let y = 2; y < 30; y++) {
      for (let x = 2; x < 30; x++) {
        const dx = x - 2, dy = y - 2;
        // Диагонали идут вверх-вправо и вниз-вправо, шаг 4
        const a = (dx + dy) % 4;
        const b = (dx - dy + 28) % 4;
        if (a === 0) setPx(r, x, y, 'i');
        if (b === 0) setPx(r, x, y, 'i');
      }
    }
    // Тени внутри
    for (let y = 3; y < 29; y++) {
      for (let x = 3; x < 29; x++) {
        if (r[y][x] === '.') {
          const dx = x - 2, dy = y - 2;
          if ((dx + dy) % 4 === 1 || (dx - dy + 28) % 4 === 1) setPx(r, x, y, 'j');
        }
      }
    }
    return rowsToStrs(r);
  }

  function makeBush() {
    const r = blank(32, 32);
    // Большой круг с лёгкими бугорками
    const cx = 16, cy = 16;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) + Math.sin((x + y) * 0.6) * 1.5;
        if (d < 13) setPx(r, x, y, 'k');
        else if (d < 14.5) setPx(r, x, y, 'j');
      }
    }
    // Несколько светлых бликов (листья)
    const leaves = [
      [10, 8], [16, 10], [22, 9], [11, 14], [20, 14],
      [8, 18], [14, 19], [22, 19], [12, 23], [20, 23],
    ];
    for (const [x, y] of leaves) setPx(r, x, y, 'k');
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

  // --- Дворник 32×32 ---
  // E=cap dark, e=cap, s=skin, S=skinDark
  // J=jacketDark, j=jacket, v=vest, V=vestStripe
  // p=pants, P=pantsDark, b=boot
  // y=yellow eye area? нет, используем чёрные точки 'M' для глаз
  // M=eyes (тёмный)

  function makeJanitor(dir, frame, pose = 'normal') {
    const r = blank(32, 32);

    // === Голова с кепкой (rows 0-13) ===
    // Кепка (rows 1-7), козырёк (row 8 в зависимости от dir)
    // Кепка: овал
    // Тёмная окантовка кепки
    fillRect(r, 9, 1, 14, 1, 'E');
    fillRect(r, 8, 2, 16, 1, 'E');
    fillRect(r, 7, 3, 18, 1, 'E');
    // Оранжевый верх кепки
    fillRect(r, 8, 3, 16, 4, 'e');
    fillRect(r, 9, 2, 14, 1, 'e');
    fillRect(r, 10, 1, 12, 1, 'e');
    // Полоса-лента вокруг кепки
    fillRect(r, 7, 7, 18, 1, 'E');
    // Козырёк (только при взгляде вниз/вбок)
    if (dir === 'down') {
      fillRect(r, 8, 8, 16, 1, 'E');
      fillRect(r, 9, 9, 14, 1, 'E');
    } else if (dir === 'left') {
      fillRect(r, 4, 8, 14, 1, 'E');
      fillRect(r, 5, 9, 12, 1, 'E');
    } else if (dir === 'up') {
      // Сзади козырька не видно
    }

    // Лицо (rows 8-13)
    if (dir === 'up') {
      fillRect(r, 9, 8, 14, 6, 's');
    } else {
      // Лицо с подбородком
      fillRect(r, 9, 10, 14, 4, 's');
      fillRect(r, 10, 9, 12, 1, 's');
      fillRect(r, 10, 14, 12, 1, 's');
      // Уши
      setPx(r, 8, 11, 's');
      setPx(r, 23, 11, 's');
      setPx(r, 8, 12, 'S');
      setPx(r, 23, 12, 'S');
    }

    // Глаза + рот (только не сзади)
    if (dir === 'down') {
      fillRect(r, 11, 11, 2, 2, 'M');
      fillRect(r, 19, 11, 2, 2, 'M');
      fillRect(r, 14, 13, 4, 1, 'S');
    } else if (dir === 'left') {
      fillRect(r, 10, 11, 2, 2, 'M');
      fillRect(r, 17, 11, 2, 2, 'M');
      fillRect(r, 12, 13, 3, 1, 'S');
    }

    // === Куртка + жилет (rows 14-20) ===
    // Воротник
    fillRect(r, 9, 14, 14, 1, 'J');
    // Плечи
    fillRect(r, 7, 15, 18, 1, 'J');
    fillRect(r, 6, 16, 20, 5, 'J');
    // Жилет (поверх куртки)
    if (dir === 'up') {
      // Сзади жилет почти весь виден
      fillRect(r, 8, 15, 16, 6, 'v');
      fillRect(r, 8, 17, 16, 1, 'V');
      fillRect(r, 8, 19, 16, 1, 'V');
    } else {
      // Спереди / сбоку — жилет распахнут, видно куртку посередине
      fillRect(r, 7, 15, 6, 6, 'v');
      fillRect(r, 19, 15, 6, 6, 'v');
      // Полосы на жилетке
      fillRect(r, 7, 17, 6, 1, 'V');
      fillRect(r, 19, 17, 6, 1, 'V');
      fillRect(r, 7, 19, 6, 1, 'V');
      fillRect(r, 19, 19, 6, 1, 'V');
    }

    // Руки (по бокам)
    if (pose === 'throw') {
      // Бросок: правая рука вытянута наружу/вперёд, левая прижата
      fillRect(r, 5, 17, 2, 4, 'j');
      if (dir === 'left') {
        // вытянута влево
        fillRect(r, 0, 16, 8, 2, 'j');
        fillRect(r, 0, 17, 2, 1, 's');
      } else if (dir === 'up') {
        // вытянута вверх
        fillRect(r, 23, 8, 3, 10, 'j');
        fillRect(r, 23, 7, 3, 1, 's');
      } else if (dir === 'down') {
        // вытянута вниз — рука и кисть видны спереди
        fillRect(r, 24, 16, 3, 10, 'j');
        fillRect(r, 24, 26, 3, 1, 's');
      } else {
        // 'right' — вытянута вправо
        fillRect(r, 24, 16, 8, 2, 'j');
        fillRect(r, 30, 17, 2, 1, 's');
      }
    } else if (pose === 'slide') {
      // Скольжение: обе руки разведены в стороны для баланса
      fillRect(r, 0, 17, 7, 2, 'j');
      fillRect(r, 25, 17, 7, 2, 'j');
      fillRect(r, 0, 18, 2, 1, 's');
      fillRect(r, 30, 18, 2, 1, 's');
    } else if (dir === 'left') {
      // Левая рука вынесена вперёд
      fillRect(r, 5, 17, 2, 4, 'j');
      fillRect(r, 4, 19, 3, 2, 's');
    } else if (dir !== 'up') {
      fillRect(r, 5, 17, 2, 4, 'j');
      fillRect(r, 25, 17, 2, 4, 'j');
      fillRect(r, 5, 21, 2, 1, 's');
      fillRect(r, 25, 21, 2, 1, 's');
    } else {
      fillRect(r, 5, 17, 2, 4, 'j');
      fillRect(r, 25, 17, 2, 4, 'j');
    }

    // === Штаны (rows 21-27) ===
    fillRect(r, 9, 21, 14, 6, 'p');
    fillRect(r, 9, 21, 14, 1, 'P');
    // Шов посередине
    setPx(r, 15, 22, 'P');
    setPx(r, 15, 24, 'P');
    setPx(r, 15, 26, 'P');
    setPx(r, 16, 23, 'P');
    setPx(r, 16, 25, 'P');

    // === Ноги + ботинки (rows 27-31) ===
    // Анимация ходьбы: чередуем длину/положение ботинок
    if (frame === 0) {
      // Стойка
      fillRect(r, 9, 27, 6, 4, 'p');
      fillRect(r, 17, 27, 6, 4, 'p');
      fillRect(r, 9, 30, 6, 2, 'b');
      fillRect(r, 17, 30, 6, 2, 'b');
    } else {
      // Шаг
      if (dir === 'left' || dir === 'right') {
        fillRect(r, 9, 27, 6, 5, 'p');
        fillRect(r, 17, 28, 6, 3, 'p');
        fillRect(r, 9, 31, 6, 1, 'b');
        fillRect(r, 17, 30, 6, 2, 'b');
      } else {
        fillRect(r, 9, 27, 6, 5, 'p');
        fillRect(r, 17, 27, 6, 4, 'p');
        fillRect(r, 9, 31, 6, 1, 'b');
        fillRect(r, 17, 30, 6, 2, 'b');
      }
    }

    return rowsToStrs(r);
  }

  const janitorPalette = {
    E: P.capDark, e: P.cap,
    s: P.skin, S: P.skinDark, M: P.boot,
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
  };

  // --- Енот 32×32 ---

  function makeRaccoon(dir, frame, pose = 'normal') {
    const r = blank(32, 32);

    // Уши (треугольники сверху)
    fillRect(r, 6, 1, 4, 2, 'r');
    fillRect(r, 7, 3, 3, 1, 'r');
    fillRect(r, 22, 1, 4, 2, 'r');
    fillRect(r, 22, 3, 3, 1, 'r');
    fillRect(r, 7, 2, 2, 1, 'R');
    fillRect(r, 23, 2, 2, 1, 'R');
    // Внутренность ушей
    setPx(r, 8, 2, 'w');
    setPx(r, 24, 2, 'w');

    // Голова (овал)
    fillRect(r, 7, 3, 18, 9, 'r');
    fillRect(r, 6, 5, 1, 5, 'r');
    fillRect(r, 25, 5, 1, 5, 'r');
    fillRect(r, 5, 6, 1, 3, 'r');
    fillRect(r, 26, 6, 1, 3, 'r');

    if (dir !== 'up') {
      // Маска (две тёмные области вокруг глаз)
      fillRect(r, 8, 6, 7, 4, 'm');
      fillRect(r, 17, 6, 7, 4, 'm');
      // Белые «брови» / морда
      fillRect(r, 8, 5, 7, 1, 'w');
      fillRect(r, 17, 5, 7, 1, 'w');
      // Глаза (белые точки в маске)
      fillRect(r, 10, 7, 2, 2, 'w');
      fillRect(r, 19, 7, 2, 2, 'w');
      // Зрачки
      setPx(r, 11, 7, 'm');
      setPx(r, 20, 7, 'm');
      // Морда (белая часть от носа)
      fillRect(r, 13, 9, 6, 3, 'w');
      // Нос
      fillRect(r, 15, 9, 2, 1, 'm');
      setPx(r, 14, 10, 'm');
      setPx(r, 17, 10, 'm');
      // Рот
      setPx(r, 15, 11, 'm');
      setPx(r, 16, 11, 'm');
    } else {
      // Сзади — затылок
      fillRect(r, 8, 5, 16, 5, 'r');
      // Намёк на уши изнутри
      setPx(r, 9, 6, 'R');
      setPx(r, 22, 6, 'R');
    }

    // Тело (округлое)
    fillRect(r, 5, 12, 22, 11, 'r');
    fillRect(r, 4, 14, 1, 6, 'r');
    fillRect(r, 27, 14, 1, 6, 'r');
    // Контур тела
    fillRect(r, 5, 12, 22, 1, 'R');
    fillRect(r, 5, 22, 22, 1, 'R');

    // Грудь / живот (светлый)
    if (dir !== 'up') {
      fillRect(r, 12, 14, 8, 7, 'w');
      // Полоски на животе
      fillRect(r, 12, 16, 8, 1, 'r');
      fillRect(r, 12, 19, 8, 1, 'r');
    } else {
      // Полоски на спине
      fillRect(r, 9, 14, 14, 1, 'm');
      fillRect(r, 9, 17, 14, 1, 'm');
      fillRect(r, 9, 20, 14, 1, 'm');
    }

    // Хвост (виден сбоку или сзади)
    if (dir === 'left') {
      fillRect(r, 0, 16, 6, 6, 'r');
      fillRect(r, 1, 17, 4, 1, 'm');
      fillRect(r, 1, 20, 4, 1, 'm');
      // Кончик хвоста чёрный
      fillRect(r, 0, 18, 1, 2, 'm');
    } else if (dir === 'down' || dir === 'up') {
      // Хвост выглядывает справа сзади
      fillRect(r, 26, 18, 6, 6, 'r');
      fillRect(r, 27, 19, 4, 1, 'm');
      fillRect(r, 27, 22, 4, 1, 'm');
      fillRect(r, 31, 20, 1, 2, 'm');
    }

    // Лапы (frame-зависимо или поза)
    if (pose === 'throw') {
      // Передние лапы: одна вытянута наружу
      fillRect(r, 8, 23, 4, 5, 'R');
      fillRect(r, 8, 27, 4, 2, 'm');
      if (dir === 'left') {
        fillRect(r, 0, 18, 7, 2, 'R');
        fillRect(r, 0, 19, 2, 1, 'w');
      } else if (dir === 'up') {
        fillRect(r, 22, 8, 3, 10, 'R');
        fillRect(r, 22, 7, 3, 1, 'm');
      } else if (dir === 'down') {
        fillRect(r, 22, 16, 3, 10, 'R');
        fillRect(r, 22, 26, 3, 1, 'w');
      } else {
        fillRect(r, 25, 18, 7, 2, 'R');
        fillRect(r, 30, 19, 2, 1, 'w');
      }
    } else if (pose === 'slide') {
      // Лапы веером в стороны
      fillRect(r, 0, 21, 8, 2, 'R');
      fillRect(r, 24, 21, 8, 2, 'R');
      fillRect(r, 0, 22, 2, 1, 'm');
      fillRect(r, 30, 22, 2, 1, 'm');
      fillRect(r, 8, 24, 4, 4, 'R');
      fillRect(r, 20, 24, 4, 4, 'R');
    } else {
      const fOff = frame === 0 ? 0 : 1;
      if (dir === 'left' || dir === 'right') {
        fillRect(r, 8, 23, 4, 5 + fOff, 'R');
        fillRect(r, 18, 23, 4, 5 - fOff, 'R');
        fillRect(r, 8, 26 + fOff, 4, 2, 'm');
        fillRect(r, 18, 26 - fOff, 4, 2, 'm');
      } else {
        fillRect(r, 8, 23, 4, 5 + (frame ? 1 : 0), 'R');
        fillRect(r, 20, 23, 4, 5 - (frame ? 1 : 0), 'R');
        fillRect(r, 8, 27 + (frame ? 1 : 0), 4, 2, 'm');
        fillRect(r, 20, 27 - (frame ? 1 : 0), 4, 2, 'm');
      }
    }

    return rowsToStrs(r);
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
  };

  // --- Ловушки 32×32 ---

  function makeMousetrap() {
    const r = blank(32, 32);
    // Деревянная база
    fillRect(r, 4, 8, 24, 16, 'm');
    strokeRect(r, 4, 8, 24, 16, 's');
    // Внутренняя плошка (углубление)
    fillRect(r, 6, 10, 20, 12, 'c');
    strokeRect(r, 6, 10, 20, 12, 's');
    // Сыр (квадрат с дырками)
    fillRect(r, 9, 12, 14, 8, 'y');
    strokeRect(r, 9, 12, 14, 8, 's');
    setPx(r, 12, 14, 'h'); setPx(r, 13, 14, 'h');
    setPx(r, 18, 15, 'h'); setPx(r, 19, 15, 'h');
    setPx(r, 14, 17, 'h'); setPx(r, 15, 17, 'h');
    setPx(r, 19, 18, 'h');
    // Металлическая дуга / пружина (сверху)
    fillRect(r, 6, 6, 1, 4, 'M');
    fillRect(r, 25, 6, 1, 4, 'M');
    fillRect(r, 7, 5, 18, 1, 'M');
    // Крепления-оси
    fillRect(r, 5, 23, 2, 2, 's');
    fillRect(r, 25, 23, 2, 2, 's');
    return rowsToStrs(r);
  }

  function makePuddle() {
    const r = blank(32, 32);
    const cx = 16, cy = 16;
    const radius = 14;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - cx, dy = (y - cy) * 1.4; // сплюснутый по вертикали овал
        const d = Math.sqrt(dx * dx + dy * dy) + Math.sin(x * 0.9 + y * 0.3) * 0.6;
        if (d < radius - 2) setPx(r, x, y, 'u');
        else if (d < radius - 0.5) setPx(r, x, y, 'd');
        else if (d < radius) setPx(r, x, y, 'd');
      }
    }
    // Блики
    const highlights = [
      [10, 11], [11, 11], [12, 11],
      [20, 14], [21, 14],
      [9, 18], [10, 18],
      [22, 19], [23, 19], [24, 19],
      [13, 21], [14, 21],
    ];
    for (const [x, y] of highlights) setPx(r, x, y, 'v');
    return rowsToStrs(r);
  }

  function makeFirecracker() {
    const r = blank(32, 32);
    // Цилиндр динамита (rows 8-26)
    fillRect(r, 10, 8, 12, 18, 'r');
    strokeRect(r, 10, 8, 12, 18, 'f');
    // Жёлтая полоса посередине
    fillRect(r, 10, 14, 12, 4, 'y');
    fillRect(r, 10, 14, 12, 1, 'f');
    fillRect(r, 10, 17, 12, 1, 'f');
    // Фитиль (вверх и в сторону)
    fillRect(r, 15, 4, 2, 4, 'b');
    fillRect(r, 13, 3, 2, 1, 'b');
    fillRect(r, 12, 2, 2, 1, 'b');
    // Искра
    setPx(r, 11, 1, 'Y');
    setPx(r, 12, 1, 'S');
    setPx(r, 11, 0, 'S');
    setPx(r, 10, 1, 'S');
    setPx(r, 12, 0, 'Y');
    // Бликовая точка на динамите
    fillRect(r, 12, 11, 1, 2, 'y');
    fillRect(r, 12, 20, 1, 3, 'y');
    return rowsToStrs(r);
  }

  function makeBanana() {
    const r = blank(32, 32);
    // Y-образная очищенная кожура: центр + три «лепестка»
    // Центральная мякоть
    fillRect(r, 13, 14, 6, 5, 'h');
    // Лепесток вверх-влево
    fillRect(r, 9, 8, 5, 8, 'y');
    fillRect(r, 8, 9, 1, 6, 'd');
    fillRect(r, 13, 9, 1, 5, 'd');
    setPx(r, 9, 7, 'd');
    setPx(r, 13, 7, 'd');
    // Лепесток вверх-вправо
    fillRect(r, 18, 8, 5, 8, 'y');
    fillRect(r, 23, 9, 1, 6, 'd');
    fillRect(r, 18, 9, 1, 5, 'd');
    setPx(r, 18, 7, 'd');
    setPx(r, 22, 7, 'd');
    // Лепесток вниз
    fillRect(r, 12, 19, 8, 8, 'y');
    fillRect(r, 11, 20, 1, 6, 'd');
    fillRect(r, 20, 20, 1, 6, 'd');
    fillRect(r, 14, 26, 4, 1, 'd');
    // Кончики (потемнее)
    setPx(r, 11, 8, 'd'); setPx(r, 11, 9, 'd');
    setPx(r, 20, 8, 'd'); setPx(r, 21, 8, 'd');
    setPx(r, 15, 27, 'd'); setPx(r, 16, 27, 'd');
    // Блики
    setPx(r, 11, 11, 'h');
    setPx(r, 20, 11, 'h');
    setPx(r, 14, 22, 'h');
    setPx(r, 17, 22, 'h');
    return rowsToStrs(r);
  }

  function makeTrapdoor() {
    const r = blank(32, 32);
    const cx = 16, cy = 16;
    const R = 14;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R - 2) setPx(r, x, y, 'h');
        else if (d < R) setPx(r, x, y, 't');
      }
    }
    // Радиальный узор: шесть «спиц» от центра наружу
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3;
      for (let s = 3; s < R - 3; s++) {
        const x = Math.round(cx + Math.cos(ang) * s);
        const y = Math.round(cy + Math.sin(ang) * s);
        setPx(r, x, y, 't');
      }
    }
    // Концентрический узор (точки)
    for (let a = 0; a < 12; a++) {
      const ang = (a * Math.PI) / 6;
      const x = Math.round(cx + Math.cos(ang) * 8);
      const y = Math.round(cy + Math.sin(ang) * 8);
      setPx(r, x, y, 't');
    }
    // Центральный кружок
    fillRect(r, cx - 1, cy - 1, 2, 2, 't');
    // Лёгкий блик
    setPx(r, cx - 4, cy - 6, 'n');
    setPx(r, cx - 3, cy - 6, 'n');
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

  G.sprites.traps = {
    mousetrap:   makeBitmap(makeMousetrap(),   mousetrapPalette),
    puddle:      makeBitmap(makePuddle(),      puddlePalette),
    firecracker: makeBitmap(makeFirecracker(), firecrackerPalette),
    trapdoor:    makeBitmap(makeTrapdoor(),    trapdoorPalette),
    banana:      makeBitmap(makeBanana(),      bananaPalette),
  };

  // --- Подсветка пикапов 24×24 ---

  function makePickupBg() {
    const r = blank(24, 24);
    const cx = 12, cy = 12;
    const R = 11;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R - 1.5) setPx(r, x, y, 'q');
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
    const lobes = [
      [3, 2, 3, 2], [6, 2, 3, 2],   // верхушки
    ];
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

  // --- Эффект взрыва (программный, размер увеличен под 32-тайл) ---

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
    makeBitmap(explosionFrame(64, 30), explPalette),
    makeBitmap(explosionFrame(64, 46), explPalette),
    makeBitmap(explosionFrame(64, 60), explPalette),
  ];

  G.spriteFrame = function (anim, t, frameTime = 0.18) {
    const idx = Math.floor(t / frameTime) % anim.length;
    return anim[idx];
  };
})();
