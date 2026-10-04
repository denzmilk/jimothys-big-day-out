# Milestone 58: Destruction-led wanted pacing

## Status

Implemented, awaiting Chris’s playtest — 2026-10-04. Authorised queue step 4, JIM-35.

## Objective

Minor mischief attracts the early response; large player-caused damage earns the upper wanted tiers with time to react. Remove the military's ability to raise Jimothy's wanted level through its own damage.

## Scope

- Bound nuisance credit, suppress repeated fear reports from the same person, and rate-limit tool nuisance. Keep the existing first three response thresholds and net-only ending.
- Track player/military/spawn/unknown causes through queued damage, ground channels and support collapse. Conservatively withhold mixed/unknown collapse credit. Count actual removed volume and intact cars wrecked once; ground has a lower weight than buildings.
- Require a delay for each upper tier. Keep hiding/decay, restart safety and bounded bookkeeping. Values live in Constants.

## Out of scope

Kicking locals, police cars/guns and rifle troops follow in separate response milestones. This pacing repair does not claim those roles exist. Giant rendering/collapse latency remains JIM-48.

## Dependencies

- **Depends on:** M53 vehicle ownership, M57 impact response, existing structural support and heat/search systems.
- **Blocks:** staged response roles, later location risk/reward tuning.

## Acceptance criteria

- [x] Repeated scares, bins and tool effects cannot earn four/five stars. Fear cooldowns and tool-rate budgets are deterministic and bounded — test: `tests/wanted-pacing.test.mjs`.
- [x] Only player-caused destruction contributes damage heat, including delayed support collapse and car wrecks. Spawn/military/unknown work stays neutral; empty/repeated damage earns nothing — tests: `tests/wanted-attribution.spec.js`, queued-damage unit tests.
- [x] Measured minor ground/house/block examples produce distinct escalation. High-tier delays behave at 30/60/120 Hz, and hiding/reset clear pending escalation — test: `tests/wanted-pacing.test.mjs`.
- [x] Current paparazzi/net/search, military fixtures and actual-world damage still work; build, state stepping, native HUD and pixel checks are console-clean — focused adjacent browser cases and smoke.
- [ ] Chris finds early nuisance forgiving and full army escalation appropriately earned — verified by user playtest.

## Exit condition

Chris scares people or makes small ground marks → sees a limited early response; keeps wrecking substantial property → sees four then five stars build with a readable delay; escapes/hides → heat recedes.

## Test plan and baseline

`output/iterate/wanted-baseline.json` audits the existing event pipeline: 34 scares give 102 points/five stars, including 34 duplicate reports for one ID; 34 tool effects also give 102. A 250 m³ ground removal gives five stars; four 80 m³ military blasts give 128 points/five stars. These are synthetic inputs and timings, not claimed playthrough durations. A 120 m³ house gives 48 points/three stars. Preserve volume invariance across voxel resolution. Add red tests before changing behaviour, then inspect generated-world source attribution and HUD escalation. Keep human feel awaiting playtest.

## Implementation and evidence — 2026-10-04

- All nine new red regressions reproduced the old failures before changes. All **154 unit tests** now pass, including the volume-invariance test with an explicit player cause.
- The final **27-case gameplay batch** passes: actual terrain and neutral queued blasts, a generated craftsman cave-in, one-time car ownership credit, continuous-channel volume, real pedestrian fear/re-approach, upper-tier HUD/restart, existing heat/capture/hiding, military and radar/arrival checks. `output/iterate/wanted-adjacent.log`.
- Initial attribution batch: 4/5 pass; the last neutral blast used another point's height and hit air on a slope. The fixture now samples its own ground; unchanged no-credit and nonempty-removal assertions pass. `wanted-browser.log`.
- Synthetic volume outcomes after 30 seconds: 20 m³ ground = 0.3 heat/zero stars; 250 m³ ground = 3.75/zero; 120 m³ structure = 48/three; 5,000 m³ structure = 2,000/five. These are volume examples, not claimed generated-building sizes.
- Four/five-star arrival: 12.033/24.033 seconds at 30 Hz, 12/24 at 60 Hz, 12.008/24.008 at 120 Hz. Nuisance caps at 45; the tool budget accepts at most a six-point burst plus three points/second. Fear repeats wait 30 seconds and bookkeeping caps at 256 IDs.
- Ground weighs 0.015 points/m³; structures retain 0.4; cars add 12 once. Thresholds are 10/20/35/400/1800. Hiding cancels a pending escalation and drains at the larger of two points/second or 8%/second. All values are in Constants.
- Military fixtures explicitly seed their intended tier and corresponding threshold, because those tests cover unit behavior; normal escalation is independently covered above. Existing giant-at-four tank behavior remains pending the separate full response pass.

Two further car/explosion cases pass, including actual driven-crash heat credit (`wanted-car-adjacent.log`), for **29 unique focused/adjacent browser cases**. Build and production pixel smoke pass (`wanted-build.log`, `wanted-smoke.log`), with no console errors. `tools/inspect-wanted-pacing.mjs` renders the original rig/world and captures the HUD at three/four/five stars; the countdown is readable and clears at the target. `output/iterate/wanted-native/report.json` is console-clean. This HUD inspection seeds points and suppresses enemies to isolate display timing; actual damage attribution is covered by the gameplay tests. This repair does not close giant latency JIM-48 or deliver the remaining response actors.
