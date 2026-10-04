# M64 — Washer, blower, vacuum and extinguisher feedback

**Status:** implemented, awaiting Chris’s playtest. First JIM-88 feedback family in the authorised equipment step, after M63.

Hold a continuous tool → see and hear its distinct flow leave the actual outlet → see the flow stop or react at the same obstruction/target that receives its effect → release or exhaust it and see/hear it finish cleanly.

## Scope and acceptance

- [x] Retain the four authored Blender models; measure their outlets from the source geometry. Flow begins at the transformed outlet at lean/large sizes and when moving/aiming. A wall between Jimothy and the outlet blocks use beyond it.
- [x] Washer: thick moving narrow jet, first-contact spray and droplets. Blower: broad outward gust bands with leaves/dust. Vacuum: inward spirals and food gathering along unobstructed paths. Extinguisher: dense white plume and visible recoil. Hits and misses remain readable in day/night views.
- [x] Visible paths and gameplay agree. The washer hits the first solid/physical surface; broad cones use occluded paths to their targets. Terrain/props block effects behind them. Food continues following the ground without passing through walls.
- [x] Distinct procedural starts, sustained motor/air/hiss and finish cues use one bounded tool audio graph. Contact feedback comes from the actual surface. No per-particle contexts or temporary scene lights.
- [x] Release, empty supply/energy, pause, blur, capture, ride, roll and reset stop emission/loops without clearing a successful final pulse early. Existing M63 costs, last-use behaviour, controls and finite pools remain intact.
- [x] Real prop/person/food fixtures, nearby muzzle obstruction, 30/60/120 Hz, audio signal/cleanup and repeated-use budgets pass, along with adjacent tools, native original-rig/HUD inspection, build and production smoke.
- [ ] Chris judges force, visual clarity, sound balance and uninterrupted play.

All other JIM-88 contracts remain open and follow in coherent families. No changes to the remaining twenty tool modes are implied by this milestone. Keep the full request in `vehicle-and-equipment-request.md` and the later playground sequence.


## Review and evidence

The first six delivery tests failed before implementation. The suction fixture initially placed the just-dropped blower across the intake: it now explicitly asserts that physical occlusion, then moves that real prop aside before expecting food movement. A source-range test reproduced 86,878 voxel queries at extreme debug fatness; the bounded action now performs zero queries and spends nothing. Normal giant fatness 250 remains supported.

The 31-case broad tool regression and 19-case final supply/effects follow-up pass. Eight focused final cases include original Blender measurements, nearby muzzle cover, actual prop/food/person effects, interruption/audio, 30/60/120 Hz and extreme-size rejection. All eight final cases pass: 33 distinct gameplay cases across these runs, plus 168 units, final build and production pixel smoke. Production and native consoles are clean. Eight seconds of isolated ToolSystem updates measure 0.3/0.2/0.2 ms p95 at the three rates; peak droplets are 60 of 96. This is not whole-game FPS and does not close JIM-48.

Native original-rig day/night reviews changed hard bubbles into a soft continuous extinguisher plume, narrowed gust arcs, added tumbling leaf shapes and made vacuum particles travel from real food. No console errors. A fatness-250 outlet-side view confirms the jet begins at the real nozzle; the ordinary giant camera obscures it (JIM-102). Cosmetic and speaker-mix approval remain Chris’s playtest. The initial fatness-15000 captures represent an unbounded debug size and are not a valid normal-giant visual benchmark.

Evidence under `output/iterate/`: `tool-outlets.json`, `tool-flow-{red,regression,final,reviewed}.log`, `tool-flow-range-red.log`, `tool-flow-{units,build,smoke}-final.log`, `tool-flow-native-final/`, `tool-flow-night/`, `tool-flow-plume/`, `tool-flow-plume-night/`, `tool-flow-giant-final/`, `tool-flow-giant-outlet/`. Retained scripts reproduce outlet measurements and native views.
