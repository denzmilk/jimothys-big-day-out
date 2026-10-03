# Milestone 45: Explore sixteen distinct island landmarks

## Status

Implemented, awaiting Chris’s playtest — 2026-10-03.

## Objective

Give the imaginary Seattle island sixteen recognisable destinations, spread across districts and connected to streets. Each has a distinctive silhouette, a food/tool visit reason, safe access and destructible structure. Existing scenery is not counted as a new landmark.

## Scope

Sixteen sites from the roster: observation tower, waterfront market, bridge troll, gasworks, locks, ferry terminal, monorail depot, glass conservatories, historic tower, observation wheel, music museum, boots-and-hat park, water tower, lighthouse, giant lobster diner and giant banana stand. Parody names/shapes follow the existing imaginary-city art direction.

## Out of scope

A geographical recreation of Seattle, ride simulation, tourist selfie AI, driver parking, and edible-building rewards (40).

## Dependencies

- **Depends on:** 43–44, current streaming/voxel/support systems.
- **Blocks:** revised food progression (40), tourist destinations (41) and driver visits (42).

## Acceptance criteria

- [x] Sixteen distinct sites reserve valid parcels in the active island plan without overlapping housing/roads/water or blocking access — test: `tests/landmarks.spec.js`.
- [x] Each has a distinct authored silhouette, readable name/map destination, food/tool cache and approach — test: `tests/landmarks.spec.js`; appearance verified by user playtest.
- [x] Structure and movable details collide, break and fall with support loss, preserving damage across streaming — test: `tests/landmark-destruction.spec.js`.
- [x] World/detail rendering and prop populations stay bounded; far views retain the silhouette without full simulation — test: `tests/landmarks.spec.js`; native timing recorded.
- [x] Restart restores all sites and clears loose pieces/caches consistently — test: `tests/landmark-destruction.spec.js`.
- [ ] Chris can navigate between varied landmarks and recognises their Seattle inspiration — verified by user playtest.

## Exit condition

Chris travels across the island → discovers sixteen visually different destinations, uses their tool/food caches and can demolish their structures without leaving floating scenery.

## Test plan

Fail layout/persistence/damage checks first. Inspect all sixteen exports/sites, plus native approach and destruction views. Run voxel, support, streaming, road and collection regressions, build and pixel smoke. Keep reference/source and editable asset recipes.

## Notes

Seattle inspiration is researched through Visit Seattle and Seattle Parks sources linked in the roster. Scenic Rainier is not counted toward the sixteen interactive destinations.


## Implementation and evidence

Sixteen original Blender sources and far GLBs share their geometry with offline 0.22 m voxel runs. Housing generation reserves each parcel and two street connections first. Each site has a numbered M-map destination, direction/distance waypoint, one of the sixteen advanced tools and a nearby food cache. Physical benches, shattering glass and shared support collapse are active; destroyed structures and spent caches persist across streaming. The locks have a real excavated basin using the existing swimming and ripple simulation, with gates extending below the waterline. The map pauses movement and capture, releases pointer capture and returns keyboard focus on close.

The four initial checks failed before integration. A reset fixture assumed the wrong chunk size; it now reads `VOXEL.CHUNK_XZ`. A held-movement reproduction caught and corrected simulation continuing under the map; a separate control check caught missing mouse-capture release. A dry-lock reproduction measured 2.42 m ground before the basin change; the revised test checks submerged ground, swimming and ripples. Removing the observation tower's supports clears its crown and produces 24 bounded falling structure pieces.

All sixteen model silhouettes and in-game site views were inspected, including new tall-tower frames and a collapsed tower view. They are simplified interpretations, with generic held-tool mounting and limited landmark interiors. The ferry is a static pier exhibit, the wheel/monorail do not operate as rides, and edible building rewards remain milestone 40. Appearance and gameplay feel await Chris.

Evidence under `output/iterate/`: `landmark-model-gallery.png`, `landmark-*.png`, `landmark-final-*.png`, `landmark-collapse.png`, `landmark-map.png`; checks in `landmarks-regression.log`, `landmarks-water-green.log`, `landmarks-collection.log`, `landmarks-units-water.log`, `landmarks-build-final.log` and `landmarks-smoke.log`. Native timing is recorded separately from automated correctness and user playability.


Validation: all 70 unit checks; 36 tool/interior/footpath/support/streaming checks; 18 landmark/water/swimming checks; eight giant/collection/cache checks; build and production pixel smoke pass. The combined suites overlap the focused landmark checks; they are not additive coverage counts. All native tour/collapse views reported no console errors. Map control verification and final native timing are retained in their own logs.


Final map-control run: all four cases pass (`landmark-map-controls-green.log`); production pixel smoke was rerun after that change and remains console-clean. Native Chrome/Metal, original Jimothy rig, 1280×800, military disabled, warmed stationary site approaches: Space Noodle / Rainforest Bubbles / Bandit Locks median **6.5 / 9.4 / 7.3 ms**, p95 **8.0 / 11.8 / 9.3 ms**, worst **16.9 / 12.7 / 10.4 ms** for update plus render submission. Draw calls: **146 / 212 / 149**. Each settles to zero pending columns/meshes with two active benches. This is a lean stationary microbenchmark, not a locked FPS or giant-destruction claim (`landmark-profile.log`).
