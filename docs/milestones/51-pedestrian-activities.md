# Milestone 51: Pedestrian street routines

## Status
Implemented, awaiting Chris's playtest — 2026-10-04. Requested 2026-10-03.

## Objective
Give the existing MPFB crowd recognisable everyday habits and absurd routines, with enough walking and quiet time between them for the street to remain readable.

## Scope
Phone calls, coffee sipping, bird chasing, cartwheels, seated meditation, levitating meditation, moonwalking and paired piggyback rides. Add air guitar, robot dancing, stretching and selfies. Use the existing population, terrain contact, traffic and ragdoll/collection lifecycle. Hold visible phone/cup props; drop them under interruption through shared physics.

## Out of scope
Landmark destination visits (M41), drivers (M42), wanted escalation/JIM-35, and interior resident routines. Those remain recorded in backlog. This pass supplies reusable actions for later visitors.

## Dependencies
- **Depends on:** M26, M29, M30; existing MPFB skeleton and grounding contract.
- **Blocks:** none; reusable by M41.

## State and transitions
| From | Trigger | To | Effect |
| --- | --- | --- | --- |
| roaming | cooldown elapsed, safe space, capacity available | performing / approaching partner | reserve actor(s), choose a different weighted routine |
| approaching partner | close enough, clear route | performing | blend rider onto carrier; share movement |
| performing | routine timer finishes | recovering | blend upright / dismount |
| recovering | blend finishes | roaming | release partner and props, start cooldown |
| any routine | fright, impact, ragdoll, collection, support loss or removal | roaming / external owner | release partner, clear pose, drop held props; existing fleeing/physics owns reaction |

Floating and cartwheels explicitly suspend ordinary foot planting during their airborne/inverted pose; recovery restores ordinary walking IK with its existing default stride. Phone/coffee/standing routines retain planted feet. Moving routines turn before accelerating and use a shorter stride through the shared solver. Motion checks reserve clear space and reject water, walls, steep ledges and road lanes. Blocked piggyback carriers wait and use their timed dismount.

## Acceptance criteria
- [x] All twelve actions are available and occur naturally over time; active routines and people remain bounded, with cooldowns and no immediate repeat — `tests/pedestrian-activities.spec.js` and native ambient sample.
- [x] Phone/cup stay at the hand, arms visibly pose, grounded actions retain feet, and special poses recover upright while preserving normal walking — same test and `tests/walking-ik.spec.js`.
- [x] Moonwalking travels backwards, cartwheels invert with clear space, bird chasing targets/reacts with real wildlife, and piggyback uses two existing people with approach/mount/dismount — `tests/pedestrian-activities.spec.js`.
- [x] Scares, impacts, ragdolls, tool poses and rolling attachment interrupt routines/pairs; dropped props, travel and restart retain bounded registrations/bodies — same test, `tests/activity-lifecycle.spec.js`, and adjacent pedestrian/ragdoll/traffic/tool checks.
- [ ] Chris recognises the actions in normal play and judges their frequency and comic timing — verified by user playtest.

## Exit condition
Chris watches a street, sees varied habits and silly routines, then rolls/headbutts through the crowd → routines stop, people react physically, and survivors resume normal movement.

## Test plan
Run failing behaviour tests before implementation; inspect the existing real MPFB rigs in native WebGL at multiple moments of each action. Verify state through render_game_to_text and deterministic advanceTime, run relevant regressions/unit tests, build and production pixel smoke. Record bounded native frame cost and no console errors. Keep Blender prop source and recipes editable.

## Notes
The latest request explicitly authorises this crowd pass; M50 remains implemented awaiting playtest. The optional frequency question was unanswered, so everyday habits are more common and absurd acts occasional. No extra civilian population is added for paired routines.

## Implementation and limits

- Twelve activities use the existing twelve MPFB rigs and existing population of 36. At most twelve actors perform at once; a piggyback pair consumes two slots. Scheduling starts after 8–16 seconds, with 12–27 seconds of cooldown and no immediate repeat by the same person.
- These are procedural poses over the original animation clips. Phone/cup assets were authored in isolated Blender 5.2.0 LTS background sessions; live Blender MCP was unavailable. Editable sources and exact recipe: `assets/blender/people/activities/README.md`. Each prop has one runtime mesh/material draw.
- Up to eight dropped/attached props share ordinary physics and rolling collection. Loose props expire after 18 seconds or leaving the stream radius; carried props persist until released. Restart unregisters them and removes their bodies.
- Ordinary walkers give performers room; moving routines also yield to ordinary people. This does not add general crowd pathfinding or indoor resident routines. Bird chasing uses the existing flying wildlife and safe pavement routes. Piggyback riders blend up/down; a blocked carrier waits through the timed recovery.
- Routine movement uses a 0.65 stride multiplier and turns before accelerating. Default FootGrounding callers keep multiplier 1. Seated/floating/cartwheel/rider poses temporarily own their feet and restore the normal mixer/grounding on exit.

## Validation — 2026-10-04

**46 unique browser cases pass across focused and adjacent runs**, plus **86 unit tests**, build and production pixel smoke. The final 19-case routine/lifecycle/walking run had 17 passes and two timeouts; both timed-out cases passed focused reruns without source changes. Earlier broad regression had 39/41 passes with two readiness timeouts; sick-ray and pavement-light checks passed their focused reruns. These are automated results, not hands-on feel approval.

- Final checks: `output/iterate/pedestrian-activities-final-verified.log`, `pedestrian-natural-final.log`, `pedestrian-ramp-final.log`; earlier adjacent coverage in `pedestrian-activities-regressions.log` and `pedestrian-activity-lifecycle-check.log`.
- Units/build/smoke: `pedestrian-activities-{units,build,smoke}-final.log`. Existing bundle-size warning remains.
- Failing reproductions preceded the implementation and corrections: missing routines, face/hand gaps, crowd overlap, abrupt rider dismount, and bird-chase overextension. See `pedestrian-activities-red.log`, `pedestrian-grip-red.log`, `pedestrian-space-red.log`, `pedestrian-mount-red.log`, `pedestrian-routine-yield-red.log`, `pedestrian-chase-gait-red.log`. The prop stress fixture was corrected to choose a nearby actor, so streaming expiry did not invalidate its capacity assertion; its expected cap stayed eight.
- Bird-chase minimum pelvis height improved from 18.2% to 38.7% of body height over the reproduced turning route; planted-foot error stays below 5.5 cm. Ordinary street walking retains its prior final metrics: 5 cm maximum hip movement per frame, 12 cm foot movement and 10.5 cm maximum stance error. All twelve physiques also pass uphill/downhill/cross-slope and 30/60/120 Hz checks.

### Native views and bounded performance

Native Chrome/Metal inspection covers all twelve poses, cartwheel entry/inversion/recovery, paired riding/dismount and bird chasing. `pedestrian-activities-native-final.log`, `pedestrian-partner-view-final.log`, `ped-activity-*.png` and `pedestrian-{piggyback,bird-chase}-*.png` are staged close views; other actors are hidden in the paired pose captures to keep them readable. Manual pose captures render twice after stepping to refresh skeletal GPU state before inspection. `pedestrian-activities-street.png` is the normal follow-camera view with the original Jimothy rig. Captures and runs report no console errors.

The final ambient check observed all twelve kinds and all three pair phases over 120 simulated seconds, with Jimothy hidden and the civilian/wildlife systems stepped independently. It retained 36 civilians and never exceeded twelve active actors. A separate warmed 120-frame full-game update/render sample used native Chrome/Metal, 1280×800, Medium, original Jimothy rig and five to six active routine actors: update plus render-submission median **13.1 ms**, p95 **15.2 ms**, worst **20.1 ms**; routine component median **0.5 ms**, p95 **1.3 ms**, worst **6.9 ms**; 195 draw calls. These are local CPU/submission measurements, not GPU completion, general FPS or giant-rampage proof. Evidence: `pedestrian-activity-profile-final.log` and `pedestrian-activity-profile.json`.

## Playtest

At `http://127.0.0.1:4174`, watch a pavement from about 8–10 m away for 10–20 seconds, then approach/headbutt or roll through the performers. Judge whether the actions read clearly, the everyday/absurd mix feels right, and people recover naturally. Close approach within 5 m scares them. Chris's hands-on sign-off remains unchecked above.
