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
    overlay: document.querySelector("#overlay"),
    kicker: document.querySelector("#overlay-kicker"),
    title: document.querySelector("#overlay-title"),
    copy: document.querySelector("#overlay-copy"),
    button: document.querySelector("#start-button")
  };

  const W = canvas.width;
  const H = canvas.height;
  // Enough for a readable bullet screen, but bounded for an educational demo.
  // Raise this only after adding object pooling and profiling the renderer.
  const MAX_ENEMY_BULLETS = 128;
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
  let elapsed = 0;
  let spawnClock = 0;
  let score = 0;
  let graze = 0;
  let lives = 3;
  let power = 0;
  let bombs = 2;
  let bombWave = 0;
  let shownRank = 1;
  let shake = 0;
  let highScore = Number(localStorage.getItem("starfall-high") || 0);
  let player;
  let enemies = [];
  let playerBullets = [];
  let enemyBullets = [];
  let items = [];
  let particles = [];

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const pad = n => Math.floor(n).toString().padStart(7, "0");
  const difficultyRank = () => Math.min(5, 1 + Math.floor(elapsed / 28));

  function resetGame() {
    elapsed = spawnClock = score = graze = shake = bombWave = 0;
    lives = 3;
    power = 0;
    bombs = 2;
    shownRank = 1;
    enemies = [];
    playerBullets = [];
    enemyBullets = [];
    items = [];
    particles = [];
    player = { x: W / 2, y: H - 90, r: 3.5, cooldown: 0, invincible: 1.5 };
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
  }

  function spawnEnemy() {
    const difficulty = Math.min(1, elapsed / 75);
    const typeRoll = Math.random();
    const type = typeRoll < .54 ? "drifter" : typeRoll < .86 ? "swooper" : "caster";
    const hp = type === "caster" ? 16 : type === "swooper" ? 7 : 5;
    enemies.push({
      x: 45 + Math.random() * (W - 90), y: -28, r: type === "caster" ? 17 : 13,
      hp, maxHp: hp, type, age: 0, shot: .45 + Math.random() * .8,
      speed: (type === "caster" ? 44 : 70) + difficulty * 16,
      seed: Math.random() * 10, volley: 0, value: hp * 120
    });
  }

  function shootEnemy(enemy) {
    if (enemyBullets.length >= MAX_ENEMY_BULLETS) return;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const speed = 105 + Math.min(45, elapsed * .5);
    const rank = difficultyRank();
    enemy.volley++;
    const addBullet = (shotAngle, shotSpeed, kind) => {
      if (enemyBullets.length < MAX_ENEMY_BULLETS) {
        enemyBullets.push(makeEnemyBullet(enemy.x, enemy.y, shotAngle, shotSpeed, kind));
      }
    };
    if (enemy.type === "caster") {
      // A slow radial ring creates a small bullet screen without flooding it.
      const count = 4 + rank;
      const bulletType = enemy.volley % 2 ? "orb" : "star";
      for (let i = 0; i < count; i++) {
        addBullet((Math.PI * 2 * i / count) + enemy.age * .45, speed * .72, bulletType);
      }
      enemy.shot = Math.max(1.55, 2.45 - rank * .12);
    } else if (enemy.type === "swooper") {
      const spread = rank >= 2 ? [-.2, 0, .2] : [0];
      spread.forEach(offset => addBullet(angle + offset, speed, "shard"));
      enemy.shot = Math.max(1.25, 2.05 - rank * .12);
    } else {
      const bulletType = rank >= 3 && enemy.volley % 2 === 0 ? "rice" : "orb";
      addBullet(angle, speed, bulletType);
      if (rank >= 4) addBullet(angle + .18, speed * .92, bulletType);
      enemy.shot = Math.max(1.4, 2.2 - rank * .1) + Math.random() * .35;
    }
  }

  function makeEnemyBullet(x, y, angle, speed, kind) {
    const radii = { orb: 5, shard: 5, rice: 4.5, star: 5.5 };
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radii[kind] || 5, kind, grazed: false };
  }

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 24;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .45, max: .8, color, size: Math.random() * 3 + 1 });
    }
  }

  function dropLoot(enemy) {
    const roll = Math.random();
    let kind;
    if (enemy.type === "caster") kind = roll < .62 ? "power" : "point";
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

  function useBomb() {
    if (state !== "playing" || bombs <= 0 || bombWave > 0) return;
    bombs--;
    bombWave = 1;
    player.invincible = 1.6;
    shake = 8;
    for (const bullet of enemyBullets) burst(bullet.x, bullet.y, "#8ceaff", 2);
    score += enemyBullets.length * 5;
    enemyBullets = [];
    for (const enemy of enemies) enemy.hp -= 5;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) {
        score += enemy.value;
        dropLoot(enemy);
        burst(enemy.x, enemy.y, "#f5d681", 16);
      }
    }
    burst(player.x, player.y, "#f5d681", 34);
    syncUI();
  }

  function hitPlayer() {
    if (player.invincible > 0) return;
    lives--;
    const lostPower = Math.min(power, 25);
    power -= lostPower;
    if (lives > 0) scatterLostPower(player.x, player.y, lostPower);
    bombs = 2;
    shake = 12;
    burst(player.x, player.y, "#f04f64", 28);
    enemyBullets = [];
    if (lives <= 0) {
      highScore = Math.max(highScore, score);
      localStorage.setItem("starfall-high", highScore);
      state = "gameover";
      ui.kicker.textContent = "The spellstorm prevailed";
      ui.title.textContent = "Flight ended";
      ui.copy.innerHTML = `Final score: ${pad(score)}<br>Graze: ${graze}`;
      ui.button.innerHTML = "Try again <span>Z</span>";
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
    const speed = focused ? 145 : 245;
    let dx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    let dy = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    if (dx && dy) { dx *= .707; dy *= .707; }
    player.x = clamp(player.x + dx * speed * dt, 15, W - 15);
    player.y = clamp(player.y + dy * speed * dt, 25, H - 20);
    player.invincible = Math.max(0, player.invincible - dt);
    player.cooldown -= dt;
    bombWave = Math.max(0, bombWave - dt);

    if ((keys.has("KeyZ") || keys.has("KeyJ")) && player.cooldown <= 0) {
      const tier = Math.floor(power / 25);
      playerBullets.push({ x: player.x - 6, y: player.y - 14, vx: 0, vy: -520 }, { x: player.x + 6, y: player.y - 14, vx: 0, vy: -520 });
      if (tier >= 1) playerBullets.push({ x: player.x - 14, y: player.y - 9, vx: -18, vy: -500 }, { x: player.x + 14, y: player.y - 9, vx: 18, vy: -500 });
      if (tier >= 2) playerBullets.push({ x: player.x - 20, y: player.y - 5, vx: -52, vy: -475 }, { x: player.x + 20, y: player.y - 5, vx: 52, vy: -475 });
      if (tier >= 3) playerBullets.push({ x: player.x, y: player.y - 19, vx: 0, vy: -560 });
      if (tier >= 4) playerBullets.push({ x: player.x - 27, y: player.y, vx: -82, vy: -450 }, { x: player.x + 27, y: player.y, vx: 82, vy: -450 });
      player.cooldown = .085;
    }

    const spawnRate = Math.max(.54, 1.25 - difficultyRank() * .11);
    spawnClock -= dt;
    if (spawnClock <= 0) { spawnEnemy(); spawnClock = spawnRate; }

    for (const b of playerBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    playerBullets = playerBullets.filter(b => b.y > -20);

    for (const enemy of enemies) {
      enemy.age += dt;
      enemy.shot -= dt;
      if (enemy.type === "swooper") enemy.x += Math.sin(enemy.age * 2.8 + enemy.seed) * 90 * dt;
      else enemy.x += Math.sin(enemy.age * 1.5 + enemy.seed) * 28 * dt;
      enemy.y += enemy.speed * dt;
      if (enemy.shot <= 0 && enemy.y > 35 && enemy.y < H * .72) shootEnemy(enemy);

      // Enemy bodies are hazardous too. Use the player's deliberately small
      // hitbox so focused movement remains precise and predictable.
      if (enemy.hp > 0 && player.invincible <= 0 && dist2(enemy, player) < (enemy.r + player.r) ** 2) {
        enemy.hp = 0;
        burst(enemy.x, enemy.y, "#f04f64", 20);
        hitPlayer();
      }
    }

    for (const bullet of playerBullets) {
      for (const enemy of enemies) {
        if (enemy.hp > 0 && dist2(bullet, enemy) < (enemy.r + 4) ** 2) {
          bullet.y = -100;
          enemy.hp--;
          if (enemy.hp <= 0) {
            score += enemy.value;
            dropLoot(enemy);
            burst(enemy.x, enemy.y, enemy.type === "caster" ? "#d5a8ff" : "#f0bd6a", 18);
            syncUI();
          }
          break;
        }
      }
    }
    enemies = enemies.filter(e => e.hp > 0 && e.y < H + 50 && e.x > -60 && e.x < W + 60);
    playerBullets = playerBullets.filter(b => b.y > -20);

    for (const b of enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const d = Math.sqrt(dist2(b, player));
      if (!b.grazed && d < 24 && d > player.r + b.r) {
        b.grazed = true;
        graze++;
        score += 25;
        syncUI();
      }
      if (d < player.r + b.r) { b.y = H + 100; hitPlayer(); }
    }
    enemyBullets = enemyBullets.filter(b => b.x > -30 && b.x < W + 30 && b.y > -40 && b.y < H + 30);

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
        item.collected = true;
        if (item.kind === "power") {
          if (power < 100) power = Math.min(100, power + item.value);
          else score += 500;
          if (!item.recovered) score += 100;
          burst(item.x, item.y, "#ef596b", 7);
        } else {
          score += item.value + (player.y < 115 ? 200 : 0);
          burst(item.x, item.y, "#64c8ff", 7);
        }
        syncUI();
      }
    }
    items = items.filter(item => !item.collected && item.y < H + 25);

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
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
    ctx.fillStyle = "#f5ead8";
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e3445a";
    ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(-18, -2); ctx.lineTo(-8, 7); ctx.lineTo(-14, 17); ctx.lineTo(0, 10); ctx.lineTo(14, 17); ctx.lineTo(8, 7); ctx.lineTo(18, -2); ctx.lineTo(5, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f2c769"; ctx.fillRect(-2, -18, 4, 25);
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

  function draw(time) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    drawBackground(time);
    ctx.globalCompositeOperation = "lighter";
    for (const b of playerBullets) {
      ctx.shadowColor = "#7fe7ff"; ctx.shadowBlur = 9; ctx.fillStyle = "#d7fbff"; ctx.fillRect(b.x - 1.5, b.y - 10, 3, 16);
    }
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
    for (const e of enemies) drawEnemy(e);
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
        ctx.shadowColor = "#54d4ff"; ctx.shadowBlur = 9; ctx.fillStyle = "#91e7ff";
        ctx.fillRect(-4, -4, 8, 8);
      } else if (b.kind === "rice") {
        ctx.rotate(travelAngle + Math.PI / 2);
        ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 9; ctx.fillStyle = "#ffe28f";
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === "star") {
        ctx.rotate(b.x * .025 + b.y * .012);
        ctx.shadowColor = "#b58aff"; ctx.shadowBlur = 10; ctx.fillStyle = "#c9a5ff";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 2.5 : 5.5;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.shadowColor = "#fe5881"; ctx.shadowBlur = 10; ctx.fillStyle = "#ff6d92";
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      }
      // The centered white core is the universal visual language for danger.
      ctx.globalAlpha = 1; ctx.shadowColor = "white"; ctx.shadowBlur = 6; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1.9, b.r * .4), 0, Math.PI * 2); ctx.fill();
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
    const now = ms / 1000;
    const dt = Math.min(.033, now - lastTime || 0);
    lastTime = now;
    if (state === "playing") update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  function toggleStart() {
    if (state === "menu" || state === "gameover") resetGame();
    else if (state === "paused") { state = "playing"; ui.overlay.classList.add("hidden"); }
  }

  addEventListener("keydown", e => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyJ", "KeyX", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Escape"].includes(e.code)) e.preventDefault();
    if ((e.code === "KeyZ" || e.code === "KeyJ") && (state === "menu" || state === "gameover")) toggleStart();
    else if (e.code === "KeyX" && !e.repeat) useBomb();
    else if (e.code === "Escape" && (state === "playing" || state === "paused")) {
      state = state === "playing" ? "paused" : "playing";
      ui.kicker.textContent = "A moment between spells"; ui.title.textContent = "Paused"; ui.copy.innerHTML = "Catch your breath.<br>Press Esc to continue."; ui.button.innerHTML = "Continue <span>Esc</span>";
      ui.overlay.classList.toggle("hidden", state === "playing");
    }
    keys.add(e.code);
  });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  ui.button.addEventListener("click", toggleStart);
  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const down = e => { e.preventDefault(); keys.add(code); if ((code === "KeyZ" || code === "KeyJ") && state !== "playing") toggleStart(); };
    const up = e => { e.preventDefault(); keys.delete(code); };
    button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("pointerleave", up);
  });
  document.querySelector("[data-action='bomb']").addEventListener("pointerdown", e => { e.preventDefault(); useBomb(); });

  syncUI();
  requestAnimationFrame(loop);
})();
