# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project context (transitional notes)

Эта папка `svalkus/` — **копия** проекта `tj_game/`, сделанная для апгрейда графики без риска сломать оригинал. Игра переименована из «Дворник vs Енот» в **«Свалкус»** (короткое запоминающееся название). Ниже выжимка того, что есть, и того, что нужно сделать в этой ветке.

## Что это за игра

Браузерная 2D пиксель-арт игра «**Свалкус**» в стиле «Том и Джерри»: **Дворник** ловит **Енота** в арене с препятствиями. У каждого 5 HP и инвентарь из 5 типов ловушек. Tom-and-Jerry style — оба могут ставить ловушки друг на друга и подбирать пикапы. Кто потеряет 5 HP — проиграл.

**Режимы:** 1P vs CPU, 2P Hot Seat (одна клавиатура), сетевой P2P через WebRTC (PeerJS broker, host-authoritative, 60Hz снапшоты). Сетевой режим уже работает и протестирован с реальным другом — деплоится на GitHub Pages.

**Управление:**
- P1: WASD движение, F поставить, Q/E переключить ловушку
- P2: стрелки, «.» поставить, «,»/«.» переключить
- Esc — пауза с краткими правилами, R — рестарт, M — выйти в меню

## Архитектура (всё в `src/`, открывается через `index.html`)

| Файл | Что делает |
|------|------------|
| [src/config.js](src/config.js) | Все балансные константы + палитра. Здесь же `TILE`, `ARENA_W/H`, `CANVAS_W/H` |
| [src/sprites.js](src/sprites.js) | **Все спрайты генерируются процедурно** через массивы пикселей и палитры. Никаких PNG — кроме референса в корне |
| [src/arena.js](src/arena.js) | Сетка препятствий, тайловая коллизия |
| [src/player.js](src/player.js) | Класс Player: движение, HP, инвентарь, скольжение, проваливание, сериализация для сети |
| [src/input.js](src/input.js) | InputDevice интерфейс: `isDown(action)`, `wasPressed(action)`, `consume()`. Реализуется local input, AI, NetInputDevice |
| [src/ai.js](src/ai.js) | AIController как реализация InputDevice |
| [src/traps.js](src/traps.js) | Логика установки и срабатывания ловушек, проектили (банан) |
| [src/pickups.js](src/pickups.js) | Спавн пикапов и подбор |
| [src/render.js](src/render.js) | Камера, split-screen и full-screen рендер, screen shake. Мир запекается в worldCanvas один раз |
| [src/hud.js](src/hud.js) | HP-сердечки, инвентарь со слотами-иконками, имя игрока |
| [src/audio.js](src/audio.js) | WebAudio: SFX + процедурная фоновая музыка в стиле Том&Джерри |
| [src/particles.js](src/particles.js) | Партиклы (искры, всплески, пыль) |
| [src/net.js](src/net.js) | PeerJS обёртка, NetInputDevice, snapshot/event протокол |
| [src/main.js](src/main.js) | State machine (MENU → MENU_NET → NET_LOBBY_* → PLAYING → PAUSED → GAMEOVER), game loop, кнопка mute |

## Что было сделано в самой свежей итерации (v1.7 — графика под референс)

См. [ChatGPT Image 26 апр. 2026 г., 21_53_06.png](ChatGPT Image 26 апр. 2026 г., 21_53_06.png) — это **референс-PNG**, на который равняемся.

В палитре ([src/config.js](src/config.js)) и спрайтах ([src/sprites.js](src/sprites.js)) были применены правки:
- **Дворник:** жилет жёлтый → оранжевый со светлыми кремовыми полосами (светоотражающие); штаны оранжевые → тёмно-синие (сливаются с курткой → эффект синего комбинезона); добавлена **тёмная борода** (новый ключ палитры `B: P.beard`).
- **Енот:** маска шире и глубже, глаза увеличены до 3×2, **полосатый пушистый хвост** виден во всех направлениях (включая `right`), 7×9 размером.
- **Банан:** переделан в форму «4 лепестка вокруг светлой мякоти + стебелёк» вместо рваной Y-формы.
- **Люк:** убраны радиальные спицы, добавлена решётка из ямок 3×3 + явный тёмный обод.
- **Мышеловка:** оставлена с сыром (по решению пользователя).

## ТЕКУЩАЯ МИССИЯ ДЛЯ ЭТОЙ ВЕТКИ — Вариант A: больше детализации

Пользователь выбрал «top-down + больше пикселей на тайл» (а не изометрию). Цель: **TILE 32 → 48**, перерисовать все спрайты с большей детализацией (складки одежды у дворника, текстура меха и колец на хвосте у енота, объёмные ловушки с более явной формой и тенями).

### Шаги (по убыванию приоритета)

1. **`src/config.js`:** TILE = 48. Пересчитать `CANVAS_W/H` так, чтобы помещалось разумно. Варианты:
   - оставить ARENA 24×18 → canvas 1152×864 (большой, не везде влезет)
   - **рекомендую** ARENA 20×15 → canvas 960×720 + split-screen учтёт SPLIT_GAP
   - или ввести камеру с зумом: внутри tile=48, но canvas остаётся 768×608 и камера уже
2. **`src/sprites.js`:** заменить `blank(32,32)` → `blank(48,48)` во всех `make*()` функциях. Это **ломающий пикселизацию шаг** — каждая функция должна быть **переписана** с новой раскладкой пикселей (нельзя просто масштабировать `*1.5`). Включает: `makeFloor`, `makeBin`, `makeCrate`, `makePallet`, `makeFence`, `makeBush`, `makeJanitor`, `makeRaccoon`, `makeMousetrap`, `makePuddle`, `makeFirecracker`, `makeBanana`, `makeTrapdoor`. Сердечки HUD и pickupBg, наверное, оставить 12/24.
3. **HUD ([src/hud.js](src/hud.js)):** инвентарь рисует иконку `iconSize=18`, увеличить пропорционально (24 или 32). Слоты пересчитать.
4. **Render ([src/render.js](src/render.js)):** функция `init()` перебакивает мир — она просто использует `C.TILE`, должна работать без правок.
5. **Player hitbox:** `C.PLAYER_HITBOX = 20` — может потребоваться 28-30 для нового масштаба.
6. **Сериализация (для сети):** ничего не должно сломаться — координаты в пикселях, формат тот же.
7. **Верификация:** локальный сервер + Playwright скриншоты для сравнения с оригиналом.

### Подводные камни

- **Процедурное рисование пиксель-арта затратно по времени** при 48×48. Каждый объект — это вручную расставленные `fillRect`/`setPx`. Бюджет работы — несколько подходов.
- **Палитра уже подкручена под референс** — не трогать без причины.
- **Сетевой режим всё ещё нужен** — все правки чисто визуальные, snapshot/applySnapshot не должны измениться.
- **Скрытность енота** ([src/render.js](src/render.js) `drawPlayer`) использует `viewer.character`, `idleT`, `STEALTH_*` — должно работать без правок.

## Полезные команды

```bash
# Запустить локально
cd "/Users/win128/Desktop/AI/Claude Code/svalkus"
python3 -m http.server 8765
# Открыть http://localhost:8765/ в браузере
```

## Имя игры

Игра называется **«Свалкус»**. Переименование уже выполнено в [index.html](index.html) (`<title>`), [README.md](README.md) (заголовок) и [src/main.js](src/main.js) (заголовок главного меню «СВАЛКУС»). Папка — `svalkus/`.

