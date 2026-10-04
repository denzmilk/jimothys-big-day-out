# M65 — Air horn, disco ray and sick ray feedback

**Status:** implemented, awaiting Chris’s playtest. Authorised JIM-88 family after M64 and JIM-102. Depends on M63 supplies, M64 delivery queries and the retained human status controller.

Use one of these three tools → see a distinct path from its actual outlet to the first obstruction → see and hear the corresponding human reaction → watch it expire and the person resume control.

## Scope and acceptance

- [x] Preserve the three authored Blender models. Measure the horn mouth, mirror-ball emitter and sick-ray bore from editable sources; transform their actual outlets at lean/large sizes and all aim angles.
- [x] Air horn: visible compression rings in its occluded cone and an unmistakable horn blast; eligible reachable humans enter the existing brief stun. Disco and sick rays: narrow aimed beams stop at the first physical/voxel surface, with one eligible human affected. Nearby body-to-outlet walls block all three.
- [x] Disco: segmented coloured beam/core, contact flash and musical marks accompanying the retained dance. Sick: wavy green beam/core, contact bubbles and a readable queasy marker accompanying the retained sick pose. Misses have a visible, finite range and audible use. Preserve defined status lifetimes and alive release.
- [x] Distinct launch/contact/finish cues and short rhythmic/warbling feedback use the shared bounded audio bank. No extra AudioContexts or changing scene-light count. Drop, pause, blur, capture and restart stop audio ownership; effects use finite pools.
- [x] Supply/food energy is spent once per valid action; full status/effect pools reject before spending. Last-charge visuals/statuses finish after the physical empty throw. Existing controls, people/driver/swim/ragdoll ownership and restart remain coherent.
- [x] Failing-first cases cover actual retained humans, physical cover, missed off-axis people, nearby muzzle obstruction, final supply, size bounds, 30/60/120 Hz and cleanup. Adjacent tool tests, original-rig day/night/native views, audio signal, build and production smoke pass.
- [ ] Chris playtests aim clarity, effect strength, sound balance and status recovery.

The remaining seventeen tool feedback contracts stay open. No new wearable, grappling, food or vehicle feature is included here. Full targets remain in `vehicle-and-equipment-request.md`.


## Review evidence

The initial delivery/target/pool cases fail before implementation; the isolated sound test reports zero RMS for all three old tools after stopping pickup audio. First implementation passes eight focused cases. Review adds a ninth: a dancing person remains physical cover for a later beam. That regression first fails when the person behind them is affected. Status-owned people in the scene now participate in delivery occlusion, while collected meshes remain excluded. Cover fixtures explicitly restore released people to their controlled elevated test positions before a second shot, avoiding vacuous protection assertions after a ground snap.

Read-only Blender measurements are retained in `tools/measure-ray-outlets.py`; no models are replaced. Native original-rig day/night views show the horn rings/stars, coloured disco ribbon/music marks and wavy green sick beam/queasy face. The horn rings were thickened after daylight review. All three produce audio independently of pickup cues: RMS 0.051 / 0.068 / 0.163. Eight-second held use produces twelve shots at 30/60/120 Hz and peaks at one live pulse in that fixture. Hard caps are four pulses, eighteen marks and eight one-shot audio voices, with no extra lights or contexts.

All 37 broad focused/arsenal/flow/supply/water-release cases pass, followed by two pool/timing checks (38 distinct cases total). Six actual human statuses fill all eighteen marks, a seventh rejects before spending, and release clears every mark/owner. Isolated ToolSystem update p95 is at or below 0.1 ms at 30/60/120 Hz (browser timer resolution applies). All 168 units, build and production pixel smoke pass. Original-rig day/night/large consoles are clean. Large downward shots stop at nearby ground; a separate raised-aim view shows each clear beam/ring path beside the retained model. These checks do not establish speaker mix, gameplay feel or whole-game FPS. JIM-48 performance and JIM-69 skin limitations remain open.

Evidence under `output/iterate/`: `ray-outlets.json`, `tool-pulses-{red,audio-red,capacity-red,first,status-cover-red,regression,bounds,units,build,smoke}.log`, `tool-pulses-native/`, `tool-pulses-night/`, `tool-pulses-large/`, `tool-pulses-large-miss/`.
