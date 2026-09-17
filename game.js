(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"),
    high: document.querySelector("#high-score"),
    lives: document.querySelector("#lives"),
    graze: document.querySelector("#graze"),
    power: document.querySelector("#power"),
    bombs: document.querySelector("#bombs"),
    rank: document.querySelector("#rank"),
    style: document.querySelector("#style"),
    difficulty: document.querySelector("#difficulty"),
    simulationMode: document.querySelector("#simulation-mode"),
    fps: document.querySelector("#fps"),
    workload: document.querySelector("#workload"),
    overlay: document.querySelector("#overlay"),
    kicker: document.querySelector("#overlay-kicker"),
    title: document.querySelector("#overlay-title"),
    copy: document.querySelector("#overlay-copy"),
    choices: document.querySelector("#choice-buttons"),
    choiceButtons: document.querySelectorAll("[data-character]"),
    difficultyButtons: document.querySelectorAll("[data-difficulty]"),
    difficultyPanel: document.querySelector("#difficulty-buttons"),
    simulationOption: document.querySelector("#simulation-option"),
    syncSimulation: document.querySelector("#sync-simulation"),
    continueButton: document.querySelector("#continue-button"),
    bossHud: document.querySelector("#boss-hud"),
    bossName: document.querySelector("#boss-name"),
    bossCard: document.querySelector("#boss-card"),
    bossFill: document.querySelector("#boss-fill")
  };

  const W = canvas.width;
  const H = canvas.height;
  // Enough for a readable bullet screen, but bounded for an educational demo.
  // Raise this only after adding object pooling and profiling the renderer.
  const MAX_PLAYER_BULLETS = 96;
  const FIXED_STEP = 1 / 60;
  const MAX_SIMULATION_STEPS = 5;
  const SHIPS = {
    reimu: { label: "A · REIMU", moveSpeed: 245, focusSpeed: 145, bulletSpeed: 1, cooldown: .085, bulletRadius: 5.5, bulletWidth: 7, damage: .68 },
    marisa: { label: "B · MARISA", moveSpeed: 367.5, focusSpeed: 217.5, bulletSpeed: 1.5, cooldown: .085 / 1.5, bulletRadius: 3.5, bulletWidth: 3, damage: 1 }
  };
  const DIFFICULTIES = {
    easy: { label: "EASY", maxBullets: 80, countBonus: -3, size: .82, speed: .88, interval: 1.3, sweepLayers: 1, fanCount: 1 },
    normal: { label: "NORMAL", maxBullets: 128, countBonus: 0, size: 1, speed: 1, interval: 1, sweepLayers: 2, fanCount: 3 },
    hard: { label: "HARD", maxBullets: 170, countBonus: 2, size: 1.18, speed: 1.08, interval: .86, sweepLayers: 3, fanCount: 5 },
    lunatic: { label: "LUNATIC", maxBullets: 220, countBonus: 4, size: 1.42, speed: 1.16, interval: .72, sweepLayers: 4, fanCount: 7 }
  };
  const STAGE_PROFILE = globalThis.STG_STAGE.events;
  const SPELL_CARDS = globalThis.STG_STAGE.spellCards;
  const keys = new Set();
  const stars = Array.from({ length: 95 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.25 + .25,
    speed: Math.random() * 24 + 10,
    phase: Math.random() * Math.PI * 2
  }));

  let state = "menu";
  let lastTime = 0;
  let simulationAccumulator = 0;
  let selectedDifficulty = "normal";
  let difficulty = "normal";
  let frameSyncedSimulation = false;
  let performanceLastFrame = 0;
  let performanceElapsedTime = 0;
  let performanceFrameCount = 0;
  let performanceBusyTime = 0;
  let performanceWorstFrame = 0;
  let performanceMissedFrames = 0;
  let elapsed = 0;
  let stageTime = 0;
  let stageEventIndex = 0;
  let score = 0;
  let graze = 0;
  let lives = 3;
  let power = 0;
  let bombs = 2;
  let bombWave = 0;
  let shownRank = 1;
  let clearGeneration = 0;
  let shake = 0;
  let highScore = Number(localStorage.getItem("starfall-high") || 0);
  let player;
  let boss = null;
  let enemies = [];
  let playerBullets = [];
  let missiles = [];
  let lasers = [];
  let enemyBullets = [];
  let items = [];
  let particles = [];
  let clearWaves = [];
  const pools = {
    enemyBullets: [],
    playerBullets: [],
    missiles: [],
    lasers: [],
    particles: []
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const circlesOverlap = (a, b, radius) => {
    const dx = a.x - b.x;
    if (Math.abs(dx) > radius) return false;
    const dy = a.y - b.y;
    return Math.abs(dy) <= radius && dx * dx + dy * dy < radius * radius;
  };
  const pad = n => Math.floor(n).toString().padStart(7, "0");
  const difficultyRank = () => Math.min(5, 1 + Math.floor(elapsed / 28));

  function activeObjectCount() {
    return enemies.length + playerBullets.length + missiles.length + lasers.length +
      enemyBullets.length + items.length + particles.length + clearWaves.length + (boss ? 1 : 0);
  }

  function updatePerformanceDisplay(frameTimestamp, busyTime) {
    if (!performanceLastFrame) {
      performanceLastFrame = frameTimestamp;
      return;
    }

    const frameInterval = frameTimestamp - performanceLastFrame;
    performanceLastFrame = frameTimestamp;
    performanceElapsedTime += frameInterval;
    performanceFrameCount++;
    performanceBusyTime += busyTime;
    performanceWorstFrame = Math.max(performanceWorstFrame, frameInterval);
    performanceMissedFrames += Math.max(0, Math.round(frameInterval / (1000 / 60)) - 1);
    if (performanceElapsedTime < 500) return;

    const fps = performanceFrameCount * 1000 / performanceElapsedTime;
    const averageFrameTime = performanceElapsedTime / performanceFrameCount;
    const averageBusyTime = performanceBusyTime / performanceFrameCount;
    const workload = Math.min(999, performanceBusyTime / performanceElapsedTime * 100);
    ui.fps.textContent = fps.toFixed(2);
    ui.workload.textContent = `${Math.round(workload)}% · ${activeObjectCount()} obj`;
    ui.workload.title = `${averageBusyTime.toFixed(2)} ms average game-thread time per frame`;
    ui.fps.title = `${averageFrameTime.toFixed(2)} ms average · ${performanceWorstFrame.toFixed(2)} ms worst · ${performanceMissedFrames} estimated missed 60 Hz frames`;

    performanceElapsedTime = 0;
    performanceFrameCount = 0;
    performanceBusyTime = 0;
    performanceWorstFrame = 0;
    performanceMissedFrames = 0;
  }

  function takeFrom(pool) {
    return pool.pop() || {};
  }

  function recycleAll(list, pool) {
    for (const object of list) pool.push(object);
    list.length = 0;
  }

  function compactAndRecycle(list, pool, keep) {
    let write = 0;
    for (let read = 0; read < list.length; read++) {
      const object = list[read];
      if (keep(object)) list[write++] = object;
      else pool.push(object);
    }
    list.length = write;
  }

  function compactInPlace(list, keep) {
    let write = 0;
    for (let read = 0; read < list.length; read++) {
      if (keep(list[read])) list[write++] = list[read];
    }
    list.length = write;
  }

  const activePlayerBullet = bullet => bullet.y > -20;
  const activeLaser = laser => laser.life > 0;
  const activeMissile = missile => !missile.dead && missile.x > -35 && missile.x < W + 35 && missile.y > -50 && missile.y < H + 35;
  const activeEnemyBullet = bullet => bullet.x > -30 && bullet.x < W + 30 && bullet.y > -40 && bullet.y < H + 30;
  const activeParticle = particle => particle.life > 0;
  const activeEnemy = enemy => enemy.hp > 0 && enemy.y < H + 50 && enemy.x > -60 && enemy.x < W + 60;
  const activeItem = item => !item.collected && item.y < H + 25;
  const activeClearWave = wave => wave.life > 0;

  const difficultySettings = () => DIFFICULTIES[difficulty];
  const adjustedBulletCount = (base, minimum = 1) => Math.max(minimum, base + difficultySettings().countBonus);
  const bossFanCount = base => difficulty === "easy" ? 1 : base + difficultySettings().countBonus;

  function emitFan(centerAngle, count, spacing, emit) {
    const middle = (count - 1) / 2;
    for (let index = 0; index < count; index++) emit(centerAngle + (index - middle) * spacing);
  }

  function addPlayerShot(x, y, vx, vy, ship) {
    if (playerBullets.length >= MAX_PLAYER_BULLETS) return;
    playerBullets.push(Object.assign(takeFrom(pools.playerBullets), {
      x, y, vx: vx * ship.bulletSpeed, vy: vy * ship.bulletSpeed,
      r: ship.bulletRadius, width: ship.bulletWidth, damage: ship.damage
    }));
  }

  function resetGame(character, chosenDifficulty = selectedDifficulty) {
    elapsed = stageTime = score = graze = shake = bombWave = 0;
    stageEventIndex = 0;
    boss = null;
    difficulty = chosenDifficulty;
    frameSyncedSimulation = ui.syncSimulation.checked;
    simulationAccumulator = 0;
    ui.bossHud.classList.add("hidden");
    lives = 3;
    power = 0;
    bombs = 2;
    shownRank = 1;
    enemies = [];
    recycleAll(playerBullets, pools.playerBullets);
    recycleAll(missiles, pools.missiles);
    recycleAll(lasers, pools.lasers);
    recycleAll(enemyBullets, pools.enemyBullets);
    items = [];
    recycleAll(particles, pools.particles);
    clearWaves = [];
    player = { x: W / 2, y: H - 90, r: 3.5, cooldown: 0, specialCooldown: 0, missileSide: 1, invincible: 1.5, character };
    state = "playing";
    ui.overlay.classList.add("hidden");
    syncUI();
  }

  function syncUI() {
    ui.score.textContent = pad(score);
    ui.high.textContent = pad(Math.max(score, highScore));
    ui.lives.textContent = lives > 0 ? Array(lives).fill("◆").join(" ") : "—";
    ui.lives.setAttribute("aria-label", `${lives} lives`);
    ui.graze.textContent = String(graze).padStart(3, "0");
    ui.power.textContent = power >= 100 ? "P MAX" : `P ${(power / 25).toFixed(2)}`;
    ui.bombs.textContent = bombs > 0 ? Array(bombs).fill("●").join(" ") : "—";
    ui.rank.textContent = ["Ⅰ", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"][difficultyRank()];
    ui.style.textContent = player ? SHIPS[player.character].label : "—";
    ui.difficulty.textContent = DIFFICULTIES[difficulty].label;
    ui.simulationMode.textContent = frameSyncedSimulation ? "FPS SYNC" : "FIXED 60 HZ";
  }

  function spawnEnemy(forcedType, x = 45 + Math.random() * (W - 90), y = -28) {
    const difficulty = Math.min(1, elapsed / 75);
    const typeRoll = Math.random();
    const type = forcedType || (typeRoll < .54 ? "drifter" : typeRoll < .86 ? "swooper" : "caster");
    const hp = type === "caster" ? 16 : type === "swooper" ? 7 : 5;
    enemies.push({
      x, y, r: type === "caster" ? 17 : 13,
      hp, maxHp: hp, type, age: 0, shot: .45 + Math.random() * .8,
      speed: (type === "caster" ? 44 : 70) + difficulty * 16,
      seed: Math.random() * 10, volley: 0, value: hp * 120
    });
  }

  function spawnMixedGroup(count) {
    const spacing = W / (count + 1);
    for (let i = 0; i < count; i++) {
      const type = i % 3 === 2 ? "caster" : i % 2 ? "swooper" : "drifter";
      spawnEnemy(type, spacing * (i + 1), -28 - i * 14);
    }
  }

  function spawnSwarm(count = 6, shape = "v") {
    const rank = difficultyRank();
    const spacing = 34;
    const halfWidth = ((count - 1) / 2) * spacing;
    const minCenter = 24 + halfWidth;
    const maxCenter = W - 24 - halfWidth;
    const center = minCenter + Math.random() * (maxCenter - minCenter);
    for (let i = 0; i < count; i++) {
      const column = i - (count - 1) / 2;
      const hp = .6;
      enemies.push({
        x: clamp(center + column * spacing, 24, W - 24),
        y: -28 - (shape === "v" ? Math.abs(column) * 16 : (i % 2) * 9),
        r: 13,
        hp,
        maxHp: hp,
        type: "swarm",
        age: 0,
        shot: 1.2 + i * .16,
        speed: 88 + rank * 4,
        seed: i * .7 + Math.random(),
        volley: 0,
        value: 180
      });
    }
  }

  function shootEnemy(enemy) {
    const settings = difficultySettings();
    if (enemyBullets.length >= settings.maxBullets) return;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const speed = 105 + Math.min(45, elapsed * .5);
    const rank = difficultyRank();
    enemy.volley++;
    const addBullet = (shotAngle, shotSpeed, kind) => {
      if (enemyBullets.length < settings.maxBullets) {
        enemyBullets.push(makeEnemyBullet(enemy.x, enemy.y, shotAngle, shotSpeed, kind));
      }
    };
    if (enemy.type === "caster") {
      // A slow radial ring creates a small bullet screen without flooding it.
      const count = adjustedBulletCount(4 + rank, 3);
      const bulletType = enemy.volley % 2 ? "orb" : "star";
      for (let i = 0; i < count; i++) {
        addBullet((Math.PI * 2 * i / count) + enemy.age * .45, speed * .72, bulletType);
      }
      enemy.shot = Math.max(1.55, 2.45 - rank * .12) * settings.interval;
    } else if (enemy.type === "swooper") {
      const count = difficulty === "normal" && rank < 2 ? 1 : settings.fanCount;
      emitFan(angle, count, .18, shotAngle => addBullet(shotAngle, speed, "shard"));
      enemy.shot = Math.max(1.25, 2.05 - rank * .12) * settings.interval;
    } else {
      const bulletType = rank >= 3 && enemy.volley % 2 === 0 ? "rice" : "orb";
      const count = difficulty === "easy" ? 1 : difficulty === "normal" ? (rank >= 4 ? 2 : 1) : difficulty === "hard" ? 3 : 5;
      emitFan(angle, count, .16, shotAngle => addBullet(shotAngle, speed, bulletType));
      enemy.shot = (Math.max(1.4, 2.2 - rank * .1) + Math.random() * .35) * settings.interval;
    }
  }

  function makeEnemyBullet(x, y, angle, speed, kind) {
    const radii = { orb: 5, shard: 5, rice: 4.5, star: 5.5, bossSmall: 3.5, bossMedium: 7, bossLarge: 11 };
    const settings = difficultySettings();
    return Object.assign(takeFrom(pools.enemyBullets), {
      x, y, vx: Math.cos(angle) * speed * settings.speed, vy: Math.sin(angle) * speed * settings.speed,
      r: (radii[kind] || 5) * settings.size, kind, grazed: false
    });
  }

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 24;
      particles.push(Object.assign(takeFrom(pools.particles), {
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: .35 + Math.random() * .45, max: .8, color, size: Math.random() * 3 + 1
      }));
    }
  }

  function dropLoot(enemy) {
    const roll = Math.random();
    let kind;
    if (enemy.type === "caster") kind = roll < .62 ? "power" : "point";
    else if (enemy.type === "swarm") {
      if (roll < .03) kind = "power";
      else if (roll < .43) kind = "point";
      else return;
    }
    else if (roll < .12) kind = "power";
    else if (roll < .78) kind = "point";
    else return;

    items.push({
      x: enemy.x,
      y: enemy.y,
      vx: (Math.random() - .5) * 38,
      vy: -115 - Math.random() * 35,
      age: 0,
      kind,
      value: kind === "power" ? (enemy.type === "caster" ? 15 : 8) : 300,
      collectAfter: .12,
      recovered: false
    });
  }

  function collectItem(item, topBonus = false) {
    if (item.collected) return;
    item.collected = true;
    if (item.kind === "power") {
      if (power < 100) power = Math.min(100, power + item.value);
      else score += 500;
      if (!item.recovered) score += 100;
      burst(item.x, item.y, "#ef596b", 7);
    } else {
      score += item.value + (topBonus ? 200 : 0);
      burst(item.x, item.y, "#64c8ff", 7);
    }
  }

  function scatterLostPower(x, y, amount) {
    if (amount <= 0) return;
    const count = Math.min(4, Math.ceil(amount / 8));
    let remaining = amount;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI + ((i + 1) / (count + 1)) * Math.PI;
      const speed = 130 + Math.random() * 35;
      const value = Math.ceil(remaining / (count - i));
      remaining -= value;
      items.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        age: 0,
        kind: "power",
        value,
        collectAfter: .65,
        recovered: true
      });
    }
  }

  function defeatEnemy(enemy, color) {
    if (enemy.rewarded) return;
    enemy.rewarded = true;
    score += enemy.value;
    dropLoot(enemy);
    burst(enemy.x, enemy.y, color || (enemy.type === "caster" ? "#d5a8ff" : "#f0bd6a"), 18);
    syncUI();
  }

  function globalClear(keepLivingBoss = true) {
    clearGeneration++;
    const originX = boss ? boss.x : W / 2;
    const originY = boss ? boss.y : H * .28;
    clearWaves.push({ x: originX, y: originY, life: .8, maxLife: .8 });

    for (const bullet of enemyBullets) {
      const color = bullet.kind === "bossLarge" ? "#ff8b69" : bullet.kind === "bossMedium" ? "#d98cff" : "#8ee8ff";
      burst(bullet.x, bullet.y, color, bullet.r >= 10 ? 6 : 3);
    }
    for (const bullet of playerBullets) burst(bullet.x, bullet.y, "#bcefff", 2);
    for (const missile of missiles) burst(missile.x, missile.y, "#ffad63", 6);
    for (const enemy of enemies) {
      burst(enemy.x, enemy.y, enemy.type === "caster" ? "#d5a8ff" : "#f07882", enemy.type === "swarm" ? 11 : 18);
    }
    if (boss) {
      const bossDefeated = !keepLivingBoss;
      burst(boss.x, boss.y, bossDefeated ? "#fff0a6" : "#dc9cff", bossDefeated ? 64 : 30);
    }

    score += enemyBullets.length * 5;
    recycleAll(enemyBullets, pools.enemyBullets);
    recycleAll(playerBullets, pools.playerBullets);
    recycleAll(missiles, pools.missiles);
    recycleAll(lasers, pools.lasers);
    enemies = [];
    for (const item of items) collectItem(item, true);
    items = [];
    if (!keepLivingBoss) boss = null;
    if (!boss) ui.bossHud.classList.add("hidden");
    syncUI();
  }

  function updateBossHud() {
    if (!boss) return;
    const specialtyGuard = boss.hp / boss.maxHp <= .2;
    ui.bossName.textContent = globalThis.STG_STAGE.bossName;
    const phaseName = boss.mode === "initial" ? "Initial encounter" : `Spell ${boss.cardIndex + 1} · ${SPELL_CARDS[boss.cardIndex].name}`;
    ui.bossCard.textContent = specialtyGuard ? `${phaseName} · Specialty guard` : phaseName;
    ui.bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
    ui.bossFill.style.background = specialtyGuard ? "linear-gradient(90deg, #7350a2, #9eeaff)" : "linear-gradient(90deg, #eb4d5c, #e5bd6b)";
    ui.bossHud.classList.remove("hidden");
  }

  function startBoss(encounter) {
    globalClear(false);
    const cardIndex = encounter === "final" ? 0 : -1;
    const maxHp = encounter === "final" ? SPELL_CARDS[0].hp : globalThis.STG_STAGE.initialBossHp;
    boss = {
      x: W / 2, y: -48, targetY: 112, r: 27,
      hp: maxHp, maxHp, mode: encounter, cardIndex,
      age: 0, patternClock: .8, secondaryClock: 1.5, volley: 0,
      entering: true
    };
    updateBossHud();
  }

  function finishStage() {
    state = "stageclear";
    highScore = Math.max(highScore, score);
    localStorage.setItem("starfall-high", highScore);
    ui.kicker.textContent = "The spellstorm is quiet";
    ui.title.textContent = "Stage clear";
    ui.copy.innerHTML = `Final score: ${pad(score)} · Graze: ${graze}<br>Choose a style to fly again.`;
    ui.choices.classList.remove("hidden");
    ui.difficultyPanel.classList.remove("hidden");
    ui.simulationOption.classList.remove("hidden");
    ui.continueButton.classList.add("hidden");
    ui.overlay.classList.remove("hidden");
  }

  function clearBossPhase() {
    if (!boss) return;
    score += boss.mode === "initial" ? 5000 : 10000;
    if (boss.mode === "initial") {
      boss.hp = 0;
      globalClear(false);
      return;
    }

    const nextCard = boss.cardIndex + 1;
    if (nextCard >= SPELL_CARDS.length) {
      boss.hp = 0;
      globalClear(false);
      finishStage();
      return;
    }
    globalClear(true);
    boss.cardIndex = nextCard;
    const card = SPELL_CARDS[boss.cardIndex];
    boss.hp = boss.maxHp = card.hp;
    boss.age = 0;
    boss.patternClock = .9;
    boss.secondaryClock = 1.4;
    boss.volley = 0;
    boss.entering = false;
    updateBossHud();
  }

  function damageBoss(amount, source = "normal") {
    if (!boss || boss.hp <= 0 || boss.entering) return;
    if (source === "special" && boss.hp / boss.maxHp <= .2) amount *= .25;
    boss.hp -= amount;
    updateBossHud();
    if (boss.hp <= 0) clearBossPhase();
  }

  function addBossBullet(angle, speed, kind) {
    if (!boss || enemyBullets.length >= difficultySettings().maxBullets) return;
    enemyBullets.push(makeEnemyBullet(boss.x, boss.y + 12, angle, speed, kind));
  }

  function aimedAtPlayer() {
    return Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  function updateBossPattern(dt) {
    boss.patternClock -= dt;
    boss.secondaryClock -= dt;
    if (boss.mode === "initial") {
      if (boss.patternClock > 0) return;
      const settings = difficultySettings();
      const pattern = boss.volley++ % 3;
      if (pattern === 0) {
        const count = adjustedBulletCount(12, 6);
        for (let i = 0; i < count; i++) addBossBullet(i * Math.PI * 2 / count + boss.age * .18, 100, "bossSmall");
      } else if (pattern === 1) {
        const aimed = aimedAtPlayer();
        emitFan(aimed, bossFanCount(5), .17, angle => addBossBullet(angle, 125, "bossMedium"));
      } else {
        const aimed = aimedAtPlayer();
        emitFan(aimed, bossFanCount(3), .3, angle => addBossBullet(angle, 76, "bossLarge"));
      }
      boss.patternClock = .82 * settings.interval;
      return;
    }

    const card = boss.cardIndex;
    if (card === 0 && boss.patternClock <= 0) {
      const count = adjustedBulletCount(15, 9);
      const offset = boss.volley++ * .13;
      for (let i = 0; i < count; i++) {
        if ((i + boss.volley) % count === 0 || (i + boss.volley) % count === 1) continue;
        addBossBullet(i * Math.PI * 2 / count + offset, 92 + (i % 2) * 18, "bossMedium");
      }
      boss.patternClock = .7 * difficultySettings().interval;
    } else if (card === 1 && boss.patternClock <= 0) {
      const sweep = Math.sin(boss.age * 1.7) * .82;
      const layers = difficultySettings().sweepLayers;
      const layerFactors = [1, .55, .78, .32];
      for (let layer = 0; layer < layers; layer++) {
        const factor = layerFactors[layer];
        const kind = layer % 2 ? "star" : "bossSmall";
        const speed = 150 - layer * 16;
        addBossBullet(Math.PI / 2 + sweep * factor, speed, kind);
        addBossBullet(Math.PI / 2 - sweep * factor, speed, kind);
      }
      boss.patternClock = .2 * difficultySettings().interval;
    } else if (card === 2 && boss.patternClock <= 0) {
      const count = adjustedBulletCount(9, 5);
      const offset = boss.volley++ * .17;
      const aim = aimedAtPlayer();
      let gap = Math.round((aim - offset) / (Math.PI * 2 / count));
      gap = ((gap % count) + count) % count;
      for (let i = 0; i < count; i++) {
        if (i === gap || i === (gap + 1) % count) continue;
        addBossBullet(i * Math.PI * 2 / count + offset, 72, "bossLarge");
      }
      boss.patternClock = .62 * difficultySettings().interval;
    }

    if (boss.secondaryClock <= 0) {
      const aimed = aimedAtPlayer();
      const count = card === 2 ? bossFanCount(5) : difficultySettings().fanCount;
      emitFan(aimed, count, card === 2 ? .21 : .24, angle => addBossBullet(angle, card === 2 ? 138 : 128, card === 0 ? "bossSmall" : "bossMedium"));
      boss.secondaryClock = (card === 1 ? 1.7 : 2.1) * difficultySettings().interval;
    }
  }

  function updateBoss(dt) {
    if (!boss) return;
    if (boss.entering) {
      boss.y += 92 * dt;
      if (boss.y >= boss.targetY) {
        boss.y = boss.targetY;
        boss.entering = false;
        boss.age = 0;
      }
      return;
    }
    boss.age += dt;
    const range = boss.mode === "initial" ? 62 : 105;
    boss.x = W / 2 + Math.sin(boss.age * (boss.mode === "initial" ? .75 : .52)) * range;
    updateBossPattern(dt);
    if (player.invincible <= 0 && circlesOverlap(boss, player, boss.r + player.r)) hitPlayer();
  }

  function updateStage(dt) {
    if (!boss) stageTime += dt;
    const event = STAGE_PROFILE[stageEventIndex];
    if (!event || stageTime < event.at || boss) return;
    stageEventIndex++;
    if (event.type === "formation") spawnSwarm(event.count, event.shape);
    else if (event.type === "mixed") spawnMixedGroup(event.count);
    else if (event.type === "boss") startBoss(event.encounter);
  }

  function nearestEnemy(x, y) {
    let target = null;
    let bestDistance = Infinity;
    if (boss && boss.hp > 0 && !boss.entering) {
      target = boss;
      bestDistance = (boss.x - x) ** 2 + (boss.y - y) ** 2;
    }
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        target = enemy;
      }
    }
    return target;
  }

  function launchReimuMissiles(tier) {
    const initialTarget = nearestEnemy(player.x, player.y);
    if (!initialTarget) return;
    const count = tier >= 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const side = count === 2 ? (i ? 1 : -1) : player.missileSide;
      missiles.push(Object.assign(takeFrom(pools.missiles), {
        x: player.x + side * 13,
        y: player.y - 5,
        vx: side * 55,
        vy: -250,
        speed: 285 + tier * 14,
        turnSpeed: 5.5,
        r: 5,
        damage: 1.4 + tier * .35,
        target: initialTarget,
        distance: 0,
        maxDistance: H * .62,
        dead: false
      }));
      player.missileSide *= -1;
    }
  }

  function emitMarisaLasers(tier) {
    const offsets = tier >= 3 ? [-10, 10] : [0];
    const width = 3.5 + tier * .7;
    const laserDamage = .1 + tier * .035;
    for (const offset of offsets) {
      const x = player.x + offset;
      lasers.push(Object.assign(takeFrom(pools.lasers), { x, y: player.y - 12, width, life: .14, maxLife: .14 }));
      for (const enemy of enemies) {
        if (enemy.hp > 0 && enemy.y < player.y && Math.abs(enemy.x - x) < enemy.r + width) {
          enemy.hp -= laserDamage;
          if (enemy.hp <= 0) defeatEnemy(enemy, "#f5d681");
        }
      }
      if (boss && !boss.entering && Math.abs(boss.x - x) < boss.r + width) {
        const generation = clearGeneration;
        damageBoss(laserDamage, "special");
        if (generation !== clearGeneration) return;
      }
    }
  }

  function useBomb() {
    if (state !== "playing" || bombs <= 0 || bombWave > 0) return;
    bombs--;
    bombWave = 1;
    player.invincible = 1.6;
    shake = 8;
    for (const bullet of enemyBullets) burst(bullet.x, bullet.y, "#8ceaff", 2);
    score += enemyBullets.length * 5;
    recycleAll(enemyBullets, pools.enemyBullets);
    for (const enemy of enemies) enemy.hp -= 5;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) defeatEnemy(enemy, "#f5d681");
    }
    if (boss && !boss.entering) damageBoss(5);
    burst(player.x, player.y, "#f5d681", 34);
    syncUI();
  }

  function hitPlayer(clearEnemyShots = true) {
    if (player.invincible > 0) return;
    lives--;
    const lostPower = Math.min(power, 25);
    power -= lostPower;
    if (lives > 0) scatterLostPower(player.x, player.y, lostPower);
    bombs = 2;
    shake = 12;
    burst(player.x, player.y, "#f04f64", 28);
    if (clearEnemyShots) recycleAll(enemyBullets, pools.enemyBullets);
    recycleAll(playerBullets, pools.playerBullets);
    recycleAll(missiles, pools.missiles);
    recycleAll(lasers, pools.lasers);
    if (lives <= 0) {
      highScore = Math.max(highScore, score);
      localStorage.setItem("starfall-high", highScore);
      state = "gameover";
      ui.kicker.textContent = "The spellstorm prevailed";
      ui.title.textContent = "Flight ended";
      ui.copy.innerHTML = `Final score: ${pad(score)} · Graze: ${graze}<br>Choose a style for the next flight.`;
      ui.choices.classList.remove("hidden");
      ui.difficultyPanel.classList.remove("hidden");
      ui.simulationOption.classList.remove("hidden");
      ui.continueButton.classList.add("hidden");
      ui.bossHud.classList.add("hidden");
      ui.overlay.classList.remove("hidden");
    } else {
      player.x = W / 2;
      player.y = H - 90;
      player.invincible = 2.2;
    }
    syncUI();
  }

  function update(dt) {
    elapsed += dt;
    if (difficultyRank() !== shownRank) {
      shownRank = difficultyRank();
      syncUI();
    }
    shake = Math.max(0, shake - dt * 35);
    const focused = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const ship = SHIPS[player.character];
    const speed = focused ? ship.focusSpeed : ship.moveSpeed;
    let dx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    let dy = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    if (dx && dy) { dx *= .707; dy *= .707; }
    player.x = clamp(player.x + dx * speed * dt, 15, W - 15);
    player.y = clamp(player.y + dy * speed * dt, 25, H - 20);
    player.invincible = Math.max(0, player.invincible - dt);
    player.cooldown -= dt;
    player.specialCooldown -= dt;
    bombWave = Math.max(0, bombWave - dt);

    const powerTier = Math.floor(power / 25);
    const firing = keys.has("KeyZ") || keys.has("KeyJ");
    if (firing && player.cooldown <= 0) {
      if (playerBullets.length < MAX_PLAYER_BULLETS) {
        addPlayerShot(player.x - 6, player.y - 14, 0, -520, ship);
        addPlayerShot(player.x + 6, player.y - 14, 0, -520, ship);
        if (powerTier >= 1) {
          addPlayerShot(player.x - 14, player.y - 9, -22, -500, ship);
          addPlayerShot(player.x + 14, player.y - 9, 22, -500, ship);
        }
        if (powerTier >= 3) addPlayerShot(player.x, player.y - 19, 0, -560, ship);
      }
      player.cooldown = ship.cooldown;
    }

    if (firing && powerTier > 0 && player.specialCooldown <= 0) {
      if (player.character === "reimu") {
        launchReimuMissiles(powerTier);
        player.specialCooldown = Math.max(.28, .62 - powerTier * .08);
      } else {
        emitMarisaLasers(powerTier);
        player.specialCooldown = Math.max(.12, .25 - powerTier * .025);
      }
    }

    updateStage(dt);
    updateBoss(dt);

    for (const b of playerBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    compactAndRecycle(playerBullets, pools.playerBullets, activePlayerBullet);
    for (const laser of lasers) laser.life -= dt;
    compactAndRecycle(lasers, pools.lasers, activeLaser);

    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      enemy.age += dt;
      enemy.shot -= dt;
      if (enemy.type === "swooper") enemy.x += Math.sin(enemy.age * 2.8 + enemy.seed) * 90 * dt;
      else enemy.x += Math.sin(enemy.age * 1.5 + enemy.seed) * 28 * dt;
      enemy.y += enemy.speed * dt;
      const swarmCanShoot = difficulty !== "easy" || enemy.type !== "swarm";
      if (swarmCanShoot && enemy.shot <= 0 && enemy.y > 35 && enemy.y < H * .72) shootEnemy(enemy);

      // Enemy bodies are hazardous too. Use the player's deliberately small
      // hitbox so focused movement remains precise and predictable.
      if (enemy.hp > 0 && player.invincible <= 0 && circlesOverlap(enemy, player, enemy.r + player.r)) {
        enemy.hp = 0;
        burst(enemy.x, enemy.y, "#f04f64", 20);
        hitPlayer();
      }
    }

    const missileGeneration = clearGeneration;
    for (const missile of missiles) {
      if (missileGeneration !== clearGeneration) break;
      if (!missile.target || missile.target.hp <= 0) {
        missile.target = nearestEnemy(missile.x, missile.y);
        if (!missile.target) {
          missile.dead = true;
          continue;
        }
      }
      const currentAngle = Math.atan2(missile.vy, missile.vx);
      const desiredAngle = Math.atan2(missile.target.y - missile.y, missile.target.x - missile.x);
      const difference = Math.atan2(Math.sin(desiredAngle - currentAngle), Math.cos(desiredAngle - currentAngle));
      const angle = currentAngle + clamp(difference, -missile.turnSpeed * dt, missile.turnSpeed * dt);
      missile.vx = Math.cos(angle) * missile.speed;
      missile.vy = Math.sin(angle) * missile.speed;
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;
      missile.distance += missile.speed * dt;
      if (missile.distance >= missile.maxDistance) {
        missile.dead = true;
        continue;
      }

      if (boss && !boss.entering && circlesOverlap(missile, boss, missile.r + boss.r)) {
        missile.dead = true;
        burst(missile.x, missile.y, "#ffb46b", 7);
        damageBoss(missile.damage, "special");
        continue;
      }

      for (const enemy of enemies) {
        if (enemy.hp > 0 && circlesOverlap(missile, enemy, missile.r + enemy.r)) {
          enemy.hp -= missile.damage;
          missile.dead = true;
          burst(missile.x, missile.y, "#ffb46b", 7);
          if (enemy.hp <= 0) defeatEnemy(enemy, "#ffb46b");
          break;
        }
      }
    }
    compactAndRecycle(missiles, pools.missiles, activeMissile);

    const bulletGeneration = clearGeneration;
    for (const bullet of playerBullets) {
      if (bulletGeneration !== clearGeneration) break;
      if (boss && !boss.entering && circlesOverlap(bullet, boss, boss.r + bullet.r)) {
        bullet.y = -100;
        damageBoss(bullet.damage);
        continue;
      }
      for (const enemy of enemies) {
        if (enemy.hp > 0 && circlesOverlap(bullet, enemy, enemy.r + bullet.r)) {
          bullet.y = -100;
          enemy.hp -= bullet.damage;
          if (enemy.hp <= 0) defeatEnemy(enemy);
          break;
        }
      }
    }
    compactInPlace(enemies, activeEnemy);
    compactAndRecycle(playerBullets, pools.playerBullets, activePlayerBullet);

    let grazedThisFrame = false;
    let struckByBullet = false;
    const canHitPlayer = player.invincible <= 0;
    for (const b of enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!canHitPlayer) continue;

      const dx = b.x - player.x;
      const dy = b.y - player.y;
      if (Math.abs(dx) > 24 || Math.abs(dy) > 24) continue;
      const distanceSquared = dx * dx + dy * dy;
      const hitRadius = player.r + b.r;
      if (distanceSquared < hitRadius * hitRadius) {
        struckByBullet = true;
        break;
      }
      if (!b.grazed && distanceSquared < 24 * 24) {
        b.grazed = true;
        graze++;
        score += 25;
        grazedThisFrame = true;
      }
    }
    if (struckByBullet) {
      hitPlayer(false);
      recycleAll(enemyBullets, pools.enemyBullets);
    } else {
      compactAndRecycle(enemyBullets, pools.enemyBullets, activeEnemyBullet);
      if (grazedThisFrame) syncUI();
    }

    for (const item of items) {
      item.age += dt;
      const distance = Math.sqrt(dist2(item, player));
      // Preserve the arcade-style pop before any item begins homing.
      if (item.age > .38 && (distance < 105 || player.y < 115)) {
        const angle = Math.atan2(player.y - item.y, player.x - item.x);
        item.x += Math.cos(angle) * 270 * dt;
        item.y += Math.sin(angle) * 270 * dt;
      } else {
        item.vy = Math.min(92, item.vy + 210 * dt);
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.vx *= Math.pow(.35, dt);
      }
      if (distance < 17 && item.age >= item.collectAfter) {
        collectItem(item, player.y < 115);
        syncUI();
      }
    }
    compactInPlace(items, activeItem);

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt;
    }
    compactAndRecycle(particles, pools.particles, activeParticle);
    for (const wave of clearWaves) wave.life -= dt;
    compactInPlace(clearWaves, activeClearWave);
  }

  function drawBackground(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#100921"); grad.addColorStop(.52, "#17102b"); grad.addColorStop(1, "#090914");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(179,134,211,.07)"; ctx.lineWidth = 1;
    for (let y = (time * 12) % 80 - 80; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 140); ctx.stroke(); }
    for (const s of stars) {
      const y = (s.y + time * s.speed) % H;
      ctx.globalAlpha = .35 + Math.sin(time * 2 + s.phase) * .2;
      ctx.fillStyle = "#f5e9cf"; ctx.fillRect(s.x, y, s.r, s.r * 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(230,205,255,.05)";
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(60 + i * 112, 130 + Math.sin(i) * 40, 55, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawPlayer(focused) {
    const blink = player.invincible > 0 && Math.floor(player.invincible * 12) % 2;
    if (blink) return;
    ctx.save(); ctx.translate(player.x, player.y);
    ctx.shadowColor = "#f13e62"; ctx.shadowBlur = 18;
    const isMarisa = player.character === "marisa";
    ctx.fillStyle = isMarisa ? "#fff4cf" : "#f5ead8";
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = isMarisa ? "#3d2c52" : "#e3445a";
    ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(-18, -2); ctx.lineTo(-8, 7); ctx.lineTo(-14, 17); ctx.lineTo(0, 10); ctx.lineTo(14, 17); ctx.lineTo(8, 7); ctx.lineTo(18, -2); ctx.lineTo(5, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f2c769"; ctx.fillRect(-2, -18, 4, 25);
    if (isMarisa) {
      ctx.fillStyle = "#f5d36f";
      ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.lineTo(7, -15); ctx.lineTo(-6, -17); ctx.closePath(); ctx.fill();
    }
    if (focused) {
      ctx.shadowBlur = 9; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(240,199,105,.65)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(e.age * 2 + e.seed) * .16);
    ctx.shadowColor = e.type === "caster" ? "#a970e8" : "#ed5c70"; ctx.shadowBlur = 15;
    ctx.fillStyle = e.type === "caster" ? "#8c62bc" : "#d94c67";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r = i % 2 ? e.r * .64 : e.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f2e8dc"; ctx.beginPath(); ctx.arc(0, 0, e.r * .36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#25152f"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (e.maxHp > 10 && e.hp < e.maxHp) { ctx.fillStyle = "#382541"; ctx.fillRect(e.x - 18, e.y + 23, 36, 3); ctx.fillStyle = "#e96275"; ctx.fillRect(e.x - 18, e.y + 23, 36 * e.hp / e.maxHp, 3); }
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save(); ctx.translate(boss.x, boss.y);
    ctx.globalAlpha = boss.entering ? clamp((boss.y + 48) / 120, 0, 1) : 1;
    ctx.rotate(boss.age * .18);
    ctx.strokeStyle = "rgba(226, 190, 255, .38)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(boss.age * 2) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = "#b36fe0"; ctx.shadowBlur = 22;
    ctx.fillStyle = "#6f3f91"; ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const radius = i % 2 ? 19 : 29;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath(); ctx.fill();
    ctx.rotate(-boss.age * .36);
    ctx.fillStyle = "#e95d82"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "white"; ctx.shadowBlur = 8; ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#281432"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(time) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    drawBackground(time);
    ctx.globalCompositeOperation = "lighter";
    for (const laser of lasers) {
      const alpha = laser.life / laser.maxLife;
      const beam = ctx.createLinearGradient(laser.x, laser.y, laser.x, 0);
      beam.addColorStop(0, `rgba(255, 220, 92, ${alpha})`);
      beam.addColorStop(1, `rgba(255, 171, 45, ${alpha * .16})`);
      ctx.strokeStyle = beam; ctx.lineWidth = laser.width * 2.4; ctx.shadowColor = "#ffc64f"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(laser.x, 0); ctx.stroke();
      ctx.strokeStyle = `rgba(255, 244, 157, ${alpha})`; ctx.lineWidth = Math.max(1.5, laser.width * .55);
      ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(laser.x, 0); ctx.stroke();
    }
    for (const b of playerBullets) {
      const isWide = b.width > 3;
      ctx.shadowColor = isWide ? "#ff91ac" : "#7fe7ff"; ctx.shadowBlur = 9;
      ctx.fillStyle = isWide ? "#ffd8e3" : "#d7fbff";
      ctx.fillRect(b.x - b.width / 2, b.y - 10, b.width, 16);
    }
    for (const missile of missiles) {
      const angle = Math.atan2(missile.vy, missile.vx) + Math.PI / 2;
      ctx.save(); ctx.translate(missile.x, missile.y); ctx.rotate(angle);
      ctx.shadowColor = "#ff875f"; ctx.shadowBlur = 9;
      ctx.fillStyle = "#ffb45f"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 5); ctx.lineTo(0, 3); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ef5365"; ctx.fillRect(-2, 3, 4, 5);
      ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
    for (const e of enemies) drawEnemy(e);
    drawBoss();
    for (const item of items) {
      const bob = Math.sin(item.age * 7) * 2;
      ctx.save(); ctx.translate(item.x, item.y + bob);
      if (item.kind === "power") {
        // Collectibles are always upright squares and never have white cores.
        ctx.shadowColor = "#f05269"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#f3b5be"; ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = "#b92f4a"; ctx.fillRect(-7, -7, 14, 14);
        ctx.shadowBlur = 0; ctx.fillStyle = "white"; ctx.font = "bold 11px Georgia, serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("P", 0, 1);
      } else {
        // Point items are axis-aligned, so blue shards remain unmistakably hostile.
        ctx.shadowColor = "#54c8ff"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#82d8f7"; ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = "#176ba7"; ctx.fillRect(-7, -7, 14, 14);
        ctx.shadowBlur = 0; ctx.strokeStyle = "#5bbde6"; ctx.lineWidth = 1;
        ctx.strokeRect(-4, -4, 8, 8);
      }
      ctx.restore();
    }
    for (const b of enemyBullets) {
      ctx.save(); ctx.translate(b.x, b.y);
      const travelAngle = Math.atan2(b.vy, b.vx);
      if (b.kind === "shard") {
        ctx.rotate(travelAngle + Math.PI / 4);
        ctx.shadowBlur = 0; ctx.fillStyle = "#91e7ff";
        ctx.fillRect(-4, -4, 8, 8);
      } else if (b.kind === "rice") {
        ctx.rotate(travelAngle + Math.PI / 2);
        ctx.shadowBlur = 0; ctx.fillStyle = "#ffe28f";
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === "star") {
        ctx.rotate(b.x * .025 + b.y * .012);
        ctx.shadowBlur = 0; ctx.fillStyle = "#c9a5ff";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 2.5 : 5.5;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      } else if (b.kind === "bossSmall") {
        ctx.shadowBlur = 0; ctx.fillStyle = "#4bbde8";
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === "bossMedium") {
        ctx.shadowBlur = 0; ctx.fillStyle = "#a957d0";
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#efb1ff"; ctx.lineWidth = 1; ctx.stroke();
      } else if (b.kind === "bossLarge") {
        ctx.shadowBlur = 0; ctx.fillStyle = "#a52f54";
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ffb561"; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.shadowBlur = 0; ctx.fillStyle = "#ff6d92";
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      }
      // The centered white core is the universal visual language for danger.
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1.9, b.r * .4), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const wave of clearWaves) {
      const progress = 1 - wave.life / wave.maxLife;
      const alpha = Math.sin(progress * Math.PI) * .7;
      const radius = progress * 620;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 239, 177, ${alpha})`;
      ctx.shadowColor = "#eeb3ff"; ctx.shadowBlur = 18;
      ctx.lineWidth = 10 * (1 - progress) + 2;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(208, 158, 255, ${alpha * .55})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, Math.max(0, radius - 18), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    if (bombWave > 0 && player) {
      const radius = (1 - bombWave) * 540;
      ctx.strokeStyle = `rgba(142, 235, 255, ${bombWave * .75})`;
      ctx.lineWidth = 8 + bombWave * 12;
      ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, Math.PI * 2); ctx.stroke();
    }
    if (player) drawPlayer(keys.has("ShiftLeft") || keys.has("ShiftRight"));
    ctx.fillStyle = "rgba(235,77,92,.7)"; ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(W - 2, 0, 2, H);
    ctx.restore();
  }

  function loop(ms) {
    const workStartedAt = performance.now();
    const now = ms / 1000;
    const frameDelta = Math.min(.25, now - lastTime || 0);
    lastTime = now;
    if (state === "playing") {
      if (frameSyncedSimulation) {
        update(FIXED_STEP);
      } else {
        simulationAccumulator += frameDelta;
        let steps = 0;
        while (simulationAccumulator >= FIXED_STEP && steps < MAX_SIMULATION_STEPS) {
          update(FIXED_STEP);
          simulationAccumulator -= FIXED_STEP;
          steps++;
        }
        if (steps === MAX_SIMULATION_STEPS) simulationAccumulator = 0;
      }
    } else {
      simulationAccumulator = 0;
    }
    draw(now);
    updatePerformanceDisplay(ms, performance.now() - workStartedAt);
    requestAnimationFrame(loop);
  }

  function continueGame() {
    if (state === "paused") {
      state = "playing";
      ui.overlay.classList.add("hidden");
    }
  }

  addEventListener("keydown", e => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyJ", "KeyX", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Escape"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyX" && !e.repeat) useBomb();
    else if (e.code === "Escape" && (state === "playing" || state === "paused")) {
      state = state === "playing" ? "paused" : "playing";
      ui.kicker.textContent = "A moment between spells"; ui.title.textContent = "Paused"; ui.copy.innerHTML = "Catch your breath.<br>Press Esc to continue.";
      ui.choices.classList.add("hidden");
      ui.difficultyPanel.classList.add("hidden");
      ui.simulationOption.classList.add("hidden");
      ui.continueButton.classList.remove("hidden");
      ui.overlay.classList.toggle("hidden", state === "playing");
    }
    keys.add(e.code);
  });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  ui.difficultyButtons.forEach(button => button.addEventListener("click", () => {
    selectedDifficulty = button.dataset.difficulty;
    ui.difficultyButtons.forEach(option => option.classList.toggle("active", option === button));
  }));
  ui.choiceButtons.forEach(button => button.addEventListener("click", () => resetGame(button.dataset.character, selectedDifficulty)));
  ui.continueButton.addEventListener("click", continueGame);
  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const down = e => { e.preventDefault(); keys.add(code); };
    const up = e => { e.preventDefault(); keys.delete(code); };
    button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("pointerleave", up);
  });
  document.querySelector("[data-action='bomb']").addEventListener("pointerdown", e => { e.preventDefault(); useBomb(); });

  syncUI();
  requestAnimationFrame(loop);
})();
