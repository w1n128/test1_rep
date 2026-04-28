// Все балансные константы в одном месте.
(function () {
  const G = (window.G = window.G || {});

  G.config = {
    TILE: 48,
    ARENA_W: 24,
    ARENA_H: 18,
    get ARENA_PX_W() { return this.ARENA_W * this.TILE; },
    get ARENA_PX_H() { return this.ARENA_H * this.TILE; },

    CANVAS_W: 960,
    CANVAS_H: 720,
    SPLIT_GAP: 4,
    get VIEWPORT_W() { return this.CANVAS_W; },
    get VIEWPORT_H() { return (this.CANVAS_H - this.SPLIT_GAP) / 2; },

    PLAYER_SPEED: 234,
    PLAYER_HITBOX: 30,
    SLIDE_SPEED: 468,

    PLAYER_MAX_HP: 5,
    INVINCIBILITY_AFTER_HIT: 0.8,
    TRAP_LIMIT_PER_PLAYER: 10,

    PICKUP_SPAWN_MIN: 4.0,
    PICKUP_SPAWN_MAX: 6.0,
    PICKUP_LIMIT_ON_MAP: 6,
    INVENTORY_MAX_PER_TYPE: 3,

    TRAP_TYPES: ['mousetrap', 'firecracker', 'trapdoor', 'banana'],
    COMBAT_TYPES: ['branch'],
    get PICKUP_TYPES() { return this.TRAP_TYPES.concat(this.COMBAT_TYPES); },
    get ITEM_TYPES() { return this.TRAP_TYPES.concat(this.COMBAT_TYPES, this.BAIT_TYPES); },
    POWERUP_TYPES: ['star', 'broom', 'boombox'],
    POWERUP_WEIGHTS: { star: 1, broom: 2, boombox: 2 },
    BAIT_TYPES: ['pizza', 'diamond'],
    POWERUP_SPAWN_CHANCE: 0.125,   // star как раньше, broom/boombox в 2 раза чаще
    BAIT_PULL_DURATION: 2.8,
    BAIT_PULL_STRENGTH: 2.4,
    MELEE_EFFECT_TIME: 0.22,
    NIGHT_DAY_DURATION: 120.0,      // сколько длится день перед ночью
    NIGHT_DURATION: 60.0,           // длительность ночи
    FLASHLIGHT_TILES: 3,            // дальность фонарика в тайлах
    STAR_DURATION: 10.0,           // секунды бессмертия
    STAR_SPEED_MUL: 2.0,           // множитель скорости
    STAR_MUSIC_SPEED_MUL: 1.35,    // насколько ускоряется музыка под звездой
    STAR_TOUCH_COOLDOWN: 0.5,      // повторный урон от касания не чаще
    BROOM_HIDDEN: 5.0,             // секунды невидимости
    BROOM_DUST_TILES: 3,           // размер пылевого квадрата
    BROOM_DUST_LIFETIME: 1.5,      // длительность пылевого облака
    BOOMBOX_HEAL_INTERVAL: 2.0,    // каждые сколько секунд +1 HP
    BOOMBOX_HEAL_AMOUNT: 1,
    TRAP_ARM_DELAY: 0.4,
    FIRECRACKER_FUSE: 0.735,
    FIRECRACKER_RADIUS_TILES: 3.0,
    TRAPDOOR_FALL_TIME: 2.0,
    BANANA_THROW_TILES: 3,
    BANANA_LIFETIME: 6.0,
    BANANA_FLIGHT_TIME: 0.32,
    SLIDE_MIN_TIME: 0.55, // минимальное время скольжения, даже если упёрлись в стену
    THROW_ANIM_TIME: 0.3,
    STEALTH_IDLE_TIME: 1.0,    // енот: время бездействия до невидимости
    STEALTH_FADE_TIME: 0.3,    // длительность fade-out

    AI_REACTION_DELAY: 0.2,
    AI_PLACE_TRAP_CHANCE: 0.30,
    AI_PICKUP_RADIUS_TILES: 8,
    AI_THREAT_RADIUS_TILES: 5,
    AI_MISTAKE_CHANCE: 0.20,
    AI_REPATH_INTERVAL: 0.5,
    AI_BAIT_START_DELAY: 12.0,
    AI_BAIT_COOLDOWN: 10.0,
    AI_BAIT_USE_CHANCE: 0.08,
    AI_BAIT_MIN_DISTANCE: 9,
    ARENA_EVENT_MIN: 32.0,
    ARENA_EVENT_MAX: 44.0,
    ARENA_EVENT_DURATION: 6.0,
  };

  G.PALETTE = {
    // Трава: насыщенный зелёный с тёмными пучками
    bg:        '#6aa84a',
    bgDark:    '#4a7a2e',
    bgTuft:    '#2e5a1e',
    // Бетон/стены
    wall:      '#3d2818',
    wallTop:   '#5a3a22',
    // Сетчатый забор: светлый металл + тёмная тень
    fence:     '#cfcfcf',
    fenceDark: '#5a5a5a',
    fencePost: '#2a2a2a',
    // Мусорный бак (тёмный металл)
    bin:       '#3a3a3a',
    binDark:   '#1e1e1e',
    binHi:     '#6a6a6a',
    // Деревянный ящик с X-крепом
    crate:     '#a06a32',
    crateDark: '#5a3818',
    crateLine: '#3a2410',
    // Деревянный поддон
    pallet:    '#caa066',
    palletDark:'#7a4e22',
    // Куст / трава
    bush:      '#3a6a2a',
    bushDark:  '#1e4a16',
    // Бетонная плита (для зон без травы)
    concrete:  '#a8a8a8',
    concreteD: '#787878',
    concreteC: '#454545',
    // Дворник: оранжевая кепка, синий комбинезон, оранжевый жилет со светлыми полосами, тёмно-синие штаны, борода
    cap:       '#e85a1a',
    capDark:   '#a23a0a',
    jacket:    '#3a5aaa',
    jacketDark:'#243878',
    vest:      '#ee6622',
    vestStripe:'#fff0c8',
    pants:     '#243878',
    pantsDark: '#16235a',
    skin:      '#f4c896',
    skinDark:  '#b88858',
    beard:     '#3a2a1a',
    boot:      '#1a1a1a',
    // Енот: серый мех, чёрная маска, белая морда
    raccoon1:  '#8a8a8a',
    raccoon2:  '#4a4a4a',
    raccoonE:  '#f0f0f0',
    raccoonM:  '#1a1a1a',
    raccoonN:  '#202020',
    // Мышеловка
    mousetrap: '#c8853c',
    mtDark:    '#6a3b16',
    mtSpring:  '#f4f4f4',
    mtSprDark: '#7a7a7a',
    cheese:    '#ffd84a',
    // Петарда / динамит
    firework:  '#f04444',
    fireworkD: '#811515',
    fireworkY: '#ffe24a',
    fuseBrown: '#5a3a1a',
    sparkY:    '#fff04a',
    sparkO:    '#ff8822',
    // Люк (manhole)
    trapdoor:  '#59616b',
    trapdoorH: '#20262d',
    trapdoorR: '#9ca8b6',
    // Банан
    banana:    '#ffe04a',
    bananaD:   '#b87912',
    bananaH:   '#fff8b8',
    heart:     '#ee2244',
    heartDark: '#882233',
    text:      '#ffffff',
    textShadow:'#222222',
    hudBg:     '#1a1a1a',
    splitBar:  '#0a0a0a',
    explosion: '#ff8822',
    explosionY:'#ffee44',
    pickupGlow:'#ffee88',
    // Power-ups
    starY:     '#ffe838',
    starO:     '#ff9410',
    starHi:    '#fff8c0',
    broomB:    '#5a9cff',
    broomH:    '#ffd36a',
    broomD:    '#7b4a18',
    boomboxB:  '#29306f',
    boomboxS:  '#77e6ff',
    boomboxA:  '#171a34',
    boomboxK:  '#ff5cc8',
    dust:      '#d4c8a0',
    dustDark:  '#7a6a4a',
  };
})();
