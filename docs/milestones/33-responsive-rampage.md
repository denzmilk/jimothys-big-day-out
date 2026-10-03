# Milestone 33: Responsive giant rampages

## Status

Reopened after Chris’s maximum-size playtest, 2026-10-03. Approved by Chris, 2026-10-02 (“these as well — go for it”). See STATE for fixed-distance native timings, scoped regression results and remaining frame hitches.

## Objective

Responsive giant rampages. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 23–24.

## Acceptance criteria

- [x] Giant headbutts and rolling contacts affect the surfaces they touch; deliberate digging remains controllable.
- [x] Voxel generation, demolition and mesh work are bounded per update; giant travel does not produce the measured synchronous rebuild stalls.
- [x] Quality/draw-distance presets control visible cost; distant silhouettes bridge loaded detail and per-pass culling skips invisible geometry.
- [x] Native graphics route measurements separate CPU and rendering at lean/house/block sizes; sustained travel, damage and restart retain bounded resources.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.

## Foundation verification

Six voxel work checks and 29 adjacent world checks pass. Native Block route: observed maximum frame 2,041.9 → 123.3 ms, p95 439.1 → 60.4 ms; render calls remain over budget. Full profiling and visual sign-off remain open. See STATE for conditions and evidence.

## Continuous ground channels — Chris, 2026-10-03 (JIM-70)

Giant rolling now intentionally cuts a shallow channel through ground/roads, replacing the earlier road-protection rule for that move. Headbutt digging remains aimed. This is a bounded voxel cut, with exposed banks/floor and persistent physical contact.

- [x] A held giant roll leaves continuous damage between sampled positions, across chunk seams and on slopes.
- [x] The centre is deeper than the banks; repeated passes respect an authored-grade depth cap.
- [x] Work/queued paths/debris stay bounded; damage survives unloading and clears on restart.
- [x] Airborne/bridge travel leaves remote ground untouched; lean rolling and existing aimed digs still work.
- [ ] Chris approves channel scale and rolling feel (user playtest).

JIM-70 evidence: all 54 unit checks pass, including two regressions for yielding/queue fairness that failed before repair. Twenty-five unique terrain/aim/voxel/beach gameplay checks pass across `ground-channel-green.log` and `ground-channel-final.log`; the held-roll reproduction first failed in `ground-channel-browser-red.log`. Build and production pixel smoke pass. Native floor views were inspected. A loaded Chrome/Metal 1280×800 Medium 100 m roll, with live work budgets and military disabled, records Block/Absurd update-plus-render submission medians 18.4/20.9 ms, p95 32.5/43.6 ms, worst 667.8/167 ms. Both carry 64 items, queue at most three jobs, and finish ground edits; seven Absurd mesh jobs remain after six settling seconds. Large destruction still hitches (JIM-48); this is not an FPS sign-off. Logs/captures: `output/iterate/ground-channel-{all-units,final,native,build,smoke}.log`, `ground-channel-{roll,floor}-{250,400}.png`.

## Crash furrow and maximum-size review — 2026-10-03

Chris's reference is a heavy boulder flung across dirt, or a space shuttle crash landing: a broad gouge with broken banks, displaced soil and wreckage along the travelled path. This supersedes the narrow shallow-groove presentation; it still needs an actual traversable floor, bounded work and persistence. Objects losing support must fall/settle instead of floating (JIM-73), and detached buildings/plants/mobile entities should feed the rolling carrying layer (JIM-29).

- [x] Live-budget maximum-size travel has bounded attachment queries and pedestrian route rebuilding — test: `tests/giant-work.spec.js` (both cases; native route evidence in STATE).
- [ ] The rendered furrow follows rolling without waiting seconds for the mesh backlog; terrain contact and persistent damage agree — test: `tests/ground-channel.spec.js`.
- [ ] Gouge width/depth and displaced banks read as a heavy crash trail at each giant size — verified by user playtest.
- [ ] Unsupported assets fall/settle and do not leave static floating remnants — test: `tests/destruction-support.spec.js`.
- [ ] A native maximum-size route records both first-use hitches and sustained frame cost with final rendering enabled.
