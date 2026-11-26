[![Ridgeline Courier](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/kokorotomo51/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/kokorotomo51/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Ridgeline Courier

A complete, original flight game that plays offline in a desktop browser from
its own files. A morning run over the valley: thread gold rings, deliver cargo
to a high mountain strip, or dash a canyon low and fast — with throttle
discipline, fuel to manage, and landings that have to be earned.

Entry for the make.fun bounty: [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057).

## How to play

Serve the game and open it in desktop Chrome:

```
node serve.ts
```

then open http://localhost:8080. Pick a mission on the title screen
(press `1`, `2` or `3`, or click), and fly.

### Missions

- **Ring Run** — thread 10 gold rings down the valley against the clock.
- **Courier** — take off from Pinefield, follow the beacons, land soft on the
  high strip at Alder.
- **Canyon Dash** — stay under the ceiling, thread 8 gates, mind the fuel.

### Controls

| Input | Action |
| --- | --- |
| Arrow keys / WASD | Pitch and bank |
| Shift / Ctrl | Throttle up / down |
| Mouse | Steer (move to fly) |
| Click / Space | Confirm, start, restart |
| P / Esc | Pause |
| R | Restart the mission |
| M | Mute sound |
| T | Back to the title screen |

Landings: touch down on a runway, slow and level, for a scored touchdown.
Fly into terrain and the sortie ends — a glancing strike costs damage and a
bounce, a hard one ends the flight.

## Layout

- `game/index.html` — the page; everything else loads from `game/`.
- `game/src/main.js` — boot, the fixed-step loop, screens, shot staging.
- `game/src/config.js` — tuning numbers and the palette.
- `game/src/random.js` — the seeded RNG and value noise.
- `game/src/terrain.js` — the valley heightfield, river, and airstrips.
- `game/src/aircraft.js` — flight physics: throttle, lift, bank, stall.
- `game/src/missions.js` — goals, rings, beacons, scoring.
- `game/src/input.js` — keyboard, mouse, and touch.
- `game/src/render.js` — sky, terrain, rings, and the aircraft.
- `game/src/hud.js` — lit instruments, dashboard, and screens.
- `game/src/audio.js` — synthesized engine, wind, and cues (no audio files).
- `game/src/shots.js` — the staged screenshot scenes.
- `screenshots/` — real renders of the game's own code.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.

No network requests, no external assets: every file the game loads lives
under `game/`, and every sound is synthesized in the browser.
