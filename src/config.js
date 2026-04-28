// Все балансные константы в одном месте.
(function () {
  const G = (window.G = window.G || {});

  G.config = {
    TILE: 32,
    ARENA_W: 24,
    ARENA_H: 18,
    get ARENA_PX_W() { return this.ARENA_W * this.TILE; },
    get ARENA_PX_H() { return this.ARENA_H * this.TILE; },

    CANVAS_W: 768,
    CANVAS_H: 608,
    SPLIT_GAP: 4,
    get VIEWPORT_W() { return this.CANVAS_W; },
    get VIEWPORT_H() { return (this.CANVAS_H - this.SPLIT_GAP) / 2; },

    PLAYER_SPEED: 180,
    PLAYER_HITBOX: 20,
    SLIDE_SPEED: 360,

    PLAYER_MAX_HP: 5,
    INVINCIBILITY_AFTER_HIT: 0.8,
    TRAP_LIMIT_PER_PLAYER: 5,

    PICKUP_SPAWN_MIN: 4.0,
    PICKUP_SPAWN_MAX: 6.0,
    PICKUP_LIMIT_ON_MAP: 6,
    INVENTORY_MAX_PER_TYPE: 3,

    TRAP_TYPES: ['mousetrap', 'puddle', 'firecracker', 'trapdoor', 'banana'],
    TRAP_ARM_DELAY: 0.4,
    FIRECRACKER_FUSE: 1.5,
    FIRECRACKER_RADIUS_TILES: 3.0,
    PUDDLE_LIFETIME: 8.0,
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
    mousetrap: '#a07040',
    mtDark:    '#5a3818',
    mtSpring:  '#cccccc',
    mtSprDark: '#7a7a7a',
    cheese:    '#ffcc44',
    // Лужа
    puddle:    '#4a8acc',
    puddleHi:  '#9addff',
    puddleDark:'#2a5a8a',
    // Петарда / динамит
    firework:  '#cc2222',
    fireworkD: '#7a1010',
    fireworkY: '#ffcc22',
    fuseBrown: '#5a3a1a',
    sparkY:    '#fff04a',
    sparkO:    '#ff8822',
    // Люк (manhole)
    trapdoor:  '#3a3a3a',
    trapdoorH: '#1a1a1a',
    trapdoorR: '#5a5a5a',
    // Банан
    banana:    '#f4d836',
    bananaD:   '#a87c10',
    bananaH:   '#fff0a0',
    heart:     '#ee2244',
    heartDark: '#882233',
    text:      '#ffffff',
    textShadow:'#222222',
    hudBg:     '#1a1a1a',
    splitBar:  '#0a0a0a',
    explosion: '#ff8822',
    explosionY:'#ffee44',
    pickupGlow:'#ffee88',
  };
})();
