# Starfall Shrine

A compact, dependency-free vertical shooting game inspired by classic danmaku/STG design.

This is intentionally a small teaching template. It includes a restrained bullet
screen, collectible power items, bombs, and staged difficulty, while keeping a hard
projectile cap. Advanced waves, bosses, upgrades, and object pooling remain clear
extension points for developers.

Defeated enemies can drop blue point items for score or rarer red `P` talismans for
shot power. Items briefly pop upward before falling and are attracted to the player
at close range; moving to the top of the field attracts all visible items.
All safe collectibles are upright squares without a white circular core. Hostile
bullets use a bright white center to make their collision area immediately readable.
Enemy bodies are also hazardous: touching one costs a life and destroys that enemy.
Losing a life scatters up to one tier of the player's power as recoverable `P` items.
They burst outward briefly before falling, giving the player a chance to reclaim them.

## Play

Open `index.html` in a modern browser, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

- **WASD / Arrow keys** — move
- **Z / J** — shoot
- **X** — use a bomb to clear bullets and damage enemies
- **Shift** — focus (slower movement and visible hitbox)
- **Escape** — pause

Touch controls appear automatically on narrow screens.

## Project structure

- `index.html` — accessible game shell and HUD
- `styles.css` — responsive presentation and touch controls
- `game.js` — one-file game loop with entities, collision, input, and rendering
