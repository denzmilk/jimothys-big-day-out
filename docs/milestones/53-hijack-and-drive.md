# Milestone 53: Hijack and drive cars

## Status

Implemented, awaiting Chris's playtest — Chris selected cars first on 2026-10-04.

## Objective

Let Jimothy take a car from a visible driver, drive around the physical world and exit safely. This establishes rider ownership for later bikes/boards and NPC trips without duplicating traffic or physics bodies.

## Scope

- Existing six CC0 vehicles with visible MPFB drivers, timed hijack/boarding and fleeing displaced occupants.
- Keyboard/gamepad entry, throttle, steering, braking/reverse, handbrake, horn, seated Jimothy and follow camera.
- Car-sized swept terrain/prop contact, grounded wheels, crash damage/ejection, readable vehicle audio/particles and persistent displaced cars.
- Chris's in-scope follow-up: stronger low-speed pull and shallow-ditch recovery in forward/reverse, without driving through walls or increasing the top speed.
- Explicit interruption, size fit, water, streaming, pause/focus and restart handling.

## Out of scope

- Motorbikes, bicycles, skateboard tricks, wearable combat abilities and JIM-88 full tool-feedback pass, all recorded in backlog.
- M42 destination parking/visiting itineraries; police pursuit remains JIM-35.

## Dependencies

- **Depends on:** 27, 29, 32, ADR-0002, existing MPFB models and original Jimothy rig.
- **Blocks:** other rideables; provides occupant handoffs for M42.

## Acceptance criteria

- [x] Nearby stopped/slow cars offer entry; a visible seated driver is displaced once, then flees, while boarding takes time. Released drivers regain standing posture and grounded feet; short supported kerb bends are allowed, sustained seated crouches are not. Fast/distant/oversize/blocked entry fails with a reason — test: `tests/driving.spec.js`.
- [x] Keyboard/gamepad throttle, steering, brake-before-reverse, handbrake and exit move the actual car; walking/attacking/tool controls do not run simultaneously — test: `tests/driving.spec.js`; steering helper unit tests.
- [x] Wheels/rider follow sampled road grades, swept contact stops wall/car tunnelling, light props and people receive impacts, and sufficient crashes damage cars/eject Jimothy — test: `tests/driving.spec.js`. Chris's broader floating-car report needs separate coverage of grade transitions and parked/streamed cars.
- [x] From rest, pull forward and reverse out of a 0.9 m ditch with 0.45-grade sides; a solid wall still blocks the same controller. Low gearing preserves frame-rate-independent acceleration and existing top-speed/braking limits — tests: `tests/driving.spec.js`, `tests/driving-math.test.mjs`.
- [x] Exits choose supported unblocked door-side ground; destruction/collection/water/growth/capture/travel/reset restore one player/occupant/body owner with no leaks or duplicate drivers — test: `tests/driving.spec.js`.
- [x] Engine, skid, horn, door and crash cues plus contact/exhaust particles occur only in their appropriate states; pause/exit/reset stop loops, resources stay bounded — test: `tests/driving.spec.js` (audio signal and state), native rendered capture.
- [ ] Chris approves visible boarding/seated poses, handling/weight, camera, vehicle feedback and exits — verified by user playtest.

## Playtest follow-up — 2026-10-04

- [x] JIM-96: start and continue downhill on generated steep streets, through their lower junctions; repeat uphill/reverse and retain solid wall/car collision.
- [ ] JIM-95: moderate crashes/attacks preserve usable cars, while severe crashes and large Jimothy still trigger the approved explosion and physical breakaway parts.
- [ ] JIM-97: vehicle water entry creates a substantial speed/size-scaled splash and ripples, transfers momentum to physics and releases the rider; submerged rest/bridges do not retrigger it.
- [ ] Chris judges repaired handling and durability during play.

## Exit condition

Chris approaches a slow occupied car → hijacks it → drives/brakes/turns through the streets → knocks a prop or crashes → exits and resumes the rampage, with the original driver fleeing alive.

## Test plan

Fail new gameplay/ownership and pure driving tests first. Run traffic, contact, ragdoll, tools, water and restart regressions, unit suite, build and production pixel smoke. Inspect loaded original rigs and cabin/exit/crash poses. Record sustained driving resource/performance samples at multiple timesteps; do not treat headless timing as presented FPS or Chris's feel approval.

## Notes

Controls and full request are in [vehicle and equipment design](../vehicle-and-equipment-request.md). Tuning belongs in Constants.js; cross-system ownership uses events and GameState, and Cannon stays in PhysicsSystem. No second invisible player/car body or imported-model replacement.

## Verification — 2026-10-04

- **119/119 units:** `node --test tests/*.test.mjs`; `output/iterate/driving-units.log`.
- **18/18 focused browser cases in one final run:** `GAME_URL=http://127.0.0.1:4174 STATE_ONLY_TEST=1 npx playwright test --config playwright.audit.config.js tests/driving.spec.js`; `output/iterate/driving-complete.log`. Covers real car/rider movement, input, loaded rigs, audio signal, all six models, contacts, lifecycle and interruption.
- **44 unique adjacent cases pass across targeted runs:** activity lifecycle, traffic/heading/signals/streaming, car destruction, contact weight, human ragdolls/capture, grounding, tools/status ownership and water. The initial 42-case batch was 41/42: removing streamed drivers lost eight people and bodies. Scheduling bounded crowd replenishment repairs it; the corrected fixture retains exact before/after counts (289 bodies, 460 entities, 36 people, eight drivers) rather than increasing a limit. Logs: `driving-regression.log`, `driving-streaming-red.log`, `driving-ownership-final.log` under `output/iterate/`.
- Ditch regression failed at about 1 m of travel. Checking the proposed suspension pose before hull contact, plus low gearing, clears the 0.9 m ditch: 18.27 m forward / 10.00 m reverse in two seconds. The wall stops the same controller at 1.16 m. Logs: `driving-ditch-red.log`, `driving-ditch-green.log`, `driving-torque-{red,green}.log`. The ditch profile is an analytic collision fixture; the all-model test separately samples generated road terrain.
- Final six-model grade check keeps actual rendered tyre gaps below 4 mm and rider/car orientation within 0.001 rad. The previous rider tilt regression failed at 0.082 rad. Logs: `driving-rider-tilt-red.log`, `driving-final-safety.log`, `driving-complete.log`.
- Original-rig occupied/boarding/seated/follow/exit views and contextual HUD are inspected with no console errors: `node tools/inspect-driving.mjs`, `output/iterate/driving-visual.json`, `driving-*.png`.
- `npm run build` and `GAME_URL=http://127.0.0.1:4174 npm run test:smoke` pass. Production readback: sky `[118,125,114,255]`, ground `[59,67,70,255]`; console errors none. Logs: `driving-build.log`, `driving-smoke.log`.
- Serial warmed original-rig 960×600 Medium samples (`node tools/profile-driving.mjs`) run three seconds each at 30/60/120 Hz. Update plus render-submission median/p95 is **19.1/25.1, 15.1/25.0 and 14.5/20.8 ms**; maxima are **70.5, 67.7 and 69.2 ms**. All sampled frames remain moving/driving, travelling 40.77/40.56/40.45 m; at most 301 bodies and 12 vehicle particles. Peak shadow-refresh draws reach 684. No console errors. These are local CPU/submission measurements, not presented FPS or a hitch-free claim; the isolated peaks and older JIM-48 performance work remain open. Evidence: `output/iterate/driving-performance.json` and `.log`.

The full legacy browser suite was not rerun wholesale. Older giant collapse deadlines and rendering-budget failures remain under JIM-48. Handling, sound balance, boarding/camera readability and perceived weight still require Chris's playtest. This is an arcade terrain-following vehicle controller with bounded swept contacts, not a full tyre-force or airborne chassis simulation.

### Downhill fluidity repair — JIM-96

The generated steep street now clears 48 m in each direction at 30/60/120 Hz. Chassis fit, suspension/drop comparisons and smooth-surface collision are corrected; walls, shallow ditches, six-model contact, lifecycle and suspension streaming retain regression checks. Original-rig taxi frames cross the reported type of grade without stopping or crashing. Full evidence and the transient tyre-contact limit are recorded in JIM-96. Chris's handling sign-off remains outstanding.
