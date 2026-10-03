# Milestone 52: Buildings cave in and rubble shares physics

**Status:** implemented, awaiting Chris’s playtest · **Depends on:** 22, 27, 29, 33, 38, 45.

## Objective and scope

Chris requests that buildings cave in and break apart when nothing supports them, and that visible destruction debris interacts physically with moving objects, including cars, animals and other debris. This is a coupled destruction pass: repair support detection first (JIM-73 follow-up), then physical rubble contact (JIM-82). Preserve the original-cell building appearance, rolling collection, persistent damage and bounded simulation work.

## Acceptance criteria

- [x] Support follows actual remaining voxel/terrain contacts after ordinary digging as well as giant channels. Disconnected pieces inside a coarse cell cannot inherit support. Connected spans retain real surviving supports. **Checks:** voxel support units and generated-building browser reproductions.
- [x] Removing a building's base drops the remaining unsupported sections into visible, falling pieces; partial cuts retain genuinely supported sections. Houses, taller buildings and landmarks share the path. Damage survives travel; restart restores the structure and clears owned debris. **Checks:** collapse/support/landmark browser checks.
- [x] Visible solid debris (building pieces, voxel rubble, car/furniture parts, glass and soil clods) has shared physics contact. Debris can strike and stack against other debris; filters do not make a whole family intangible. Initial overlaps avoid explosive self-collision. **Checks:** collision/stacking/spawn regressions.
- [x] Cars and other moving props impart motion to debris. Jimothy, people/enemies and environment creatures interact with nearby rubble; substantial piles obstruct/support movement instead of being walked through. Actor rigs and ordinary ground walking retain their existing behaviour. **Checks:** actor/vehicle/rubble browser cases and adjacent gait/ragdoll tests.
- [x] Streaming, collection/release, sleep/wake, lifetimes and restart do not leave invisible bodies or leaked registrations. Collapse scans, active bodies and contact queries stay bounded; record native collapse timing and visible limits. **Checks:** lifecycle/budget tests and native inspection.
- [ ] Cave-in motion, breakup scale, rubble weight and performance feel right to Chris. **Verified by user playtest.**

## Exit condition

Chris removes a building's lower supports → the upper structure caves in as physical sections. Driving, walking or rolling through the resulting rubble moves smaller pieces and meets resistance from substantial ones; loose pieces collide with one another and can join Jimothy's rolling body.

## Limits

Use the existing voxel world and cannon-es ownership. No body per intact voxel, unbounded permanent rubble, new physics engine, material-strength model or unrelated wanted-system changes. Dust, smoke, bubbles and sparks remain particles; solid chunks are physical.

## Verification

Record failing baselines before implementation, focused and adjacent tests, native captures/timings, and build/production pixel smoke here.

### JIM-73 support repair

Five support units and five unique generated-building/adjacent browser cases pass (the channel case passed its focused rerun after nearest-first scheduling). New ordinary-dig, disconnected-cell and thin-cut units failed before implementation; house/apartment browser baselines retained all 4,077 / 51,694 upper cells. Both now remove all sampled cells and create falling registered bodies. Native cave-in inspection is console-clean; build and production pixel smoke pass. Captures/logs: `output/iterate/collapse-*`. The coupled JIM-82 work below completes debris breakup/contact and records native timing.

### JIM-82 implementation and verification

- Shared collision filters, pair-specific spawn separation, compound wall hulls, physical soil clods, active-only gravel bodies and SAP broadphase are implemented. Sections retain their original voxel appearance and use volume-based mass; the live cap is 48.
- Nearby walking actor proxies move gravel and loose objects. Heavy rubble joins traffic obstacles; driven kinematic props retain motion velocity for contact. Human impacts use the incoming speed before the solver stops the falling piece. Feet/obstacle queries include nearby rotated rubble shapes, and stacked sleeping bodies wake when their support disappears.
- Sixteen rubble units and all 105 project units pass. Red baselines cover disabled filters, missing actor contact, absent physical ground, hollow-box volume, pile sleep/wake, pre-solve human impacts and traffic obstacles. Nine unique focus browser cases now pass, including house/apartment/landmark collapse, persistent damage, slab landing/removal, actual pedestrian knockdown, soil expiry/reset and underwater creature proxy lifecycle. One landmark travel run timed out; its unchanged focused rerun passed in 38.6 s. Initial browser failures from a timestamped duplicate event module were discarded after restarting Vite.
- Native original-rig before/after inspection: `output/iterate/rubble-{before,after}.png`, `rubble-native.json`. The final 480-frame live-budget house collapse is console-clean: 42.3 ms median / 47.3 p95 / 72.9 max for update plus render submission; physics 7.1 / 9.4 / 11.5 ms. The sample reaches 420 world bodies and 48 building sections. An earlier checkpoint was lighter (300–392 bodies; 18.4 / 22.3 / 148.7 ms), so these are not matched before/after performance measurements. The captures show separated walls/roof sections settled into the damaged house. JIM-48 remains open; these are local CPU/submission measurements, not a general FPS claim.
- The final 100.8 m Absurd roll keeps 64 attached objects, including building sections, cars, plants, people and animals. It removes 442,397 cells during movement and reaches 543 world bodies. Median/p95/max update plus submission is 59.1 / 101.9 / 161.0 ms; physics is 8.0 / 11.8 / 19.5 ms. All 33 queued meshes clear after six deterministic settling seconds, with one support job still queued. The instrumented repeat identifies street traffic (median 11.7 ms), physics (8.6 ms) and pedestrians (5.4 ms) as substantial ongoing costs; voxel damage/mesh work still respects its slices. No console errors. Evidence: `rubble-giant-native.log`, `rubble-giant-profile.log`, `rubble-giant-{roll,floor}-400.png`. The repeat also captures underside skin stretching at maximum growth, recorded as a JIM-69 follow-up. Giant performance and model polish are not signed off by this pass.
- All 56 unique focused/adjacent browser cases pass across targeted runs: collapse, landmark damage, shared rubble, building contact, vehicle breakup, body weight, glass, actor grounding, ragdoll/capture, pedestrian activities, support loss, traffic and water. The original slinking gait and eight loaded-rig/footing checks pass. Studio ground fixtures now expose the physical-ground and ceiling queries used by the controller; their movement thresholds are unchanged. Logs: `rubble-focus-clean.log`, `rubble-repairs.log`, `rubble-adjacent.log`, `rubble-final-adjacent.log`, `rubble-glass-gait.log`, `rubble-gait-final.log`, `rubble-gait-fixtures.log`. Build and final production pixel smoke pass with no console errors. Pixel readback is sky `[218,179,119,255]` and ground `[59,67,70,255]`; the real comet opening hands control back and state advances. Log: `rubble-smoke-final.log`. An earlier smoke attempt timed out during asset readiness while other browser checks were running; the isolated rerun passes unchanged.

The original glass test required every shard to settle within 0.5 m of bare terrain. Shared contact intentionally allows support on wreckage: the trace shows slow shards at matching physical surfaces or active contacts, about 1–3 m above terrain. Its check now retains the <1 m/s vertical-speed bound and requires a physical surface or contact. Pile sleep/wake units separately prove supported stacking and falling after removal. The car settling assertion remains unchanged; the corrected birth-overlap constraint passes it. Evidence: `car-contact-debug.json`, `glass-contact-debug.json`, `rubble-overlap-red.log`, `rubble-all-units-final.log`.
