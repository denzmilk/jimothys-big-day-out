# Milestone 32: Streetlights and controlled traffic

## Status

Implemented, awaiting Chris’s playtest — requested 2026-10-02.

## Objective

Watch a junction → cars approach in consistent lanes, queue at a red signal, then cross on green. At night, regularly placed streetlights illuminate the pavement. Jimothy can knock down or break those lights.

## Scope

- Right-hand traffic following the authored district streets, with forward-facing travel and smooth junction turns.
- Red/amber/green signals with a clearance interval, stop lines, queue spacing and braking for Jimothy, people, cars and damaged road surfaces.
- Regular pavement streetlights facing the road, night illumination and bounded local light sources.
- Signals and lamps use the existing physical breakage/collection contract. Broken signals revert to an orderly yield rule; streaming preserves damage and restart restores the system.

## Dependencies

Depends on milestones 27, 28 and 30; JIM-54 fixes backwards movement first. Existing EventBus/PhysicsSystem ownership is retained.

## Acceptance criteria

- [x] All six imported vehicles face their direction of travel, including turns.
- [x] Traffic follows clear right-hand lanes in the spawn area and a rotated district.
- [x] Opposing signal phases cannot both be green; cars stop before red stop lines, queue without overlap and resume on green.
- [x] A car already inside a junction clears it; conflicts yield, and a blocked exit prevents entry.
- [x] Cars brake for Jimothy, people, stopped cars and broken road surfaces, then resume when clear.
- [x] Regular streetlights stand on pavement, face the road and illuminate at night; both lamps and signals break into physical sections and stop emitting when damaged.
- [x] Broken signal control yields safely; streaming preserves damage and restart resets queues/signals without accumulating meshes or bodies.
- [x] Departing clean traffic is replenished while Jimothy stands still; damaged cars keep saved state and repeated replacement does not grow bodies/entities — `tests/traffic-streaming.spec.js`, adjacent `tests/glass.spec.js`.
- [x] New traffic spawns behind junction stop lines — `tests/traffic-spawn.spec.js`.
- [ ] Traffic, junction appearance and night lighting feel right — Chris's playtest.

## Exit condition

Chris watches a red-to-green junction cycle, walks in front of a car, then breaks a lamp or signal and checks its response at night.

## Test plan

Write failing behaviour checks before implementation. Check actual displacement, lane locations, stop lines, queue gaps, conflicting phases, obstacles, destruction, streaming and restart. Run rendered smoke and inspect captures in `output/iterate/`; run adjacent checks and the full suite. Commit JIM-54 and this milestone separately.

## Verification — 2026-10-02

Final focused checks pass: 14 traffic/street-life checks (`output/iterate/traffic-right-hand-final.log`), complete signal-head coverage (`traffic-signal-placement-green.log`), all eight traffic control behaviours after pavement fitting (`traffic-controls-final.log`), and 10 streaming/glass/street-life checks (`traffic-streaming-final.log`). The heading tests inspect actual front/rear axles against displacement; the lane-side check compares all 301 road segments with the imported models' named right/left wheels. New traffic spawns behind the stop line.

Measured queue gap: at least 1.04 m; lead bumper stops 0.9 m before the approach end. Both queued cars move off after green. Actual pedestrians and Jimothy stop the test car; traffic resumes after obstacles/road damage clear. Broken-signal crossing admits both tested approaches one at a time, with 4.30 m minimum centre separation and no off-road centres.

The inspected spawn area contains eight moving cars, ten parked cars, 26 lamps and 17 signal poles. The four-light night budget remains bounded. Twelve forced departures while Jimothy stands still retain eight nearby cars, 295 bodies and 338 registered entities; clean departures leave no saved records. Damaged cars retain their saved state. Every timed junction has a physical signal head for every incoming approach; uncovered junctions use stop/yield control.

Production build and rendered smoke pass without console errors (`traffic-final-build.log`, `traffic-final-smoke.log`). Inspected captures: `traffic-day.png`, `traffic-night.png`, and `traffic-signals-*.png`. Colour-preserving signal materials keep red/amber/green distinct in daylight and at night.

The full suite passed **190/196** (`output/iterate/traffic-full-suite.log`). Five failures match the existing JIM-03 interrupted-feast, JIM-49 rig-growth and JIM-48 renderer-budget cases. The sixth exposed JIM-55 during a downhill pedestrian turn. The separate correction (`6f5ae85`) takes a short recovery step when both feet trail the hips; all three walking checks and all 31 adjacent grounding, character, pursuit, ragdoll and traffic checks pass afterwards (`traffic-ik-recovery.log`, `traffic-ik-adjacent.log`). Worst planted-foot error falls from 0.197 m to 0.114 m; p95 is 0.0315 m. Assertion limits are unchanged. The full suite preceded this correction; affected checks, build and rendered smoke were rerun after it.

The production scene currently reports 1,720 whole-renderer calls. JIM-48 still needs a separate batching/LOD pass. Chris's visual/feel sign-off and performance judgement remain open.
