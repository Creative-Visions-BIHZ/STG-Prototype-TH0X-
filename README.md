# Starfall Shrine

A compact, dependency-free vertical shooting game inspired by classic danmaku/STG design.

This is intentionally a small teaching template. Enemy patterns stay sparse and the
number of hostile projectiles is capped, leaving advanced waves, dense patterns,
bosses, upgrades, and object pooling as clear extension points for developers.

## Play

Open `index.html` in a modern browser, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

- **WASD / Arrow keys** — move
- **J** — shoot
- **Shift** — focus (slower movement and visible hitbox)
- **Escape** — pause

Touch controls appear automatically on narrow screens.

## Project structure

- `index.html` — accessible game shell and HUD
- `styles.css` — responsive presentation and touch controls
- `game.js` — one-file game loop with entities, collision, input, and rendering
