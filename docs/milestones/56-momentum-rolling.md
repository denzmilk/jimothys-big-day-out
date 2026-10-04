# Milestone 56: Momentum-led fat rolling

## Status

In progress, authorised by Chris's sequential playground queue. Depends on M54 gait, M55 traversal, M23 original fat rig and M33/39 destruction/collection. Player ragdoll recovery follows as a separate milestone.

## Objective and scope

Holding roll at larger sizes builds momentum; slopes accelerate/decelerate it, steering bends the path, and releasing rolls to a stable recovery. Rotation follows actual travel and retains orientation through turns. Keep the original fat jiggly Jimothy, collected objects, continuous boulder-like ground trail, upward headbutt and net-only ending. Retain controlled kinematic movement with swept terrain contact under ADR-0002; airborne launches remain owned by PhysicsSystem. Review giant support latency and underside deformation separately, with issue-scoped commits.

## Acceptance criteria

- [ ] Regression traces distinguish lean flop and fat rolling. At 30/60/120 Hz a fat roll accelerates, coasts/brakes on release, gains downhill speed, loses uphill speed and turns without instant velocity reversal.
- [ ] Rotation follows travelled distance and contact direction, continues around turns and blends safely upright after braking; no stationary spinning, sudden release snap or accumulating pivot offset. Native original-rig slope/turn/release views are recorded.
- [ ] Grounded rolling retains a continuous carved trail; buildings, plants and living people remain collectable and move with the skin. Headbutt interruption, water, riding, launches, growth and restart transfer movement ownership safely.
- [ ] Collision prevents tunnelling through intact walls/ceilings; berms and drops have bounded contact/recovery. Lean movement and gait remain unchanged.
- [ ] Giant destruction queues and CPU costs are measured with live budgets; local fixes retain existing deadlines and work limits. Record any remaining frame-cost or visual defects explicitly.
- [ ] Chris judges weight, steering, release, bounce and impact readability — verified by user playtest.

## Exit condition

Chris grows fat, rolls downhill and around a corner, releases, then attacks a building → momentum and the original rolling body remain continuous, control returns safely, and destruction follows the path.

## Support-work prerequisite checkpoint

JIM-48 reduces exact support graph work and coalesces repeated building requests. The fixed Block route settles all jobs at 4.30 seconds from roll start (20.50 before); its unchanged three-second-after-release limit still misses by about 0.2 seconds. Block headbutt meets two seconds; Absurd does not. Native frame cost and underside deformation remain open. Full evidence/limits are in JIM-48. This does not complete the rolling acceptance criteria.
