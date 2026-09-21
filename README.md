# Starfall Shrine

A compact, dependency-free vertical shooting game inspired by classic danmaku/STG design.

This is intentionally a small teaching template. It includes a restrained bullet
screen, collectible power items, bombs, and staged difficulty, while keeping a hard
projectile cap. Advanced waves, bosses, upgrades, and object pooling remain clear
extension points for developers.

Defeated enemies can drop blue point items for score or rarer red `P` talismans for
shot power. Items briefly pop upward before falling and are attracted to the player
at close range; moving to the top of the field attracts all visible items.
Individual power items grant only `0.05–0.20 P`, depending on their source. Their drop
chance rises smoothly when the player is low on power and tapers as `P MAX` approaches,
so recovery is generous without causing abrupt tier jumps.
All safe collectibles are upright squares without a white circular core. Hostile
bullets use a bright white center to make their collision area immediately readable.
Enemy bodies are also hazardous: touching one costs a life and destroys that enemy.
Losing a life scatters up to one tier of the player's power as recoverable `P` items.
They burst outward briefly before falling, giving the player a chance to reclaim them.

Boss defeats scatter a fan of at least five `P` items totaling no less than `1.00 P`.
The current introductory and final rewards total `1.20 P` and `2.00 P`, respectively.
Once shot power is maxed, surplus power is banked toward another bomb: the next stock
costs `(current bombs + 1).00 P`, so a player holding two bombs needs `3.00 P` for the
next one. The HUD tracks this progress.

Blue point items also build a cumulative life-point total. Their value scales smoothly
from 1× at the bottom of the playfield to 3× at the top, rewarding risky high pickups.
Each 20,000 life points awards an additional life, with the next cumulative target
shown in the HUD.

## Play

Open `index.html` in a modern browser, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

The title menu provides Story, Stage Practice, Spell Practice, and Records screens.
Story runs proceed through every stage normally. Stage Practice exposes every stage,
starts the player at full power with infinite lives, records net lives lost, and ends
after the selected stage. Spell Practice filters cards by the chosen difficulty and
starts directly at the selected card. High score, run/clear totals, spell captures,
recorded deaths, and the best practice loss are saved in browser local storage.

## GitHub Pages deployment

This dependency-free site is published directly from the root of the
`LeoL's-Touhou` branch. The intended custom domain is
`stg.geeksproductionstudio.com`.

In the repository's **Settings → Pages** screen, choose **Deploy from a branch**. Select
the `LeoL's-Touhou` branch, select the `/(root)` folder, and save. Then set the custom
domain to `stg.geeksproductionstudio.com`. At the DNS provider for
`geeksproductionstudio.com`, create this record:

| Type | Name | Target |
| --- | --- | --- |
| `CNAME` | `stg` | `creative-visions-bihz.github.io` |

After GitHub finishes issuing its certificate, enable **Enforce HTTPS**. Do not point
the DNS record at the repository-specific URL; GitHub requires subdomain CNAME records
to target the organization Pages hostname.

## Controls

- **WASD / Arrow keys** — move
- **Z / J** — shoot
- **X** — use a bomb to clear bullets and damage enemies
- **Shift** — focus (slower movement and visible hitbox)
- **Escape** — pause

Touch controls appear automatically on narrow screens.

## Shot styles

- **Type A — Reimu:** standard movement with large, tilted square amulets. Powered unfocused volleys spread into a widening V for broad coverage; holding Shift makes every lane parallel. Power tiers also add homing missiles.
- **Type B — Marisa:** 50% faster movement, bullet speed, and firing rate with narrow full-damage shots. Her piercing laser is always a pair of side beams; holding Shift pulls them together at the center, while power increases their width, damage, and pulse rate.

Both bomb cards immediately cancel hostile bullets, then diverge by character. Reimu's
**Spirit Sign [Fantasy Seal]** launches a large, enduring Yin-Yang orb that homes between targets, repeatedly hits
enemies or bosses, and produces white-light clashes with field shake on impact. With no
valid target it curves away in a short departure arc and disappears instead of waiting.
Marisa's **Love Sign [Master Spark]** fires directly
from her position: an extremely wide, high-damage laser that persists for several
multi-hit pulses. Either bomb ends when a boss phase is cleared.

## Difficulty and simulation

- **Easy:** swarms do not fire, three-way attacks become single aimed shots, and other patterns are smaller, slower, and less frequent.
- **Normal:** the baseline patterns and projectile limits.
- **Hard:** adds bullets, increases their size and speed, and shortens attack intervals.
- **Lunatic:** adds still more bullets and substantially larger projectiles.

The default fixed 60 Hz simulation runs independently of rendered FPS. At 25 FPS it
performs multiple simulation updates per rendered frame, so movement and firing retain
their intended rates. The optional **FPS-synced slowdown** setting instead performs one
1/60-second update per rendered frame, intentionally slowing the game below 60 FPS.

The optional **Practice** mode gives the player infinite lives while preserving the
normal death penalties, recovery-item burst, and bomb reset. The HUD counts net lives
lost as deaths minus life extends earned from point items (never displaying below zero).
Practice scores are not saved as high scores.

Marisa's power-scaled twin lasers provide piercing support damage; her ordinary focused
fire remains the primary source of boss damage. Boss and spell-card HP are configured in
`stage-profile.js` for straightforward balance tuning.

During the final 20% of every boss health bar, a specialty guard reduces missile and
laser damage by 75%. Ordinary shots and bombs bypass this defense. The HUD changes its
bar color and labels the guarded phase when it activates.

Ordinary shots are capped and grow to at most five projectiles per volley. Reimu's
missiles require a current target and expire after traveling 62% of the playfield
height. Profiled formations contain normal-sized one-shot enemies, creating pressure
through positioning and numbers rather than extra health.

## Stage profiles

`stage-profile.js` records two sequential stages with timed formation and boss events. Stage time pauses
during boss encounters, so later events cannot overlap an unfinished boss phase. The
first stage contains an introductory boss encounter followed by three final spell cards:

The opening section lasts 51 active stage seconds, followed by another extended enemy
section before the final boss at stage-second 90. Mixed groups provide several caster
enemies so both characters can develop their power-specific weapons before each fight.

- **Petal Geometry** — rotating medium-bullet rings with moving openings
- **Crossing Stars** — mirrored sweeping lanes with aimed interruptions
- **Last Light of the Orrery** — slow large-bullet walls with player-facing gaps

Stage 2, **Palace of Bent Time**, uses closer wave spacing and enemies with 68% of the
first stage's health. Its boss is **Mizuki, Keeper of the Second Hand**. The initial
encounter has 0/1/1/2 spell cards on Easy/Normal/Hard/Lunatic; the finale has 3/4/5/5.
Its named patterns use curved lanes, two timed redirects, bullet lattices, synchronized
freezing and release, mirrored formations, and velocity reversal instead of uniform
radial-ring variants.

Stage 3, **The Thunder Archive**, follows Stage 2 with tougher enemies and a more
durable midboss. Dedicated fencer enemies rapidly fire ordinary bullets from one
fixed origin along one locked direction, forming a dotted line along their path.
Some streams aim at the player's current position; others use fixed angled courses.
The boss, **Raika, Warden of the Storm Seal**, uses rapid dotted bullet lines, fields
of countless slow random bullets, and several laser-focused spell cards. Ordinary
bullet lines fire immediately without a warning. Rigid lasers show a harmless thin
white guide for one second and then fire for about one second. Laser patterns use
single fixed or once-locked graze lanes and synchronized vertical, fan, and opposing
diagonal cross-hatch arrays with intentional escape lanes. A complete laser sequence must disappear before another can
begin, and major volleys are separated by at least three seconds. Bombs, hits, and
phase clears remove active and pending attacks. Higher difficulties add denser support
fire while preserving the main pattern's gaps.

The Stage 3 midboss now arrives at stage-second 34 after extra mixed, formation, and
dotted-line waves; the longer second section brings the final encounter at stage-second 67.

Entering the initial encounter, clearing a spell card, and defeating a boss all invoke
the same global-clear operation. It removes bullets and ordinary enemies, preserves a
living boss between cards, and launches every item toward the player for visible
collection. Cleared enemies and projectiles burst individually, cleared enemies release
their normal loot, and an expanding clear wave crosses the field. Boss defeats and
spell-card breaks receive larger phase-specific explosions.
The introductory and final boss defeats then release their own power-item showers; the
final shower remains collectible for a short victory window before stage-clear results.

Clearing a spell card without dying or bombing awards a difficulty-scaled capture
bonus. Each stage ends with a large boss explosion and a descending result screen that
counts the accumulated spell-card captures, an additional graze/stock/bomb bonus, the
stage-clear bonus, and their combined total before continuing.

High-churn combat objects use reusable pools for hostile bullets, player shots,
missiles, laser pulses, and particles. Active arrays are compacted in place to avoid
garbage-collection spikes during dense spell cards. Collision checks use inexpensive
axis rejection and squared distances, skip invulnerable-player checks, and batch graze
HUD updates once per frame. Hostile bullets avoid per-object canvas blur effects.

The HUD reports effective rolling FPS to two decimal places and workload twice per
second. FPS is calculated from delivered animation-frame intervals rather than a frame
counter. Its tooltip includes average/worst frame time and estimated missed 60 Hz
frames. Workload is the portion of elapsed time spent in the game callback, followed
by the current number of active game objects.

## Project structure

- `index.html` — accessible game shell and HUD
- `styles.css` — responsive presentation and touch controls
- `stage-profile.js` — editable event timing, formations, and spell-card metadata
- `game.js` — one-file game loop with entities, collision, input, and rendering
