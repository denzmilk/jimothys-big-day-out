# Milestone 45: Explore sixteen distinct island landmarks

## Status

Planned — Chris requested many more than three landmarks and approved tools → landmarks on 2026-10-03.

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

- [ ] Sixteen distinct sites reserve valid parcels in the active island plan without overlapping housing/roads/water or blocking access — test: `tests/landmarks.spec.js`.
- [ ] Each has a distinct authored silhouette, readable name/map destination, food/tool cache and approach — test: `tests/landmarks.spec.js`; appearance verified by user playtest.
- [ ] Structure and movable details collide, break and fall with support loss, preserving damage across streaming — test: `tests/landmark-destruction.spec.js`.
- [ ] World/detail rendering and prop populations stay bounded; far views retain the silhouette without full simulation — test: `tests/landmarks.spec.js`; native timing recorded.
- [ ] Restart restores all sites and clears loose pieces/caches consistently — test: `tests/landmark-destruction.spec.js`.
- [ ] Chris can navigate between varied landmarks and recognises their Seattle inspiration — verified by user playtest.

## Exit condition

Chris travels across the island → discovers sixteen visually different destinations, uses their tool/food caches and can demolish their structures without leaving floating scenery.

## Test plan

Fail layout/persistence/damage checks first. Inspect all sixteen exports/sites, plus native approach and destruction views. Run voxel, support, streaming, road and collection regressions, build and pixel smoke. Keep reference/source and editable asset recipes.

## Notes

Seattle inspiration is researched through Visit Seattle and Seattle Parks sources linked in the roster. Scenic Rainier is not counted toward the sixteen interactive destinations.
