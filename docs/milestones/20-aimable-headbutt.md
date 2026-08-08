# Milestone 20: The aimable headbutt — and digging as a thing you do on purpose

## Status

**implemented 2026-08-08, awaiting playtest.**

## Objective

Let the player point the headbutt, and make **aiming down** the way you dig.

> Chris, 2026-08-07 playtest: *"Will need some dig ability to get underground and see what's there, can you add that as a debug skill? Or maybe just add the headbutt as a directional attack and I can dig down that way."*

The second option, because it is not a debug skill — it is the design the code has been waiting for. `MOVES.HEADBUTT.DIGS_TERRAIN` has been `false` since 2026-07-23 with this comment:

> *Terrain is not a target. A flat headbutt cratering the road turned every swing into a hole he then had to climb out of; digging becomes something you deliberately AIM at once the aimable headbutt lands (backlog).*

So the flag was never "Jimothy cannot dig". It was "Jimothy cannot dig **yet**, because he cannot aim, and an unaimed dig is an accident." This milestone removes the *because*.

Promoted from `docs/backlog.md` (2026-08-06, "aimable headbutt").

## The input decision

The backlog entry flagged the two open questions, and they are the whole design:

> *Aiming needs an input decision (mouse pitch vs. modifier keys vs. auto-target the nearest surface) plus a reticle or the player can't tell where it will land.*

**Aim is the camera.** The headbutt fires along the direction the camera is looking, which is `CameraSystem.pitch` — already driven by the mouse whenever the pointer is locked (**L**). No new keys, no modifier, no separate aim mode: you look at the thing and hit it.

**Digging engages past a threshold**, not immediately. Terrain is only a target when the aim is more than `MOVES.HEADBUTT.DIG_ANGLE` below horizontal. That keeps the 2026-07-23 playtest fix intact — a flat swing still cannot crater the street it lunges over — while making a deliberate downward swing dig. The default follow-camera pitch (0.47 rad) sits comfortably under the threshold, so nothing about the ordinary headbutt changes.

**A reticle**, because the backlog is right that you cannot aim at what you cannot see. A marker sits at the predicted impact point, computed by the same function that fires the blast rather than a second copy of the arithmetic — the failure mode of a reticle is that it lies, and two copies of a formula is how that happens. It changes colour when the aim is steep enough to dig.

## Known rough edge

`CameraSystem.pitch` only changes while the pointer is locked, and follow mode does not recompute it. So unlocking after aiming down leaves the aim steep while the camera returns to its shoulder view. The reticle always shows the truth, so it is never ambiguous — but the *camera* and the *aim* can disagree until you look around again. Making follow mode place its camera from `pitch` too would fix it and would also change a camera feel Chris has already signed off, so it is deliberately not done here.

## Scope

- `src/core/Constants.js` — `DIG_ANGLE`, `AIMABLE`, reticle colours.
- `src/gameplay/JimothyController.js` — a 3D forward vector, aim locked at the moment the move starts, lunge scaled by the horizontal component, head posed to the aim.
- `src/core/Game.js` — `onImpact` takes a direction rather than two axes; `digsTerrain` derived from the aim; the reticle.
- `src/ui/DevTools.js` — a "go to the nearest sewer" button, so the underground can be inspected without digging to it first (the debug half of what Chris asked for).

## Out of scope

- **Hold-to-charge.** The backlog mentions it; it is a separate feel decision and wants its own playtest.
- **Aiming the roll.** The roll is the comedy tool and commits to a flop; pointing it is not obviously an improvement.
- **A dig-specific animation.** He pitches his head at the aim, which is enough to read; a proper burrow is asset work.

## What shipped

`tests/aim.spec.js`, 5 specs. **Two bugs, and the second one is the interesting one.**

**The standoff pushed the whole crater underground.** The blast is offset ahead by its own radius plus the move's reach, so a fat Jimothy carves the wall in front rather than the floor beneath him (playtest 2026-07-23). At full fatness that offset is 4.8 m — pointed downward it put the entire sphere below the surface and left an **intact 0.85 m lid over a cavern he could not reach**. Measured as 0 m of shaft for a swing that removed a thousand voxels. A digging swing uses `reach` alone, because pointing down already carries the blast clear of his body.

**The aim had to be measured from the RESTING camera, not from the horizon.** The shoulder view looks 26.6° down at him, so treating camera pitch as the aim tilted *every ordinary headbutt* at the pavement. Two streaming specs caught it — a wall-smashing swing suddenly removed nothing, because the sphere had dropped below the wall's base. `CameraSystem.aimPitch` is `pitch - neutralPitch`, so neutral is exactly zero and a swing with nobody aiming behaves as it always has. That is not a detail: it is the difference between adding a directional attack and silently changing the game's main verb.

**Measured**, ten swings aimed down: **3.0 m** at fatness 0, **19.7 m** at fatness 40. And because the lunge still carries him forward, what he digs is a **ramp he can walk back out of** rather than a shaft he is stuck in — worth keeping.

## Acceptance criteria

- [x] The headbutt fires along the camera's aim, not always flat
- [x] Aiming down past `DIG_ANGLE` digs terrain; a flat headbutt still spares the ground — asserted as a pair, since either half alone passes on a headbutt that does nothing
- [x] Repeated downward headbutts sink a shaft you can climb into — dug one, measured it, and checked he is standing *in* it
- [x] The reticle shows where the blast will land, and agrees with where it actually lands — one `impactPoint` feeds both, and the spec aims at a digging angle because that is the branch where two copies would diverge
- [x] Aim is in `render_game_to_text()` — `jimothy.aim` and `jimothy.digs`
- [x] DevTools can drop you at the nearest sewer entrance
- [ ] It feels like aiming — **verified by user playtest**

## Exit condition

User locks the pointer, looks at the ground, headbutts a shaft down into a sewer, and climbs back out of it.
