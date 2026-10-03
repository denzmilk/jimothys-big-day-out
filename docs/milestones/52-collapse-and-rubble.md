# Milestone 52: Buildings cave in and rubble shares physics

**Status:** in progress · **Depends on:** 22, 27, 29, 33, 38, 45.

## Objective and scope

Chris requests that buildings cave in and break apart when nothing supports them, and that visible destruction debris interacts physically with moving objects, including cars, animals and other debris. This is a coupled destruction pass: repair support detection first (JIM-73 follow-up), then physical rubble contact (JIM-82). Preserve the original-cell building appearance, rolling collection, persistent damage and bounded simulation work.

## Acceptance criteria

- [x] Support follows actual remaining voxel/terrain contacts after ordinary digging as well as giant channels. Disconnected pieces inside a coarse cell cannot inherit support. Connected spans retain real surviving supports. **Checks:** voxel support units and generated-building browser reproductions.
- [ ] Removing a building's base drops the remaining unsupported sections into visible, falling pieces; partial cuts retain genuinely supported sections. Houses, taller buildings and landmarks share the path. Damage survives travel; restart restores the structure and clears owned debris. **Checks:** collapse/support/landmark browser checks.
- [ ] Visible solid debris (building pieces, voxel rubble, car/furniture parts, glass and soil clods) has shared physics contact. Debris can strike and stack against other debris; filters do not make a whole family intangible. Initial overlaps avoid explosive self-collision. **Checks:** collision/stacking/spawn regressions.
- [ ] Cars and other moving props impart motion to debris. Jimothy, people/enemies and environment creatures interact with nearby rubble; substantial piles obstruct/support movement instead of being walked through. Actor rigs and ordinary ground walking retain their existing behaviour. **Checks:** actor/vehicle/rubble browser cases and adjacent gait/ragdoll tests.
- [ ] Streaming, collection/release, sleep/wake, lifetimes and restart do not leave invisible bodies or leaked registrations. Collapse scans, active bodies and contact queries stay bounded; record native collapse timing and visible limits. **Checks:** lifecycle/budget tests and native inspection.
- [ ] Cave-in motion, breakup scale, rubble weight and performance feel right to Chris. **Verified by user playtest.**

## Exit condition

Chris removes a building's lower supports → the upper structure caves in as physical sections. Driving, walking or rolling through the resulting rubble moves smaller pieces and meets resistance from substantial ones; loose pieces collide with one another and can join Jimothy's rolling body.

## Limits

Use the existing voxel world and cannon-es ownership. No body per intact voxel, unbounded permanent rubble, new physics engine, material-strength model or unrelated wanted-system changes. Dust, smoke, bubbles and sparks remain particles; solid chunks are physical.

## Verification

Record failing baselines before implementation, focused and adjacent tests, native captures/timings, and build/production pixel smoke here.

### JIM-73 support repair

Five support units and five unique generated-building/adjacent browser cases pass (the channel case passed its focused rerun after nearest-first scheduling). New ordinary-dig, disconnected-cell and thin-cut units failed before implementation; house/apartment browser baselines retained all 4,077 / 51,694 upper cells. Both now remove all sampled cells and create falling registered bodies. Native cave-in inspection is console-clean; build and production pixel smoke pass. Captures/logs: `output/iterate/collapse-*`. Debris breakup/contact and budgeted native timing are still in progress under JIM-82.
