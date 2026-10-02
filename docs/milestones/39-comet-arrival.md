# Milestone 39: Jimothy's comet entrance

## Status

Implemented, awaiting Chris's playtest — requested and authorised 2026-10-03.

## Objective

Make every new run start with a spectacular flaming fall from the sky, a huge crash and a small real crater, then hand back normal movement cleanly.

## Scope

- Wait for the visible character and starting scene, then play an accelerating comet descent with a fire sheath, trailing flames, smoke and sparks.
- Frame the descent and impact with a temporary camera move, expanding shockwave, dust, flash, procedural rush/boom audio and brief shake.
- Excavate a bounded shallow voxel crater, throw pooled debris and recover onto its actual floor. Preserve the quiet initial score/heat state.
- Replay on restart; clear all old effects and sound nodes. Keep effect pools and damage work bounded.

## Dependencies

- **Depends on:** existing loaded rig, voxel destruction and explosion effects (milestones 10, 33–34).
- **Blocks:** none.

## Acceptance criteria

- [x] A real new run starts above the terrain; the visible loaded character descends with active fire/trail while movement and attacks cannot interrupt it — `tests/comet-arrival.spec.js::arrival descends with the loaded rig and ignores attacks`.
- [x] Exactly one crash leaves a shallow crater, emits impact effects and restores grounded walking with score/heat zero — `tests/comet-arrival.spec.js::impact leaves a small crater and returns control`.
- [x] Restart during descent or aftermath clears the old sequence and replays once without accumulating objects/effects — `tests/comet-arrival.spec.js::restart replaces an active arrival and clears its effects`.
- [x] Effect counts expire and camera/FOV return to gameplay; rendering and console remain healthy — same behaviour tests, build and rendered smoke.
- [ ] Flame silhouette, sound, camera and crash feel like a huge entrance — verified by Chris's playtest; native captures supplement this.

## Exit condition

Chris opens or restarts a run → flaming Jimothy falls from the sky, crashes into a small crater with a big audiovisual impact, then can immediately waddle out and play.

## Test plan

Write and run the three behaviour tests red first. Check the full entrance with the real rig in native Chrome; record descent, impact and aftermath captures and bounded frame cost. Run unit tests and adjacent movement, launch, restart, terrain and effects regressions, then build and production pixel smoke. Ordinary mechanic fixtures explicitly skip the intro; arrival tests exercise the production path.

## Notes

| Current phase | Trigger | Next phase |
| --- | --- | --- |
| Waiting | Starting assets ready | Falling |
| Falling | Descent reaches terrain | Impact |
| Impact | Camera recovery ends and crater work finishes | Done |
| Any | Restart | Waiting |

Browser audio starts after the first user gesture. The visual entrance runs automatically; an already unlocked browser plays the full sound sequence. No new asset dependency or change to net-only run endings.

## Verification — 2026-10-03

- Three tests first failed because the entrance was absent (`comet-red.log`). All three pass after implementation and cleanup (`comet-final.log`). The two audio-affected cases pass again with full filter/gain disconnection and an unlocked-audio restart (`comet-audio-final.log`). The original restart count assertion compared different world-streaming moments; it now checks the six entrance objects retain their identities and the overlay remains singular.
- The expanded 30-case native regression passed 29 and exposed audio nodes waiting indefinitely for their browser completion callback during stepped simulation. Explicit lifetime cleanup fixes that failure. The other **27 adjacent cases** passed: keyboard/gamepad movement, camera, food/scoring, loaded-rig grounding and idle gestures, military launch/recovery, prop/debris contact, roll restart and stable explosion lighting. The final arrival reruns cover the corrected case. Logs: `comet-regression.log`, `comet-final.log`, `comet-audio-final.log`.
- All **44 unit tests** pass. Final Vite build and production WebGL pixel smoke pass without console errors. Smoke now steps through the entire opening: phase done, one impact, grounded player, zero score/heat and no remaining entrance particles/sounds (`comet-units.log`, `comet-build-final.log`, `comet-smoke-final.log`).
- Native loaded-rig captures inspected at descent, approach, impact, crater and normal play. The first white beam was revised to orange flame, a smoky wake and embers, with a closer descent camera. Captures: `comet-{fall,approach,impact,crater,play}.png`; state/error trace: `comet-native-final.log`. These captures precede audio-only cleanup; the final profile exercises that cleanup.
- Final independent native profile: Chrome / ANGLE Metal / Apple M5 Pro, 1280 × 800, Medium, real rig, 420 rendered simulation frames, production time budgets and no competing build/test. Update-plus-render submission time: **8.0 ms median / 13.3 ms p95 / 129.5 ms worst**. Impact phase: **6.6 / 8.1 / 16.1 ms**. The worst frame occurs during descent; this is not a hitch-free or GPU-completion/FPS claim. Draw calls: 130 median, 301 peak. Final state: 1,236 removed cells, 1.124 m centre depth, one impact, zero active entrance particles and sound nodes, no errors (`comet-profile.log`).

All evidence is local under `output/iterate/`. Reload http://127.0.0.1:4174 to see the entrance; click once while it loads to enable browser audio. Chris still needs to judge the scale, timing, sound and impact feel.
