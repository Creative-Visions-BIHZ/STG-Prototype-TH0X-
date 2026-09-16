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

## Shot styles

- **Type A — Reimu:** standard movement and wider, lower-damage shots. Power tiers add homing missiles; higher tiers launch them faster and eventually in pairs.
- **Type B — Marisa:** 50% faster movement, bullet speed, and firing rate with narrow full-damage shots. Power tiers add piercing laser pulses that widen and split into twin beams.

Marisa's lasers provide light piercing support damage; her ordinary focused fire remains
the primary source of boss damage. Boss and spell-card HP are configured in
`stage-profile.js` for straightforward balance tuning.

During the final 20% of every boss health bar, a specialty guard reduces missile and
laser damage by 75%. Ordinary shots and bombs bypass this defense. The HUD changes its
bar color and labels the guarded phase when it activates.

Ordinary shots are capped and grow to at most five projectiles per volley. Reimu's
missiles require a current target and expire after traveling 62% of the playfield
height. Profiled formations contain normal-sized one-shot enemies, creating pressure
through positioning and numbers rather than extra health.

## Stage profile

`stage-profile.js` records timed formation and boss events. Stage time pauses
during boss encounters, so later events cannot overlap an unfinished boss phase. The
stage contains an introductory boss encounter followed by three final spell cards:

The opening section lasts 51 active stage seconds, followed by another extended enemy
section before the final boss at stage-second 90. Mixed groups provide several caster
enemies so both characters can develop their power-specific weapons before each fight.

- **Petal Geometry** — rotating medium-bullet rings with moving openings
- **Crossing Stars** — mirrored sweeping lanes with aimed interruptions
- **Last Light of the Orrery** — slow large-bullet walls with player-facing gaps

Entering the initial encounter, clearing a spell card, and defeating a boss all invoke
the same global-clear operation. It removes bullets and ordinary enemies, preserves a
living boss between cards, and immediately collects every item on screen. Cleared
enemies and projectiles burst individually before an expanding clear wave crosses the
field; boss defeats and spell-card breaks receive larger phase-specific explosions.

High-churn combat objects use reusable pools for hostile bullets, player shots,
missiles, laser pulses, and particles. Active arrays are compacted in place to avoid
garbage-collection spikes during dense spell cards.

## Project structure

- `index.html` — accessible game shell and HUD
- `styles.css` — responsive presentation and touch controls
- `stage-profile.js` — editable event timing, formations, and spell-card metadata
- `game.js` — one-file game loop with entities, collision, input, and rendering
