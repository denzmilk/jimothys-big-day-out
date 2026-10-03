# Milestone 49: Readable enemy searches and local radar

**Status:** implemented, awaiting Chris’s playtest · **Depends on:** 19, 32, 34, 45, 48.

## Objective and scope

Chris asks for enemy search radii and a small radar that makes escaping strategic. This is one coupled pursuit/feedback feature. Foot pursuers investigate an approximate dispatch area, acquire a visible target over a short notice interval, chase confirmed sightings, then search the fixed last-seen location and give up. Walls, bushes, night and underground darkness affect visibility. Tanks navigate toward their last report and require sight before selecting a new shell target. Jets retain their committed, telegraphed attack passes.

An always-on, north-up local canvas map shows nearby streets/building footprints or sewer routes, Jimothy's heading, active landmark waypoint, enemy sight cones, investigation/search areas and committed military strike areas. Occluded cones are clipped to nearby geometry; separate colours/shapes and short text explain noticing/chasing/searching. A fixed draw cadence and bounded map sampling avoid a second world renderer.

## Acceptance criteria

- [x] New foot dispatches receive an approximate area; they do not learn a hidden target's subsequent position. **Checks:** `search-awareness.test.mjs`.
- [x] Brief distant glimpses raise visible awareness before pursuit. Breaking sight drains unconfirmed awareness. Close contact remains immediate; attacks require confirmation. **Checks:** `search-awareness.test.mjs`, `net-pose.spec.js`, `ragdolls-capture.spec.js`.
- [x] Losing a confirmed target searches the fixed last-seen area, repicks obstructed search goals, and returns to patrol on a finite clock. Noise draws attention to its own location. **Checks:** `search-awareness.test.mjs`, `pursuers.spec.js`.
- [x] Range/heading/awareness/search time are observable; night, bushes and underground shorten actual and displayed sight consistently. Radar separates floors and excludes incapacitated/carried actors. **Checks:** `search-awareness.test.mjs`, `radar-near-sight.test.mjs`, `search-radar.spec.js`.
- [x] Tanks do not select fresh hidden targets or turn their routes/turrets toward an unseen moving Jimothy. Existing locked shots/jet passes remain dodgeable. **Checks:** `search-radar.spec.js`, `military.spec.js`.
- [x] Radar shows local authored roads/building footprints and underground routes, player heading and selected landmark; range adapts within a fixed limit for giant size. Search circles stay at the remembered location. Wall-clipped cones and strike rings have distinct labels. **Checks:** `search-radar.spec.js`, `native radar captures`.
- [x] Radar is throttled, uses a bounded local cache, adds no WebGL camera, and resets cleanly. Existing capture, net pose, hidden escape, military, map pause and restart checks pass. A noisy sewer entrance supplies a concrete lead that pursuers can follow downstairs; an unwitnessed silent entry gives new dispatches only an approximate area. **Checks:** `radar-budget.test.mjs`, `search-radar.spec.js`, `heat.spec.js`, `underground.spec.js`.
- [ ] Chris can use the radar to skirt a sight cone, break sight behind a building, and leave a shrinking search timer behind. **Verified by user playtest.**

## Exit condition

Chris attracts animal control, watches its notice indicator fill, ducks around a corner, and uses the radar's fixed search area to escape while the enemy searches the wrong place. The display remains readable during ordinary movement and giant rampages.

Full-map pan/zoom and arbitrary waypoints remain milestone 13; the existing M destination map stays available. Squad radio, A* navigation and new enemy types are outside this request.

## Verification and limits

The new perception regressions were reproduced before their repairs: dispatch, notice, search expiry/re-pick, nighttime range, peripheral coverage, downhill cone clipping, outdoor channels, giant target height and restart consistency. Browser baselines also reproduced the absent radar, hidden tank aim and omitted distant jet strike. The final evidence comprises **83 passing units, 33 unique passing browser checks**, build and production pixel smoke. Browser runs: `output/iterate/search-first.log`, `search-final.log`, `search-retest.log`, `radar-final.log`; early red runs are retained alongside them.

The old sewer fixture assumed dispatch knew the exact hidden entrance. It now supplies an explicit bin-noise lead at that entrance and retains the descent/capture assertions. Quiet, unwitnessed entry deliberately leaves an approximate report. Existing net-pose, ragdoll, capture, military destruction, hidden heat decay and M-map focus checks pass.

Native original-rig 1280×800 Chrome/Metal captures show noticing → chasing → searching, then the sewer layer, with no console errors (`radar-*.png`, `radar-native.json`). These verify presentation, not Chris’s judgement of chase fairness.

Six moving radar contacts (four people, two tanks), 120 samples at each map range: **90 m median 1.1 ms / p95 1.7 / worst 1.8; 180 m median 1.1 / p95 1.6 / worst 1.8**. This measures radar processing/drawing only, with actor poses advanced between samples; it is not overall FPS or a giant-rampage benchmark. The earlier synchronous implementation cost about 10 ms per update. Sight work now yields after a ray at a 1 ms budget, capped at 12 ray jobs per game frame; cached shapes persist while replacements finish. Noise/vision state remains live. Map drawing is 5 Hz; terrain sampling is capped at 5,184 cells and visible contacts at 16. Evidence: `radar-budget-moving.log`, `radar-budget.json`, `radar-budget.test.mjs`.

The map is an authored street/building plan with live sampled sight shading; it does not erase building footprints after demolition. Fine cone edges are approximate, and cached cones can lag a moving actor briefly. Full-map pan/zoom/arbitrary waypoints remain M13. No squad radio or new pathfinding is claimed.
