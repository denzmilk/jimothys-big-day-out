# Milestone 56: Momentum-led fat rolling

## Status

Implemented, awaiting Chris's playtest; authorised by the sequential playground queue. Depends on M54 gait, M55 traversal, M23 original fat rig and M33/39 destruction/collection. Player ragdoll recovery follows as a separate milestone.

## Objective and scope

Holding roll at larger sizes builds momentum; slopes accelerate/decelerate it, steering bends the path, and releasing rolls to a stable recovery. Rotation follows actual travel and retains orientation through turns. Keep the original fat jiggly Jimothy, collected objects, continuous boulder-like ground trail, upward headbutt and net-only ending. Retain controlled kinematic movement with the existing terrain contact solver under ADR-0002; airborne launches remain owned by PhysicsSystem. Review giant support latency and underside deformation separately, with issue-scoped commits.

## Acceptance criteria

- [x] Regression traces distinguish lean flop and fat rolling. At 30/60/120 Hz a fat roll accelerates, coasts/brakes on release, gains downhill speed, loses uphill speed and turns without instant velocity reversal.
- [x] Rotation follows travelled distance and contact direction, continues around turns and blends safely upright after braking; no stationary spinning, sudden release snap or accumulating pivot offset. Native original-rig slope/turn/release views are recorded.
- [x] Grounded rolling retains a continuous carved trail; buildings, plants and living people remain collectable and move with the skin. Headbutt interruption, water, riding, launches, growth and restart transfer movement ownership safely.
- [x] Existing wall, ceiling, partition and ledge contact regressions remain intact; hard landings bounce once and release restores control over drops. Lean movement and gait remain unchanged. This checkpoint does not introduce general continuous collision detection.
- [x] Giant destruction queues and CPU costs are measured with live budgets; local fixes retain existing deadlines and work limits. Record any remaining frame-cost or visual defects explicitly.
- [ ] Chris judges weight, steering, release, bounce and impact readability — verified by user playtest.

## Exit condition

Chris grows fat, rolls downhill and around a corner, releases, then attacks a building → momentum and the original rolling body remain continuous, control returns safely, and destruction follows the path.

## Support-work prerequisite checkpoint

JIM-48 reduces exact support graph work and coalesces repeated building requests. The fixed Block route settles all jobs at 4.30 seconds from roll start (20.50 before); its unchanged three-second-after-release limit still misses by about 0.2 seconds. Block headbutt meets two seconds; Absurd does not. Native frame cost and underside deformation remain open. Full evidence/limits are in JIM-48. This does not complete the rolling acceptance criteria.

## Rolling implementation and review

`RollMotion` integrates powered acceleration, projected gravity, size-limited steering and braking. Quaternion rotation accumulates actual travelled distance divided by radius around the contact normal; stationary bodies do not spin, turns retain orientation and airborne bodies retain angular momentum. Growth is excluded from travelled distance. Release blends upright at a bounded rate. Swimming/riding/launch/reset hand off pose ownership, and large headbutts still interrupt/resume rolling. Tuning lives in `MOMENTUM_ROLL`.

**Red → green:** the original fat roll assigned 10.651 m/s on all tested grades and jumped 1.76–1.82 radians on release. At fatness 90 the repaired downhill/flat/uphill speeds are approximately 11.27 / 10.625 / 9.98 m/s; first 0.1-second speeds are 2.68–2.85 m/s, with 1.18–1.88 m coasting. Maximum sampled orientation increments at 30/60/120 Hz are 0.20 / 0.10 / 0.055 radians. Release finishes at zero speed/upright. Review caught two transitions: repeated downhill drops held the move after key release, and positive bounce velocity counted as a second landing. Both have passing regressions.

The channel test previously assumed immediate top speed and required 20 m in 1.1 s. Momentum intentionally changes that launch timing (17 m in that interval). The revised fixture covers more than 20 m within a bounded two-second roll and retains every route-depth, removal, reset and three-second-after-release assertion. It passes, with sampled 3.21–3.49 m depths and no pending jobs. This different route does not erase the fixed-route JIM-48 failures above.

**Verification:** all 142 units; final fourteen movement/building/weight/water/ownership browser checks; army headbutt/resume; channel; build and production pixel smoke pass. Earlier giant body/identity/collection/jet integration checks pass except the release case, which passes after the repair. Native original-rig lean, fat and giant slope/turn/release clips: `output/iterate/momentum-roll-native/fat-{0,90,250}.mp4`. Tools: `inspect-momentum-roll.mjs`, `stability-performance.mjs`. Logs: `momentum-roll-{red,integration1,transitions2,adjacent,units,build,smoke}.log`, `momentum-channel{,-route}.log`.

**Limits:** native live-world Medium/960×600 profiling records giant update plus render submission at 46.4 ms median / 61.2 p95, max 80 ms over 65.7 m. It ends with three pending destruction jobs; it is not a presented-FPS measurement or a matched performance improvement. See `momentum-world-native/report.json` and `giant-roll.png`. Giant underside folds remain severe (JIM-69); repair follows separately. Chris must judge steering, weight, release, bounce and impact readability in play.
