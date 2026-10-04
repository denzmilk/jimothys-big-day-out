# Milestone 62: People swim and return to shore

## Status
Implemented, awaiting Chris’s playtest — authorised playground sequence, step 6; defect JIM-92.

## Objective
People entering deep water stay afloat, visibly swim toward a reachable shore, wade out and resume their routine. Water cannot leave them walking on the seabed or fighting two pose owners.

## Scope
- Shared water movement/pose helper for all twelve civilian bodies, interior residents and the five pursuer roles. Use their existing MPFB rigs, clothes and shadows.
- Clear swimming strokes, depth/shore transition hysteresis, bounded steering and shore queries; actual water/voxel/wreck clearance. Keep foot IK on wading/land and release it in deep water.
- Car ejection, knockback/ragdoll recovery and collection/release use the same transition. PhysicsSystem keeps buoyancy/body ownership. Avoid seabed snaps and returning walkers with a tilted swimming root.
- Swimmers cannot photograph, kick, fire or swing a net while their arms are swimming. Preserve perception/search, existing population caps, restart cleanup and the net-only ending.

## Depends on
M53 driving, M57 player ragdolls, M59–61 response roles, JIM-90/91 ocean repairs and existing human ragdolls.

## Acceptance criteria
- [x] Twelve civilian models and all pursuer roles visibly swim in deep water at 30/60/120 Hz; their head stays above the sampled waterline after entry, strokes move and transforms remain bounded.
- [x] A real shore route crosses water → wading → dry walking without hovering, snapping or foot IK fighting the swim pose; solid cover and wrecks block movement.
- [x] Interior residents, actual ejected civilian/police drivers, knocked people and carried/released people transfer ownership once and recover safely.
- [x] Attacks/activities yield to swimming. Ragdolls retain buoyancy until recovery, perception still expires, only the net ends the run.
- [x] Population, contacts and effects stay bounded and reset cleanly; units, focused/adjacent gameplay, native original-rig inspection, build and production pixel smoke pass.
- [ ] Chris judges swimming, shore exits and transition fluidity in play.

## Exit observation
Knock a person into water, follow their swim to the shore, and see them walk away. Repeat with a driver and an enemy, then collect/release one and restart without stranded bodies or poses.

## Review evidence — 2026-10-05

- Original reproduction: twelve civilian models walk on the seabed; all five response roles lack swimming at 30/60/120 Hz. First repair exposed a missing coast-distance adapter, ascent through voxel/wreck ceilings, stopping in shallow water and a 0.34–0.37 m foot snap. These now have retained regression cases.
- The final nine focused cases pass: all 36 civilian model/rate combinations, all 15 role/rate combinations, dry shore exits, covered ascent, actual civilian/patrol driver ejection, residents, physical ragdoll recovery, activity/attack cancellation, finite enemy memory, thin-wall avoidance and three clean restarts. Actual bubble-gun and giant-collector release tests subsequently reproduced 9–10 m seabed snaps; preserving the borrowed person’s release height repairs both paths.
- Shore head movement stays at/below 0.10 m per sampled frame; the largest 30 Hz foot step is 0.163 m, reducing at higher rates. All three rates reach ground at least 0.15 m above the local waterline, restore upright visuals and retain ground contacts.
- A thin submerged wall initially trapped/penetrated the 30 Hz swimmer (524 head/torso samples). Sweeping the route probe and the moving head now gives zero penetrations and successful detours at all three rates.
- Routing is spread over frames. For 36 simultaneous swimmers, isolated Pedestrians.update measured 2.0 ms median, 5.6 ms p95, 5.9 ms p99 and 9.3 ms max; the previous whole-search batch peaked at 35.3 ms. These are CPU system timings, not whole-game FPS. Repeated restarts retain 36 civilians, 53 actor proxies, 289 total bodies and zero constraints.
- All 168 unit tests and build pass. Native original-rig surface/underwater frames and six-second clip are console-clean and inspected. The 28-case adjacent suite and final nine-case tool/ragdoll/release suite pass, giving 43 distinct passing gameplay cases. Final production pixel smoke has distinct sky/ground pixels and no console errors. The native inspector also covers the real beach transition with the ordinary day/night shadow-update path.

Evidence under `output/iterate/`: `human-swim-{red,roles-diagnostic,transitions-red,shore-red,dry-red,ownership,ownership2,blocks,blocks2,final,units-final,build,native}.log`, `human-swim-native/`. Native inspector: `tools/inspect-human-swimming.mjs`. No visual/feel sign-off is claimed.

Final evidence: `human-swim-adjacent.log`, `human-water-release-{red,final}.log`, `human-swim-build-final.log`, `human-swim-smoke-final.log`, `human-swim-shore-native-complete.log`, `human-swim-shore/`. Two early asset-readiness waits and one failed-fixture reporting run stalled; their cause was not established. The retained final cases pass without those stalls. Chris’s swimming/shore-exit feedback remains pending.

**Separate review follow-up:** the native dry-ground ending leaves the commuter cross-legged at rest despite accurate contact heights. Logged as JIM-101 for a focused stationary-turn grounding repair before equipment work. This does not change the water ownership/traversal results above or claim final gait approval.
