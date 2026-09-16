(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"),
    high: document.querySelector("#high-score"),
    lives: document.querySelector("#lives"),
    graze: document.querySelector("#graze"),
    overlay: document.querySelector("#overlay"),
    kicker: document.querySelector("#overlay-kicker"),
    title: document.querySelector("#overlay-title"),
    copy: document.querySelector("#overlay-copy"),
    button: document.querySelector("#start-button")
  };

  const W = canvas.width;
  const H = canvas.height;
  // Deliberately conservative: this project is an educational base, not a
  // full bullet-hell implementation. Raise this only when adding pooling.
  const MAX_ENEMY_BULLETS = 32;
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
  let shake = 0;
  let highScore = Number(localStorage.getItem("starfall-high") || 0);
  let player;
  let enemies = [];
  let playerBullets = [];
  let enemyBullets = [];
  let particles = [];

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const pad = n => Math.floor(n).toString().padStart(7, "0");

  function resetGame() {
    elapsed = spawnClock = score = graze = shake = 0;
    lives = 3;
    enemies = [];
    playerBullets = [];
    enemyBullets = [];
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
      seed: Math.random() * 10, value: hp * 120
    });
  }

  function shootEnemy(enemy) {
    if (enemyBullets.length >= MAX_ENEMY_BULLETS) return;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const speed = 105 + Math.min(45, elapsed * .5);
    const addBullet = (shotAngle, shotSpeed, kind) => {
      if (enemyBullets.length < MAX_ENEMY_BULLETS) {
        enemyBullets.push(makeEnemyBullet(enemy.x, enemy.y, shotAngle, shotSpeed, kind));
      }
    };
    if (enemy.type === "caster") {
      // A simple three-way aimed spread: readable, reusable, and easy to tune.
      [-.28, 0, .28].forEach(offset => addBullet(angle + offset, speed * .8, "orb"));
      enemy.shot = 2.4;
    } else if (enemy.type === "swooper") {
      addBullet(angle, speed, "needle");
      enemy.shot = 1.9;
    } else {
      addBullet(angle, speed, "orb");
      enemy.shot = 2.1 + Math.random() * .5;
    }
  }

  function makeEnemyBullet(x, y, angle, speed, kind) {
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: kind === "needle" ? 4 : 5, kind, grazed: false };
  }

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 24;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .45, max: .8, color, size: Math.random() * 3 + 1 });
    }
  }

  function hitPlayer() {
    if (player.invincible > 0) return;
    lives--;
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
      ui.button.innerHTML = "Try again <span>J</span>";
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

    if (keys.has("KeyJ") && player.cooldown <= 0) {
      playerBullets.push({ x: player.x - 7, y: player.y - 14, vy: -520 }, { x: player.x + 7, y: player.y - 14, vy: -520 });
      player.cooldown = .085;
    }

    const spawnRate = Math.max(.82, 1.3 - elapsed * .004);
    spawnClock -= dt;
    if (spawnClock <= 0) { spawnEnemy(); spawnClock = spawnRate; }

    for (const b of playerBullets) b.y += b.vy * dt;
    playerBullets = playerBullets.filter(b => b.y > -20);

    for (const enemy of enemies) {
      enemy.age += dt;
      enemy.shot -= dt;
      if (enemy.type === "swooper") enemy.x += Math.sin(enemy.age * 2.8 + enemy.seed) * 90 * dt;
      else enemy.x += Math.sin(enemy.age * 1.5 + enemy.seed) * 28 * dt;
      enemy.y += enemy.speed * dt;
      if (enemy.shot <= 0 && enemy.y > 35 && enemy.y < H * .72) shootEnemy(enemy);
    }

    for (const bullet of playerBullets) {
      for (const enemy of enemies) {
        if (enemy.hp > 0 && dist2(bullet, enemy) < (enemy.r + 4) ** 2) {
          bullet.y = -100;
          enemy.hp--;
          if (enemy.hp <= 0) {
            score += enemy.value;
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
    for (const b of enemyBullets) {
      ctx.save(); ctx.translate(b.x, b.y); if (b.kind === "needle") ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      ctx.shadowColor = b.kind === "needle" ? "#70d9ff" : "#fe5881"; ctx.shadowBlur = 10;
      ctx.fillStyle = b.kind === "needle" ? "#8be3ff" : "#ff6d92";
      if (b.kind === "needle") ctx.fillRect(-2.5, -9, 5, 18); else { ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
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
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyJ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Escape"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyJ" && (state === "menu" || state === "gameover")) toggleStart();
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
    const down = e => { e.preventDefault(); keys.add(code); if (code === "KeyJ" && state !== "playing") toggleStart(); };
    const up = e => { e.preventDefault(); keys.delete(code); };
    button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("pointerleave", up);
  });

  syncUI();
  requestAnimationFrame(loop);
})();
