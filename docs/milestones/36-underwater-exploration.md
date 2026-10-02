# Milestone 36: Swim between scattered underwater places

## Status

Implemented, awaiting Chris’s playtest; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Swim between scattered underwater places. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33, 35.

## Acceptance criteria

- [x] Dive/surface movement and underwater camera transitions make the seabed accessible and return to land reliable.
- [x] At least three wreck hull families and four ruin layout families have seeded damage, burial, orientation and growth variation, with deliberate empty space between sites.
- [x] Kelp/seagrass, schooling fish, seabed creatures and a larger slow swimmer populate suitable habitats; objects have breakage and collection interfaces.
- [x] Daylight rays respect cover/depth and fade at night; bubbles respond to swimming and selected environmental sources.
- [x] Streaming, animation, effects, damage and restart stay within the established budgets; inspect several distinct sites and intervening quiet stretches.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.

## Implementation

49 sites, separated by at least 145 m, mix rowboat, sloop and longboat wrecks with temple, stone ring, sunken quay and broken gate ruins. Wrecks retain licensed source faces, lose seeded sections and settle into a tilted/buried pose. Ruins are .22 m voxels with seeded missing stones and persistent edits. Kelp, seagrass, crab, starfish, three fish schools and a manta or whale surround suitable deep habitat. Schools remain continuous when the plant window shifts.

Q dives and Space rises; releasing both holds depth. Gamepad X/A mirror those controls. Swimming sweeps terrain, ceilings and intact ship faces. E and C still work below the surface, including physical collection and release. Broken kelp, wreck parts, artifacts and ruin rubble use existing physics/entity ownership. A Dev Level button cycles underwater sites for review.

Three active sites, 72 parts, 20 loose pieces, 13 fish, 220 plants, ten seabed creatures, 160 bubbles and seven shafts cap the nearby work. Day/night and depth control fog and sunlight; shafts check voxel cover and soften at the seabed. These are bounded visual shafts rather than full volumetric light transport. The existing wave/ripple and buoyancy simulation remains the water model.

## Evidence

- First failures: `ocean-layout-red.log`, `ocean-red.log`, `ocean-school-red.log`, `ocean-interaction-red.log`. Corrections include depth braking, preserving nearby schools, wreck contact and underwater collection.
- Native loaded-rig inspection of all seven site families: `ocean-native-final.log`, `ocean-*.png`; final small-wreck seating and softened shaft bases: `ocean-wreck-final.log`. No console errors. Site inspection forces nearby column completion; it is visual evidence, not an FPS measurement.
- All 39 unit cases pass (`ocean-final-units.log`). Build and production rendered smoke pass without errors (`ocean-final-build.log`, `ocean-final-smoke.log`).
- Editable Blender/source deliveries and licences are retained. The four ruin review files were regenerated from runtime descriptors (`ocean-ruins-blender-final.log`); descriptor parity passes. Recipes are documented in `assets/blender/ocean/README.md`.

- The combined 29-case ocean/water/beach/footing/environment/graphics/restart run passes (`ocean-final-regression.log`). A later travel profile exposed species replacement consuming another school's slots; its regression first fails in `ocean-species-red.log`. All ten underwater checks pass after reserving each species' school (`ocean-final-serial.log`). The parallel rerun had four loading/stepping timeouts and six passes; the serial rerun keeps the same assertions and 120-second per-test limit.
- Native Chrome/Metal, Apple M5 Pro, 1280×800, Medium, loaded rig, with no competing test/build: the complete 160.03 m daytime swim has median frame **8.3 ms**, p95 **8.9 ms**, worst **12.6 ms**; median CPU **1.1 ms**, p95 **5.1 ms**; median **32** calls. All three small species and one whale remain present; night removes the seven shafts; restart clears every ocean object/effect/damage record. Evidence: `ocean-profile-final.log`, `ocean-route.png`, `ocean-route-night.png`.
- Repeated 100 m city route from (-2,-40), same native setup, with military updates disabled for comparison: lean/House/Block median frame **16.0 / 18.7 / 20.3 ms**, p95 **20.4 / 24.7 / 35.1 ms**, worst **85.3 / 123.9 / 109.4 ms**. Median CPU **12.9 / 14.8 / 16.3 ms** and calls **166 / 208 / 368**. Block removes 18,439 cells and carries the 64-item cap; restart clears edits, attachments and pending work. The M33 route before beaches/ocean was **14.2 / 14.6 / 19.3 ms** median; these are single-run observations, not evidence of unchanged cost. The current world also has nine more planned buildings after the coast changes. Low at Block size measures **18.1 ms** median, **30.5 ms** p95, **92.2 ms** worst. Giant rampages still have hitches and are not consistently 60 fps. Logs: `world-final-profile.log`, `world-low-profile.log`; images: `world-final-route-*.png`. The enabled military battle is measured separately in milestone 34.

## Chris's review route

Open the production preview, use Dev → Level → beach, walk/roll over sand and swim out. Q dives, Space surfaces, Shift swims faster. Use “Visit next underwater site” to compare wrecks and ruins, then swim between sites. Break/collect a barrel or kelp, return after travelling away, and compare afternoon with midnight. Finally repeat a Block-size city roll with Medium/Low graphics and tier 5 military enabled. Judge variety, water/shore transitions, collection visibility and remaining hitching.
