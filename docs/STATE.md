# Session state

## Comet entrance — milestone 39 — 2026-10-03

**Implemented, awaiting Chris's playtest.** Each new run waits for its visible character/assets, then drops Jimothy 82 m through flame, embers and a smoky wake. A three-second descent ends in a flash, boom, shockwave, dust and pooled debris; a shallow voxel crater persists. The camera settles and normal grounded control returns at about 4.55 s. Score/heat start at zero. Restart replaces the whole sequence, and effect/audio resources have explicit bounds and cleanup. Click once while loading to unlock browser audio.

Verification: three entrance cases pass, including loaded-rig descent, input lock, shallow crater, walking out, audio cleanup and mid-sequence restart. All 27 adjacent movement/camera/footing/military/physics/restart/lighting checks and 44 unit tests pass; final build and production pixel smoke are error-free. The regression exposed an audio cleanup timeout; final lifetime/disconnection checks pass. Native captures were inspected. Independent native Chrome/Metal/M5 Pro, 1280 × 800 Medium: 420 rendered simulation frames at **8.0 ms median / 13.3 ms p95 / 129.5 ms worst update-plus-render submission time**; impact phase worst 16.1 ms. One descent hitch remains in that measurement, which is not an FPS sign-off. Crater depth is 1.124 m; 1,236 cells removed; no leftover effect particles or sound nodes.

Evidence: `output/iterate/comet-{red,final,audio-final,regression,units,build-final,smoke-final,profile}.log`, `comet-native-final.log`, `comet-{fall,approach,impact,crater,play}.png`. **Next:** reload **http://127.0.0.1:4174**, click while loading for sound, and judge the entrance's scale and crash feel. Prior world/food/interior playtest sign-off remains outstanding. No further implementation from this request is queued.

## Food and populated interiors — milestones 37–38 — 2026-10-03

**Implemented, awaiting Chris's playtest.** Milestone 37 is pushed as `8362b9e`: sixteen food identities/models, matching pickup names, actual floor support, vertical reach checks and a 96-pickup cap. Food assets share batches. Food/economy, asset/batch, restart, build and rendered smoke checks pass; native lineup/spill inspected.

Milestone 38 adds continuous seeded rooms/floors/stairs, 27 sourced Blender furniture deliveries and indoor MPFB residents. Furniture breaks, joins rolling collection and retains its dropped pose through travel. Residents walk/idle/flee, use floor-aware grounding and shared ragdolls; opposing hallway traffic can pass. Usable headroom determines upper floors. Nearby budgets are four floors, 64 furniture roots, 16 fragments and eight residents; cross-model BatchedMesh pools keep the two existing draw-budget regressions passing unchanged. Doors are open passages; hinged doors and house-specific lore remain deferred.

Verification: all 44 unit checks pass, along with interior behaviour, relevant food/streaming/graphics/pedestrian/ragdoll/traffic/voxel/restart regressions, final build and production WebGL pixel smoke. One software capture-test setup timeout passed when repeated in native Chrome. Two initial draw-budget failures were fixed by batching and pass unchanged. Native house/apartment/shop/warehouse views and actual Dev/keyboard entry were inspected without page errors. See milestone 38 for exact runs and limits.

Final native Chrome/Metal/M5 Pro, 1280 × 800, Medium, loaded rig, 100 m city route: lean/House/Block **12.9 / 13.5 / 17.9 ms median**, p95 **15.8 / 17.4 / 35.3 ms**, worst **59.6 / 72.3 / 98.1 ms**. Military is disabled for the matched route. Block carries 64 objects, including interior furniture and a resident, and removes 25,642 cells. Reset is clean. Large demolition still hitches; this is not a locked 60 fps result.

Evidence: `output/iterate/interior-final-*`, `interior-batches-green.log`, `interior-build-final.log`, `interior-smoke-final.log`, `interior-profile-final.log`, `interior-follow-final.log`, `interior-*.png`, plus milestone 37's food evidence. Preview: **http://127.0.0.1:4174**. Dev → Level → **Visit next building interior** cycles houses and commercial spaces. **Next: Chris's hands-on review of food recognition, indoor movement and furnishing variety.** The earlier world-pass playtest also remains outstanding; no additional feature work from this approved request is queued.

## Underwater exploration and completed world-pass sequence — milestone 36 — 2026-10-02

**Implemented, awaiting Chris’s playtest.** The approved sequence is now implemented: giant shape/continuous rolling/collection repairs → bounded demolition, batching and quality/draw distance → military tanks/jets → deformable beaches → diving and underwater sites. Earlier pedestrian/car/world work remains in place. Unrelated backlog features remain deferred.

Milestone 36 adds Q diving, Space ascent, depth braking, underwater camera/water response and collision against voxel ceilings/walls and wreck faces. There are 49 separated sites using three wreck and four ruin families with seeded damage, tilt and burial. Fine voxel ruins, breakable wrecks, collectible artifacts/kelp/rubble, schooling fish, manta/whale, seabed creatures, currents, sunlight shafts and bubbles use bounded nearby pools. Damage survives travel and clears on restart. Blender sources, export recipes, licences and exact ruin-review descriptors are retained. The Dev Level panel cycles sites.

Verification: all 39 unit checks pass; the combined 29-case ocean/water/beach/footing/environment/graphics/restart run passes. The final school-replacement correction passes all ten underwater cases serially after a parallel run suffered four loading/stepping timeouts. Build and production rendered smoke pass without console errors. Native views of all seven site families, a quiet swim stretch and midnight were inspected. The first species no longer takes every vacated school slot. A visible pillar gap was fixed separately as JIM-65.

Native Chrome/Metal/M5 Pro, 1280×800, Medium, loaded rig, no competing test/build: **160 m daytime swim: 8.3 ms median / 8.9 ms p95 / 12.6 ms worst**, 32 median calls; all species and daylight effects remain present, night removes shafts, and restart is clean. **100 m city route lean/House/Block: 16.0 / 18.7 / 20.3 ms median**, p95 **20.4 / 24.7 / 35.1 ms**, worst **85.3 / 123.9 / 109.4 ms**. Military updates were explicitly disabled for the city comparison; the separate enabled battle is in milestone 34. Block visibly carries 64 objects and removes 18,439 cells. Low Block is **18.1 ms median / 30.5 ms p95 / 92.2 ms worst**. Added world features cost time compared with the M33-only route; giant destruction still hitches and is not a locked 60 fps result. See milestone 36 for the complete comparison.

Evidence under `output/iterate/`: `ocean-final-units.log`, `ocean-final-regression.log`, `ocean-final-serial.log`, `ocean-final-build.log`, `ocean-final-smoke.log`, `ocean-profile-final.log`, `world-final-profile.log`, `world-low-profile.log`, `ocean-*.png`, `world-final-route-*.png`. Production preview: **http://127.0.0.1:4174** (4173 belongs to another project). Q dive / Space surface / Shift faster. Dev → Level has beach and underwater-site shortcuts.

**Next:** Chris's hands-on review of the complete sequence, especially Block-size collection/destruction, military dodge/recovery, shore transitions and underwater variety. No further feature implementation from this approved sequence is queued. Sand is shallow persistent compaction with partial settling; water is the existing surface/ripple/buoyancy model; sunlight shafts are a bounded visual approximation. Those limits remain documented in milestones 35–36 and ADR-0005.


## Structure-to-ground contact — JIM-65 — 2026-10-02

Implemented, awaiting playtest. A meshing gap discovered at underwater pillar bases also affected rigid structures beside smoothed terrain. The exposed fraction of the lowest side face is now retained. The failing geometry ray check passes, all 39 unit checks and 17 terrain/physics/beach cases pass, and build/production rendered smoke are error-free. Native temple inspection confirms the gap is closed. Evidence: `structure-ground-*`, `ocean-temple.png`. Milestone 36 remains in progress; final atmosphere and native travel measurements are next.

## Deformable beaches — milestone 35 / JIM-59 — 2026-10-02

Implemented, awaiting Chris’s playtest. Five beach regions have dry/wet sand, blended tidelines, longer outer shallows and modest dunes; roads and hills remain intact. Moving paws, rolls and impacts compact a sparse persistent sand field with partial settling and pooled grains. Rendering and contact use the same field; real craters disable the skin. Four sand/contact unit cases, fifteen beach/water/terrain cases three final beach/grounding cases and all three living-environment regressions pass. Build and production rendered smoke pass without console errors. Native beach/track captures were inspected (`beach-overview.png`, `beach-tracks.png`); the close view is for shallow paw dents, not large granular piles.

**Next:** authorised milestone 36 diving and sparse underwater sites. Three CC0 boat hulls and five animated Quaternius sea creatures are prepared in editable Blender and GLB deliveries; runtime integration remains next.


## Military response — milestone 34 — 2026-10-02

Implemented, awaiting Chris’s playtest. Licensed Blender tank/jet deliveries, road-following tanks, aimed turrets, telegraphed jet passes, swept shell collision, bounded destruction, physical breakaway parts and giant collection are integrated. Tanks arrive at tier 5, or tier 4 for giants; jets require tier 5 and giant size. Hits reset combo and launch/tumble Jimothy, with a brief camera kick and control recovery. Only the net ends runs. Six final military cases, twelve contact/physics cases, unit sphere sweep, build and production rendered smoke pass. Native 12-second loaded Block battle: median 14 ms, p95 16.8 ms, worst 35.4 ms, no errors; clean restart. See milestone 34 for evidence and asset credits.

**Next:** authorised milestone 35 beaches/deformable sand, then milestone 36 diving and underwater sites. Sand tests have been written first and currently fail because the implementation is absent.


## First-explosion shader stall — JIM-64 — 2026-10-02

Implemented, awaiting playtest. Keep the explosion PointLight visible with zero intensity between flashes: toggling its visibility changed shader light-count defines across the entire world. The stable-light regression passes. Matched native 12-second Block battle worst frame **4,432.9 → 50.2 ms**, with final median 16.2 ms / p95 18.9 ms, two shots/impacts, one launch and no errors. Reset clears military objects and restores kinematic control. Build/rendered smoke pass. Logs: `military-native-stable-lights.log`, `explosion-light-green.log`, `explosion-light-smoke.log`. Military work remains uncommitted; projectile collision refinement is next, then beaches/underwater.

## Size-slider ground preservation — JIM-63 — 2026-10-02

Implemented, awaiting playtest. Abrupt size changes now preserve physical feet by moving the collision centre with the radius. The test hook follows the real slider event. The failing 17.84 m foot drop is fixed; the actual dev control passes Block/Absurd/lean checks, and build/rendered smoke pass with the in-progress military code present. Military runtime/asset work remains uncommitted and continues next.

## Quality settings and distant town — milestone 33 — 2026-10-02

Implemented, awaiting Chris's playtest. Low/Medium/High control 350/700/1,400 m view distance, detail, pixel ratio, shadow resolution and live voxel work budgets. Offscreen distant pedestrian animation/AI updates less often; visible and nearby feet keep their normal cadence. Collision streaming expands for giant contact. The town retains 1,989 inexpensive building silhouettes, using the same quantised footprints, heights, roof styles and palette as the voxel buildings. Ready-column masking prevents overlap; damaged silhouettes remain hidden after unloading and reset correctly. Their fixed buffers reserve about 0.7 million vertices rather than 4.2 million. `render.drawCalls` is the whole renderer count; `voxels.drawCalls` remains a compatibility alias.

Verification: the two new quality/LOD regressions pass (`graphics-final.log`), plus 20 adjacent lighting, giant destruction, water, traffic and restart cases (`graphics-adjacent.log`), ten initial pedestrian/streaming cases and all 31 focused unit checks. Build and production rendered smoke pass with no console errors (`graphics-build.log`, `graphics-smoke.log`). Inspected all-preset day/night native captures; `quality-medium-14.png` and `quality-low-0.png` show continued town silhouettes, sky, water and working street illumination.

Controlled native Chrome/Metal/M5 Pro, 1,280 × 800, Medium, loaded rig, a straight 100 m road from (-2,-40), with no competing test process: lean/House/Block median frame **14.2 / 14.6 / 19.3 ms**, p95 **16.7 / 19.3 / 35.6 ms**, worst **97.1 / 77.7 / 112.1 ms**. Median CPU **10.9 / 10.9 / 15.0 ms** and median draw calls **180 / 218 / 380**. Block destroys 18,269 cells; collection and damage queues stay capped. This is improved responsiveness, not a locked 60 fps claim. Reset returns to 25 columns, zero edits/damage/attachments and no pending mesh work. Evidence: `native-distance.log`. The later reduction in distant buffer capacity leaves identical geometry; these timings precede that allocation-only change. The route's delayed canvas captures were black; visual evidence comes from the separate same-frame `quality-*.png` captures.

**Next:** continue approved milestone 34 military tanks/jets, then 35 beaches and 36 diving/underwater sites. New sources downloaded from Quaternius and Poly Pizza are being prepared in Blender; they are not yet integrated. Net-only endings remain unchanged.


## Ground-query optimisation — milestone 33 — 2026-10-02

Intact-ground support queries now consult the sparse structure index instead of scanning empty air above every road/wheel probe. Craters, tunnels and damaged ground retain the exact downward scan. Two focused checks verify bounded lookups and equality with a reference scan across structures, chunk seams and underground cavities; all 19 physics/paving/traffic cases pass (`indexed-ground-green.log`). Build and rendered smoke pass. A native diagnostic shows traffic and physics CPU costs falling; the final controlled route remains part of the quality/distance pass.

## Rendering checkpoint — milestone 33 / JIM-48 — 2026-10-02

Implemented, awaiting playtest; milestone 33 remains in progress. Cars/furniture/bushes share rigid instance batches while retaining original hit/physics/breakage assemblies. Plain colours are vertex colours; glazing stays separate. Chunk geometry uses bounded BatchedMesh buffers with per-object main/shadow frustum tests. Intact ground/asphalt can use 0.88 m render tiles only when the measured height error is below 2.5 cm; pavement joints, boundaries and damaged cells keep fine geometry. The physical voxel size stays 0.22 m. Road markings rebuild on layout/damage changes instead of every update.

All 12 MPFB deliveries now use one skinned draw with existing diffuse/normal atlases. Original positions, normals, weights, triangle indices, joints, bind matrices and animation streams compare exactly. Editable Blender sources remain unchanged; `tools/pack_pedestrians.py` records the delivery recipe. A native 12-person lineup drops from 98 to 13 calls including the floor, with 0.0901% of pixels differing noticeably (`people-pack-preview.log`, before/after PNGs). The final street-only comparison, forcing the same shadow pass both times, drops 891 → 278 calls with 0.0024% changed pixels (`batch-parity-final.log`).

Verification: both existing under-300 whole-renderer checks pass unchanged, including twenty blasts (`draw-budget-final.log`). Fifteen terrain/paving checks and 13 pedestrian/paving/ragdoll/capture/restart checks pass (`coarse-ground-green.log`, `packed-people-green.log`). The preceding 17 traffic/streaming and 14 car/physics/spare checks pass. A SAP broadphase experiment altered debris settling; it was reverted, and the failing check then passed (`debris-naive-green.log`). Focused batch/ground/voxel/asset tests pass. Build and production rendered smoke pass with no console errors and 287 calls after two seconds (`render-batch-build.log`, `render-batch-smoke.log`).

Native Block travel still needs CPU work: median CPU 26.5 ms, frame 30.1 ms, p95 frame 60.5 ms, maximum frame 248.8 ms, median 330 calls (`native-batched-block.log`, Metal/M5 Pro). It now performs real giant demolition, unlike the earlier baseline, and is a fixed-frame diagnostic rather than a final fixed-distance acceptance route. **Next:** quality/draw-distance controls, distant building silhouettes and measured CPU hot spots. Military, beaches and underwater work follow in the approved order.

## Giant demolition — JIM-61 / milestone 33 — 2026-10-02

Implemented, awaiting Chris's playtest. Giant headbutts and continuous rolling damage the buildings their physical sphere reaches. Surface damage uses sparse above-ground occupancy, with bounded work and coalesced roll contacts. Roads remain protected; deliberately aimed digs retain their existing smaller footprint. Debris and glass stay pooled; reset cancels queued damage.

Evidence: the new E regression first removed zero cells at Block size (`giant-impact-red.log`). All three giant and four glass cases now pass (`giant-index-green.log`), nine voxel work/damage unit cases pass, and 18 adjacent aiming/ordinary destruction checks passed before the sparse-index refinement (`giant-impact-green.log`; its obsolete raised-foundation assertion failed and was corrected to check authored terrain). Native loaded capture removes 22,375 cells, drains the queue and rebuilds all dirty meshes, with errors empty (`giant-impact-native.log`, before/after PNGs). Build and rendered smoke pass.

**Next:** rendering batches, draw-distance/quality controls, distant silhouettes, CPU work and final native route measurements. Continue military → beaches → underwater afterwards; all are approved.

## Demolition heat — JIM-35 — 2026-10-02

Implemented, awaiting balance playtest. Demolition now awards 0.4 heat per cubic metre, preserving wanted-level behaviour when voxel resolution changes. `tests/heat-volume.test.mjs` verifies equal-volume invariance and that a small hole no longer produces five stars. Build and rendered smoke pass (`giant-damage-build.log`, `giant-damage-smoke.log`); giant demolition/rendering work continues under milestone 33.

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Responsive world work — milestone 33 foundation — 2026-10-02

**Implemented, awaiting playtest; milestone 33 remains in progress.** Streaming generation and mesh rebuilding now yield within a column/chunk. Live updates budget 3 ms for generation and 4 ms for meshing; deterministic inspection uses fixed work slices. Previous geometry remains visible until replacement is complete, and the coarse island stays hidden beneath it. Saved edits remain authoritative while columns are unloaded or partly rebuilt. Boundary damage now exposes the adjoining chunk face (JIM-62).

Six focused voxel tests pass; all 29 relevant streaming, paving, destruction and underground checks pass (`voxel-work-green.log`, `staged-world-green.log`). Two existing renderer-call budget cases were excluded from this stage and remain tracked by JIM-48; they were not loosened. Build and production rendered smoke pass with no console errors (`staged-world-build.log`, `staged-world-smoke.log`).

Native Metal / Apple M5 Pro, 1280 × 800, 240-frame Block roll: observed worst frame fell from 2,041.9 to 123.3 ms; p95 fell from 439.1 to 60.4 ms. Mean frame time fell from 87.7 to 33.6 ms, while median rose from 23.6 to 29.8 ms because generation/meshing work is now distributed. The staged capture overlapped the separate smoke process, so this is a diagnostic improvement, not a final FPS sign-off. Logs: `native-before-block.log`, `native-staged-block.log`. Median calls are still 1,617. Native lean/House baseline is in `native-before.log` (its first Block attempt hit the harness timeout and was rerun separately).

**Next:** bounded giant surface demolition (JIM-61), then render batching/draw-distance/LOD and CPU work. Military, beaches and underwater content remain fully authorised after this milestone.

## Giant form and rolling contact — milestones 23–24 — 2026-10-02

**Implemented, awaiting Chris's playtest.** The original Blender raccoon/12-bone rig now grows through an authored radial field with a smooth coat merged into the same skinned draw. The giant torso measures 36.79 × 36.79 × 36.79 m at Block size and 72.43 m on each axis at Absurd. Head, tail and paws retain their original dimensions. Animation influence transfers to the torso outside each tiny socket, avoiding long creases when a giant tucks. The coat uses filtered fur colour and roughness instead of stretching the original photo atlas.

Held giant roll rotation follows travel beyond the first tumble; lean rolling retains its flop. Gameplay, streaming and the camera follow physical feet instead of the rotating render origin. Carried objects project onto the real grown surface, preserve their scale, revolve with Jimothy, and release through their owners' physics/AI. Surface projection has a six-contact-per-update budget.

Verification: 20 loaded-rig/body/footing checks pass (`giant-coat-checks.log`), including all limb size checks; all three giant tests pass again after the final coat material/inset change (`giant-final.log`). The preceding 27-case adjacent run passed walking, scratching, swimming, pursuit, loaded-rig recovery, collection/release and restart (`giant-adjacent.log`). Build and production rendered smoke pass, including pixel readback and an empty error log (`giant-build.log`, `giant-smoke.log`). The native Metal capture at `output/iterate/giant-street-carry.png` shows a giant carrying cars/street objects; release returns the count to zero with no page errors (`giant-street-final.log`). These checks do not sign off visual feel or establish performance.

**Next already authorised:** milestone 33's bounded demolition, generation/meshing, draw distance and native-GPU profiling. JIM-48/JIM-61 remain open. Then military, beaches and underwater exploration in milestones 34–36. The audit entries below describe the baseline before this repair.

## Approved full continuation — 2026-10-02

Chris approved the complete pass, explicitly including draw-distance optimisation, deformable sand/beaches and varied underwater ruins/wrecks/fauna/rays/bubbles. Proceed in order: existing milestones 23–24 giant repairs → 33 responsive destruction/performance → 34 military → 35 beaches → 36 underwater. Keep net-only run endings; use local deformable sand with bounded settling as the stated defaults. No repeat approval is needed for this sequence. Each coherent issue is tested, documented, committed and pushed separately; visual sign-off remains Chris’s.

## Giant Jimothy feedback — reproduced and planned — 2026-10-02

Chris's latest playtest reopens giant shape/collection. The interrupted SUV/pedestrian pass remains completed and pushed (`0df5441`, `b8ca85d`). **This follow-up is a loaded-game audit and revised plan; no giant or military runtime fix is claimed.** See [the audit](giant-audit-2026-10-02.md) for measurements, captures and limitations.

- Actual Block-size skin bounds are 33.14 × 15.03 × 50.10 m. World-space proportions are applied in body-bone axes; the collision/pivot/collector proxies disagree with the rendered body. JIM-24/JIM-49 and milestone 23 are reopened.
- Collection counts reach 64, but attached people sit metres from the skin. JIM-29/milestone 24 are reopened. JIM-60 records the held-roll animation stopping at 0.9 seconds while movement continues.
- JIM-61: the same aimed wall loses 56 / 538 / 0 / 0 voxels at fatness 0 / 90 / 250 / 400. At giant size the small blast sits above the building.
- JIM-48: synchronous mesh rebuilding peaks at 475 ms at Block and 1,938 ms at Absurd in a 90-update CPU probe. Draw calls also rise, but native-GPU FPS has not been measured. No page errors in the loaded-model reproductions. These diagnostics are not passing regression tests or a performance sign-off.

**Recommended next implementation:** repair existing milestones 23–24's giant form, pivot, sustained rotation and real surface attachments. The revised backlog then proposes **33 responsive giant destruction/performance → 34 military tanks/jets**. Beach deformation and varied underwater exploration retain their full briefs afterwards, without assigned milestone numbers. No new milestone files are active. Keep runtime changes issue-scoped and test actual skinned contact/visible outcomes, not just registry counts.

Military escalation is absent from the runtime. The current gameplan still ends runs only through the net; a question is pending on whether Chris wants military attacks to change that rule. Sand surface deformation versus granular piles is also still an unanswered preference. Neither pending preference blocks giant geometry diagnosis/repair. The earlier planning order below is superseded by this entry.

## Additional world requests — planning handoff — 2026-10-02

The interrupted pass is now pushed: `0df5441` fixes the SUV spare; `b8ca85d` adds six MPFB people and corrects short-leg running stride. Final verification is recorded below. Chris then asked for underwater sites/wildlife/rays/bubbles, soft beach sand and better draw distance/performance, and explicitly requested **finish the interrupted task, then plan these additions**.

Three concrete proposals are recorded under “Next world pass” in `docs/backlog.md`: **33 performance/draw distance → 34 beaches/deformable sand → 35 sparse varied underwater exploration**. No implementation or active new milestone is claimed. JIM-48 now includes Chris's poor-frame-rate report; JIM-59 tracks the hard shoreline. The latest rendered smoke reports 1,731 calls after two simulated seconds; this does not establish an FPS baseline or prove that out-of-view rendering is the only cause.

One preference is pending: deformable beach surface versus loose granular piles. Surface deformation is the recommended draft. Next action: confirm/revise the proposed scope/order, then promote the first milestone and measure a native-GPU town/coast baseline. Existing visible/feel work still needs Chris's playtest.

## Pedestrian variety — milestone 26 refinement / JIM-58 — 2026-10-02

**Implemented, awaiting Chris's playtest.** The roster expands from six to twelve authored MPFB people: student, walker, musician, tourist, pensioner and artist join the existing six. Twelve outfits/skin textures, nine hair assets and a fitted hat; age, height and build change the actual geometry and skeleton. Each has packed editable/game Blender sources and Idle/Walk/Run clips. Maximum asset size is 2.68 MB / 16,991 triangles; new GLBs add 14.23 MB. The active crowd remains capped at 36.

The shortest new body exposed JIM-58 on an uphill run at 120 Hz. Human stride now respects measured leg length, reducing its p95 planted-sole error from 13.2 cm to 3.4 cm. Hip/foot limits and test assertions remain unchanged. All 36 model/rate cases and 36 slope/model cases pass. The final 3 walking + 23 adjacent checks pass, including all 11 ragdoll bodies / 10 joints for every model, no body leaks, streaming/restart, scaring, collection, actual pedestrian traffic braking and the SUV spare. Logs: `pedestrian-stride-green.log`, `pedestrian-variety-adjacent.log`. Build and rendered production smoke pass with no console errors (`pedestrian-variety-build.log`, `pedestrian-variety-smoke.log`). The earlier 21-case run also passed before the narrow stride correction. Existing JIM-03/JIM-48/JIM-49 are not signed off or resolved by this pass.

Inspected Blender/runtime lineups and street captures are under `output/iterate/`: `mpfb-lineup.png`, `pedestrian-variety-game-row-1.png`, `pedestrian-variety-game-row-2.png`, `pedestrian-variety-street-walker.png`, `pedestrian-variety-street-musician.png`, `pedestrian-variety-street-pensioner.png`. Playtest: http://127.0.0.1:4174. New source recipes and rebuild notes are in `assets/blender/people/README.md`.

Next: Chris asked to finish this interrupted pass, then plan draw-distance/performance improvements, soft beach sand and a varied, scattered underwater environment. Planning follows in a separate docs change; those new features are not implemented yet.

## SUV spare tyre — JIM-57 — 2026-10-02

**Implemented, awaiting Chris's playtest.** The SUV's parented spare was scaled twice during Blender export. Flattening original world transforms before metre conversion fixes its size and mounting point. Original Kenney source remains preserved; editable SUV and runtime GLB rebuilt. Nine spare/heading/grounding/destruction checks pass; build and rendered production smoke pass with no console errors. The spare matches the original within one micrometre, does not move locally during road tilt and remains a separate fifth breakaway wheel. Evidence: `output/iterate/spare-green.log`, `spare-mounted.png`, `spare-smoke.log`.

The expanded roster and its verification are recorded above.

## Visible shadows and day/night — JIM-56 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Chris reported missing shadows and the day/night cycle. The fresh preview's clock already advanced, but the moon did not cast shadows and the Dev slider stayed at its initial value. Sun and moon now share the active shadow workload: one 2,048² local map at a time, five updates per second, with cached maps reused across switches/restart. Bins and voxel rubble cast/receive shadows; detached car parts preserve their source flags. The HUD shows time plus Dawn/Day/Dusk/Night, and the Dev Level slider follows live time while unfocused. The cycle remains 12 minutes.

Verification: day shadows change 48,415 ground pixels; midnight shadows change 23,452 (previously zero). A sunlit bin adds 2,309. A complete 48-sample clock cycle checks phase, sky, UI, midnight wrap and restart. The scoped regression passes 22/23 (`output/iterate/lighting-final-regression.log`); the remaining bin test passed after correcting its fixture to use a sunlit road (`lighting-bins-final.log`), without further runtime edits or a threshold change. Traffic, water, environment and car-destruction checks pass. Build and rendered production smoke pass with no console errors (`lighting-build.log`, `lighting-smoke.log`). Ordinary play was checked with `manualTime: false`; the time control also changes the actual scene. Inspected captures: `lighting-play-dawn.png`, `lighting-play-day.png`, `lighting-play-dusk.png`, `lighting-play-night.png`, `lighting-night-controls.png`.

No full unrelated-suite rerun was needed for this scoped lighting fix; existing JIM-03/JIM-48/JIM-49 remain open. JIM-48 still owns the scene rendering budget, so this is not an FPS sign-off.

**Playtest:** refresh http://127.0.0.1:4174. The clock appears under HEAT. Watch dusk arrive, or use Dev → Level → Time of day to compare midday and midnight shadows around Jimothy, cars and lamp posts. Chris's visual judgement remains open.

## Streetlights and controlled traffic — milestone 32 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Traffic follows authored right-hand lanes and smooth junction curves, with red/amber/green phases, stop lines, queues, blocked-exit checks and braking for pedestrians, Jimothy, cars and road damage. Damaged signals use a stopped yield and one crossing reservation at a time. Pavement lamps point over the road and illuminate at night. Lamps and signals retain physical breakage and rolling collection; stop bars/centre dashes follow street grades. Wide roads supply kerb parking. Clean traffic leaving the area is replenished even while Jimothy stands still; damaged cars retain saved state.

Final focused checks pass: 14 traffic/street-life checks (`output/iterate/traffic-right-hand-final.log`), complete signal-head coverage (`traffic-signal-placement-green.log`), all eight control behaviours after pavement fitting (`traffic-controls-final.log`), and 10 streaming/glass/street-life checks (`traffic-streaming-final.log`). All 301 lane segments agree with the imported cars' actual right-wheel positions. Queue gaps stay above 1.04 m; broken-signal crossing admits two approaches in turn with 4.30 m minimum separation. Twelve forced departures retain eight nearby cars, 295 bodies and 338 entities, without saved clean-car records. Actual pedestrians and Jimothy stop traffic.

The full suite passed **190/196** (`output/iterate/traffic-full-suite.log`). Five failures are the existing interrupted feast (JIM-03), two rig-growth checks (JIM-49) and two renderer-budget checks (JIM-48). The sixth exposed JIM-55: a downhill turn left a pedestrian foot out of reach. That fix is pushed separately as `6f5ae85`; the subsequent three walking checks and all 31 adjacent character/traffic checks pass (`traffic-ik-recovery.log`, `traffic-ik-adjacent.log`). Maximum planted-foot error falls from 0.197 m to 0.114 m without loosening assertions. The full suite preceded that narrow correction; the affected checks and build/rendered smoke were rerun afterwards. Production build and rendered smoke pass without console errors (`traffic-final-build.log`, `traffic-final-smoke.log`). Inspected captures: `traffic-day.png`, `traffic-night.png` and `traffic-signals-*.png`; the spawn area contains eight moving cars, ten parked cars, 26 lamps and 17 signal poles, with at most four local night lights. Signal colours remain distinct in daylight and darkness. The current production scene uses 1,720 whole-renderer calls; JIM-48 remains open, so this is not a performance sign-off.

**Playtest:** http://127.0.0.1:4174. Watch the closest traffic lights complete a cycle, step into a car's lane, then break a lamp/signal and inspect night lighting with the Level tab's time slider. Chris's judgement of stopping, turning and lighting remains open.

## Backwards cars — JIM-54 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Pushed as `ea70885`. Every imported car had its front axle along -Z while traffic drove along +Z. `StreetLife` now rotates the imported meshes once during template normalization, controlled by `STREET.CAR.MODEL_YAW`. Eight orientation/grounding/destruction checks pass in `output/iterate/traffic-heading-green.log`; production build and rendered smoke pass without console errors. All six models were visually inspected in `traffic-car-directions.png`. Actual travel now leads with the front axle. Milestone 32 adds the requested streetlights, lane traffic and curved junction steering.

## Jimothy idle animation and planted paws — milestone 11 / JIM-22 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Chris reported sliding feet and requested idle scratches and small movements. The loaded model now uses four world-space paw contacts, two-bone IK, lifted diagonal steps and a smooth crouched support height. Idle breathing, head glances, tail movement and a face scratch interrupt on movement/actions; rolls, hops and swimming release contacts. The corrected Blender rig keeps paw movement out of the torso while preserving the original shape, textures and 12 bones.

All seven final focused checks pass (`output/iterate/jimothy-animation-final.log`). They cover 30/60/120 Hz walking/scurrying, turns/stops, slopes, kerbs, zero-time stability, growth/action/teleport resets, scratch interruption, visible skin deformation, a real voxel blast and loading the rig mid-tumble. Worst measured flat stance drift is below 1 mm per frame; worst slope p95 sole error is 2.73 cm. The isolated paw pose formerly moved torso vertices 10.4 cm; the corrected rig measures zero. Character-space sole calibration reduces the difference between upright and mid-tumble loading from 9.4 cm to less than one micrometre. Final build and rendered smoke pass without console errors.

The full regression passed **176/181** (`output/iterate/jimothy-animation-full-suite.log`): the five failures remain JIM-03 interrupted feast, two JIM-49 rig growth checks and two JIM-48 renderer-budget checks. The full run preceded the final character-space calibration correction; all seven focused checks plus build/rendered smoke were rerun afterward. Roll/tuck, headbutt, growth movement, pedestrian IK, ragdolls/capture, swimming/beach transitions and restart passed. Ground contacts cover voxel terrain and paving; support on loose moving props remains a documented follow-up.

Inspected captures: `output/iterate/jimothy-idle-weights-rest.png`, `jimothy-idle-weights-look.png`, `jimothy-idle-weights-scratch.png`, and `jimothy-walk-0.png` through `jimothy-walk-5.png`. The asset integrity check preserves 39,991 triangles, 12 bones and all three embedded texture hashes; rest-surface differences are below one micrometre (export rounding). Blender sources and the reproducible weight recipe are in `assets/blender/jimothy/` and `tools/refine_jimothy_weights.py`.

**Playtest:** http://127.0.0.1:4174. Stand still for about 10 seconds to see the look and scratch, then walk/scurry across a kerb, turn and stop. Chris has been asked whether the paws feel planted. Animation feel remains unsigned-off.

## Living-world continuation — 2026-10-02

**Development; milestones 29–31 are implemented, awaiting Chris's playtest.** Milestone 28 also remains awaiting playtest.

- **29 — ragdolls and capture:** 11-body jointed knockdowns, recovery/collection and a telegraphed net swing with a size-resistant capture meter. Pushed as `836bd41`. Three final behaviour checks pass; full regression was 162/167 with the five existing JIM-03/JIM-48/JIM-49 failures. JIM-52 restart carry-over is fixed separately in `340e64e`.
- **30 — environment and lighting:** wind-reactive grass/flowers, animated cats/dogs/birds, pollen, a 12-minute sun/moon cycle and nearby lamp lighting. Pushed as `3cd2636`. Nine focused/adjacent checks and three final environment/lamps checks pass. Editable Blender sources, licences and rebuild recipe are preserved under `assets/wildlife/` and `tools/`.
- **31 — water:** a shared rendered/physical wave field, local ripples, textured translucent water, bounded reflections/splashes, dynamic buoyancy/drag and Jimothy paddling with beach exit. Pushed as `768898c`. The 13-case water/physics/ragdoll run and four final water checks pass. The final full run passed **170/175** in 26 minutes (`output/iterate/living-world-full-suite.log`), including a beach crossing with the real rig. Its five failures are the existing interrupted-feast case (JIM-03), two rig growth cases (JIM-49) and two renderer-budget assertions (JIM-48).

**JIM-53 follow-up:** the loaded Jimothy mesh now casts and receives world shadows. Checked separately after the full regression: build and rendered smoke pass, both flags are true, and a same-frame comparison changes 5,684 ground pixels outside the player bounds. `output/iterate/jimothy-shadow-after.log` and the inspected `jimothy-shadow-on.png` record the result. Awaiting playtest.

Builds and rendered production smoke checks pass without console errors. Inspected captures are in `output/iterate/`: `ragdoll-launch.png`, `ragdoll-land.png`, `ragdoll-recover.png`, `net-windup.png`, `net-holding.png`, `environment-day.png`, `environment-night.png`, `wildlife-*.png`, `water-swim.png`, `water-night.png`, `water-floating-car.png`. `water-beach-ui.log` verifies the actual Dev panel shortcut.

The water controller uses the visible belly's height, since its centre differs from the collision sphere. A depth threshold separates wading from swimming, and ground snapping no longer holds him on the seabed. ADR-0005 records that finite pond drainage and excavation flooding remain separate; this pass provides ocean surface simulation and local ripples.

**Playtest:** http://127.0.0.1:4174. Roll with **C**, headbutt with **E**, and compare net escape at lean and House size. **Dev → Level → Go to the beach** starts on dry land facing the sea; the same tab has a time-of-day slider. User judgement of animation, capture balance, lighting and water feel is still required.

## Raised footpaths — milestone 28 / JIM-51 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Streets have reserved 2 m pedestrian strips, 22 cm kerbs and 1.1 m concrete slabs with 18 mm recessed geometric joints. Paving remains part of the 22 cm voxel world. Street runs have level cross-sections and short planar grades; surrounding land and differently angled district grids meet them through gradual transitions. Civilian routes now use footpath cell centres while traffic stays on roads.

The coarse island backdrop now discards fragments over fully meshed voxel columns. This prevents it from covering a street cut or appearing inside a crater. Kerb faces preserve underground tunnel walls. Stairwell bases open into their adjoining bores, and grounded Jimothy settles onto the floor without stationary auto-stepping. Ground queries and meshing choose the same side of class boundaries.

Verification: the full 164-case run passed 156 checks and exposed three regressions, now fixed, alongside five existing failures. The final affected rerun passed 65/68, including all five footpath checks and the corrected aiming, sewer and landing cases. Its remaining failures are the existing interrupted feast (JIM-03) and two draw-call checks (JIM-48); two existing rig failures (JIM-49) remain in the full run. Logs: `output/iterate/footpaths-full-suite.log`, `footpaths-final-regression.log`.

Grade samples: 469 footpath points around spawn, 449 interior cross-sections with zero lateral height difference; 776 district joins checked. Production build and rendered smoke pass with no console errors, 36 people, eight moving cars and ten parked cars. The captured paving blast removes 79 cells and produces 14 live debris pieces. A real E-key headbutt separately removes 104 paving cells; normal movement crosses the kerb and remains grounded (`footpaths-headbutt.log`, `footpaths-kerb-crossing.log`). Captures: `output/iterate/footpaths-production-street.png`, `footpaths-production-slabs.png`, `footpaths-production-broken.png`.

Playtest at **http://127.0.0.1:4174**: inspect paving scale and kerb height, cross from road to footpath, watch a person turn on a slope, then aim down and headbutt paving with **E**. Chris's judgement is still required.

## Smooth pedestrian walking — JIM-50 — 2026-10-02

**Implemented, awaiting Chris's playtest.** Chris reported pedestrian walking jitter and jumping on angles. The old support switch released a large pelvis correction instantly: the reproduced hip jump was 0.555 m in one 60 Hz frame while the terrain rose only 0.012 m. `FootGrounding` now keeps world-space foot contacts, transfers through bounded swing arcs, selects the trailing foot after turns, and smooths pelvis height and foot rotation. Pedestrians turn toward a route before translating along it. Civilian and pursuer grounding reset when released from rolling collection.

The six-second real-street repro samples 12,924 person-frame transitions: maximum hip displacement is 0.050 m, maximum ankle displacement 0.139 m, and 95% of planted-foot errors are within 0.033 m. All six models pass uphill/downhill 50% grades and 45% cross slopes with stop/start transitions. Walk/run transitions and zero-time stability pass at 30/60/120 Hz. Tests: `tests/walking-ik.spec.js`; baseline: `output/iterate/ik-jitter-red.log`; final results: `ik-jitter-regression.log`. Build and production smoke pass without console errors. Eight production walking captures: `output/iterate/ik-walk-0.png` through `ik-walk-7.png`.

Focused bug-fix regression: **20/20 passed** across walking IK, grounding, pedestrians, street life and pursuers. The last full-suite baseline remains 151/156 from the car refinement below; this scoped fix did not rerun unrelated suites or change their five known failures.

Playtest the sloping streets near spawn at **http://127.0.0.1:4174**. Watch a person walk uphill, turn, stop and resume; Chris's judgement of the remaining body movement and foot contact is still required.

## Powered car destruction — 2026-10-02

**Milestone 27 refinement is implemented, awaiting Chris's playtest.** Chris requested car destruction at bigger size/power with explosions and breakaway parts. Chunky (fatness 25) reaches a 3.5 m headbutt blast and now triggers a fireball/flash, sparks and fading smoke. Weaker hits keep the previous glass/body damage tiers. Imported Kenney car geometry supplies separate roof, bonnet/rear, side, bumper, chassis and wheel pieces; all six models preserve every opaque triangle and their intact appearance.

Parts receive outward impulses, land, can attach during giant rolling and release, and expire after 24 active seconds. Car-fragment boxes ignore each other to avoid overlap explosions; they retain collisions with ordinary props and voxel terrain/walls. At most 72 street fragments and four effect bursts coexist. Old loose rubble is recycled when needed, held pieces are preserved, destroyed cars remain gone across streaming, and restart restores them. Shared cached geometry/materials and instanced effect buffers are reused.

Four new checks pass in `output/iterate/car-destruction-green.log`. The first 13-case adjacent run passed 12, with a stress timer case stopped by animal control ending the run; the final test isolates active cleanup time and asserts the run stays active. Production build and rendered smoke pass with no console errors. `car-destruction-headbutt-state.log` and `car-destruction-headbutt.png` show a real E-key headbutt at fatness 25, one explosion and detached parts. Additional captures: `car-destruction-before.png`, `car-destruction-explosion.png`, `car-destruction-parts.png`.

Full suite: **151/156 passed** (`STATE_ONLY_TEST=1 npx playwright test --workers=3 --timeout=240000 --reporter=line`, `output/iterate/car-destruction-full-suite.log`). The five failures match the previous baseline: interrupted feast (JIM-03), two rig growth checks (JIM-49), and two draw-call budget checks (JIM-48, still 900 draws against the legacy limit of 300). All four new destruction checks and adjacent glass, grounding, street-life, pedestrian and world-detail checks pass.

Playtest: **http://127.0.0.1:4174 → Dev panel → Jimothy → Chunky (25)**. Headbutt a parked car with **E**, then try stronger power and roll through its parts with **C**. Explosion appearance, threshold and feel await Chris's sign-off. Existing JIM-03, JIM-48 and JIM-49 failures remain separate work.

## Glass shatter refinement — 2026-10-02

**Milestone 27 glass shattering is implemented, awaiting Chris's playtest.** His “yes glass with shatter” confirmation extended the world pass: connected building panes clear together, imported car panes break independently, and both emit thin triangular shards. Lean hits break car glazing; a blast radius of 1.2 m or more also breaks the body. Broken panes persist across streaming; restart restores them.

`GlassShards` uses bounded physical bodies through `prop:*` events (72 maximum, seven-second lifetime). Shards attach to a giant rolling Jimothy and release; expiry/restart remove bodies and registry entries. Gravity and voxel ground/wall collision remain active. Prop-box collisions are excluded because glass spawned inside the cars' coarse cabin boxes was being launched 30–40 m upward.

Verification: all four new glass cases pass, including cross-chunk pane damage, persistence, lean/heavy hits, shard settling, collection/release, cap and cleanup. Focused adjacent run: 17/19 passed. Production build and real rendered smoke pass with no console errors. `output/iterate/glass-live-state.log` records a 20-cell building pane clearing into glass shards with zero cube debris, plus a car retaining its body and three other panes. Before/after captures: `glass-car-before.png`, `glass-car-shatter.png`, `glass-house-before.png`, `glass-house-shatter.png`.

The two adjacent failures are the legacy `<300` draw-call assertions. A clean isolated copy of pre-shatter `723c993` produces 866 calls; this change produces 900, with unchanged triangle counts. **JIM-48** tracks the existing scene budget problem and misleading whole-renderer `voxels.drawCalls` name. No threshold was loosened. The interrupted-feast issue JIM-03 remains separate.

The required full run finished **147/152 passed** (`STATE_ONLY_TEST=1 npx playwright test --workers=2 --timeout=180000 --reporter=line`, `output/iterate/glass-full-suite.log`). Five failures remain: JIM-03 interrupted feast, two JIM-48 renderer-budget assertions, and two rig growth checks now tracked as **JIM-49**. Both rig failures reproduce with identical measurements against `723c993` (`glass-rig-baseline.log`, `glass-rig-offset-baseline.log`). No assertion was loosened and no rig change was bundled into glass. Build, rendered production smoke, visual captures and live console checks all pass; these do not replace Chris's playtest or constitute a performance sign-off.

Playtest: **http://127.0.0.1:4174**. Aim a lean headbutt at a car window, then a building window; judge the scattering shards and the empty pane. A larger headbutt can also break the surrounding frame/wall. Full world and shatter feel remain unsigned-off.

## Current world pass — 2026-10-02

**Milestones 23, 25, 26 and 27 are implemented, awaiting Chris's playtest.** The approved ordered world pass is integrated: 0.22 m destructible voxels, metre-scaled varied houses, sky/water, six Blender/MPFB pedestrians with animated street movement, six imported Kenney CC0 vehicle models, nearby traffic/parked cars, transmissive building/car glass, foot IK and wheel support, physical breakable street furniture, and giant-roll collection/release of objects, food, civilians and pursuers.

Blender 5.2 and MPFB 2.0.17 were used in batch mode; live MCP was disconnected. Editable sources and rebuild scripts are preserved in `assets/blender/people/`, `assets/blender/vehicles/`, `assets/vehicles/README.md` and `tools/`. The existing milestone-23 work was preserved and committed separately as the growth/held-roll dependency. Milestone 24's final stash/sifting UI remains open.

### Playtest now

Production preview: **http://127.0.0.1:4174** (4173 belongs to another project). Use the dev panel's **House (90)** or **Block (250)** preset, hold **C** through a street, then release. People survive and resume movement; food remains available; released props have physics. The normal headbutt also breaks street objects. The user-facing feel is not signed off.

### Verification and remaining limits

- `world-pass-final-state.log`: 60/65 passed on the first broad state run; the five failures were investigated and corrected. `world-pass-clean.log`: all 16 grounding, street-life, pedestrian and heat checks then passed on a clean Vite server.
- `world-pass-final-placement-green.log`: checks of the final den/nearby traffic placement, crowd movement, collection and glass; all four world-detail cases passed; the final wheel-contact refinement and all four street-life cases passed together (6/6) in `world-pass-wheel-final.log`.
- `world-pass-build.log` and `world-pass-production-smoke.log`: production build and real rendered pixel readback, with no console errors. State suites opt out of repeated software rendering after their first frame; these are not performance or hands-on playability claims.
- `actual-rig-camera-check.log`: actual posed model bounds remain within frame at fatness 0, 90 and 250. Final captures: `world-pass-final.png`, `car-glass-final.png`, `giant-collection-final.png`; feet close-up: `pedestrian-foot-ik.png`.
- **JIM-03 remains open:** the pre-existing interrupted-feast test still fails (expected fatness 4, received 9). It was excluded from the 65-check world pass run and remains separate work. JIM-02 whole-building structural collapse, JIM-37 distant building pop-in, army escalation and final stash UI were outside this pass.
- Restart Vite before direct-import tests after editing singleton modules: timestamped HMR imports can create a second EventBus/GameState in test code. The harness now waits for loaded people/cars, and Jimothy's rig when requested.


## Last updated

2026-10-02 — world pass above. The following engineering history retains earlier evidence.

## Earlier handoff — 2026-08-08

2026-08-08 by Claude — **milestone 22: everything in the game had been falling through the island since milestone 17.** Chris's *"digging underground just felt like blocks disappearing"* turned out to be JIM-42: the only floor in the physics world was a plane at y = 0, and y = 0 has meant the waterline since the ground moved to y ≈ 35–75. Blast debris and **every trash can** fell 26–46 m through the terrain and slept at sea level. Fixed; things land now.

Earlier the same session — **milestone 21: the aimable headbutt now actually aims, and the underground is somewhere you can dig through and see.** Chris played milestone 20 and reported two things; they turned out to be four defects (JIM-38 to JIM-41), each measured before a line was written. All four fixed, all four with specs. Then a **fatness dial in the dev panel** (milestone 04, appended), because judging any of it at full fatness meant eating dozens of snacks first.

## Current phase

development

## Current milestone

**Milestone 27 — implemented, awaiting playtest.** No additional milestone was started.

Five earlier milestones are implemented and unplayed; Chris played round 1 of 21 on 2026-08-08 and its findings are fixed.

| milestone | state | tests |
|---|---|---|
| 17 — island and terrain | implemented, awaiting playtest | `terrain.spec.js` (10), `flycam.spec.js` (5) |
| 19 — pursuer AI | implemented, awaiting playtest | `pursuers.spec.js` (8) |
| 18 — underground | implemented, awaiting playtest | `underground.spec.js` (11) |
| 20 — aimable headbutt | implemented, awaiting playtest | `aim.spec.js` (9) |
| 21 — aim/dig/see underground | implemented, awaiting playtest | the 7 new specs in the two files above |
| 22 — things land on the ground | implemented, awaiting playtest | `physics.spec.js` (6) |

**Chris played round 1 of milestone 21 on 2026-08-08** and found two things, both fixed the same session: the dig needed a hard lock, and the crater never moved. Both were the same cause — the reticle had been rebuilt to ask the world and the blast had not, so they disagreed. `DIG_ANGLE` is gone; one march now answers what the swing strikes, whether that is ground, whether it is in reach, and where the sphere goes.

**Suite: 127 passed / 1 failed.** The failure is the pre-existing JIM-03 `interrupted feast`, and feast eating is still unverified end to end.

## Play it — everything below is a claim a test makes, not one Chris has made

1. **`** for the dev panel → **Jimothy** tab. Drag fatness, or hit **House**. The readout says what the number buys — blast radius, width, waddle speed, whether a bush still fits. **Everything below is worth trying at two fatnesses**, because fatness is the game's whole power curve: 0 is 0.75 m of blast, 90 is 5.05 m.
2. **F** to fly. WASD in the camera frame, Space/Z up and down, shift boosts ×5, ctrl creeps, **−/=** step the multiplier ×2 per press (0.25×–32×). Mouse look while pointer-locked.
3. **Climb Trash Panda Heights.** It rises 40 m from its foot, and the hillsides are smooth now rather than terraced.
4. **L**, then *look around*. The reticle should now sit **on** whatever you point at — a wall, a bin, the road — oriented to that surface, and it tracks left/right as well as up/down. Three colours: **cream** in reach, **orange** the swing will dig, **grey** too far to hit. **The crater lands where the marker is**, and a gentle look down digs — no hard lock (both fixed after Chris's round-1 playtest).
5. **Headbutt something off to your side.** He whips round to face it as he swings — that is the "snap on the swing" call.
6. **Get chased into an alley**, break line of sight, watch them search the wrong end. Then blast a wall elsewhere and see them turn toward the noise.
7. **Go underground** — stairwells are in the middle of arterial roads, or **DevTools → Level → "Drop into the nearest sewer"**. You should be able to *see* it now (JIM-41), and **point at a tunnel wall and headbutt a side passage through it** (JIM-40). Get fat first: a lean raccoon barely scratches the rock.

**Open judgement calls the tests deliberately do not make:**

- **The underground camera goes near-first-person.** Measured at 1.0 m in a sewer, because a 7 m boom does not fit in a 2.9 m pipe. He fades so you can see past him. If it reads badly, the fix is in the backlog: flatten the boom's pitch when squeezed, and it can sit 5–6 m back along the tunnel instead.
- **Sewer fog is 3–30 m**, much tighter than the surface, on purpose. Chris has still not been down. If it is too tight, ~6–60 m keeps the enclosure and lets you navigate.
- **Container density** was rebalanced and now reads 22–52 per streaming disc in every district. Furnished, or cluttered?
- **JIM-35** — one fat headbutt is 430 heat points against a tier-5 threshold of 100, and **milestone 21 made this much easier to hit**: ten swings at a tunnel wall reach tier 5. Wants a decision.
- **A lean Jimothy cannot really tunnel** — 7 voxels in 10 swings at fatness 0, against ~2 400 at fatness 40. Backlog; may well be intended. (Ten *downward* swings now sink him 4.4 m at fatness 0 and 28.7 m at fatness 40, both up from milestone 20.)
- **On a hillside, a swing at the RESTING aim now digs** — the hill genuinely is in front of you at chest height, so "digs when it will strike ground" says yes. On the flat it does not, and the marker turns orange either way. Intended, and a real behaviour change on sloped ground that Chris has not seen.

## The engineering result that matters

**Ground is implicit.** `solid(x, y, z) = y < surfaceHeight(x, z)` unless an edit says otherwise. Only a constant 4-voxel skin is stored, because that is what the mesher draws; a blast below it materialises the faces it exposes and nothing else. Booted at `TERRAIN.DEPTH` 20 m and 200 m:

| | 20 m | 200 m |
|---|---|---|
| stored voxels | 947,634 | **947,634** |
| chunks | 191 | **191** |
| boot | 1237 ms | 1224 ms |

Byte-identical. `tests/terrain.spec.js` asserts the equality exactly. That is what made the whole underground affordable afterwards: milestone 18's second 2 × 2 km layer cost **203 chunks against 191**.

## ⚠️ The recurring bug of this project: a constant tuned for a world that no longer exists

**Fourteen found so far, across six milestones.** Every one silent — nothing errors, the game just quietly does the wrong thing. When any world dimension changes, **grep every constant expressed in world units and ask what it meant when it was written.**

| constant | meant | broke |
|---|---|---|
| `PURSUER_SPAWN_POINTS` | the middle of the old map | the run had no lose condition away from spawn |
| `HIDE_SPOTS.POSITIONS` | ” | the only pressure valve covered ~5% of the world |
| `CITY.DOWNTOWN_RADIUS` | ” | downtown was four blocks; towers never appeared |
| `Tunables` `WORLD.BOUNDS: [10, 38]` | ” | any stored override clamped the island to a 76 m square (JIM-33) |
| `scene.fog` 40–200, `CAMERA.FAR` 500 | ” | 41% opaque at the edge of the loaded world (JIM-36) |
| `damageSphere(minVoxelY: 0)` | grade | a headbutt on a hill would have cratered the hillside |
| `findWallTarget(probeY: 1.0)` | ” | every probe on a hill hits rock, so it never found a standoff |
| `Pedestrians` scan from `0.5` | ” | started 50 m underground, buried them at bedrock |
| bins `height / 2`, snacks `0.18` | ” | spawned 45 m under a hill |
| `voxel.spec` `sparedGround >= 0` | ” | passes however deep the crater, if the hill is taller |
| headbutt aim = camera pitch | the horizon | the resting camera looks 26.6° down, so every swing aimed at the pavement |
| `digsTerrain` = `aim >= DIG_ANGLE` | the only dig was DOWN | a flat swing underground removed 0 voxels; you could only go deeper (JIM-40) |
| `impactPoint` drops the standoff when digging | ” | no downward carry to replace it sideways, so the sphere stopped 5 mm short of every tunnel wall |
| **`CANNON.Plane()` at the origin — the only floor in the game** | grade | **every dynamic body fell 26–46 m through the island and slept at sea level (JIM-42)** |

**The last one is the biggest yet, and it hid for four milestones behind two things that were individually reasonable.** Jimothy is kinematic and clamps himself, so the player never fell; cans stream in around him, so the ones you walk up to spawned seconds ago and have not sunk far. A bug that is invisible near the player and obvious 100 m away is one a playtest cannot find — Chris only saw it underground, where rubble has nine metres of open tunnel to visibly drop out of.

**The last two are one bug wearing two coats, and the second only appeared after the first was fixed.** Opening the gate made `digsTerrain` true and the swing still removed nothing — the blast fired, the flag was right, and `damageSphere` called by hand with the same arguments removed a voxel. **When a fix does not take, re-measure rather than re-reason:** calling the layer below by hand is what separated "the gate is shut" from "the gate is open and the sphere is 5 mm short".

**`voxels.terrainHeightAt(x, z)` is the answer to the "grade" half.** `y = 0` now means the waterline and nothing else.

## Method lessons worth keeping

- **Measuring the cost of something is not the same as checking it works.** Milestone 17's fly camera streams a 176 m radius; I measured that in columns and heap and never checked you could *see* it. Fog was 85% opaque out there — the whole extra load radius was invisible until Chris said "the fog makes it hard to see much".
- **"Did it move?" cannot detect pacing.** The pursuer avoidance had a four-frame limit cycle — step left, which unblocks the right and blocks the left, step back, forever. It moved its full 8 cm every frame and travelled 5 cm a second. The first stuck-detector missed it completely. Net displacement over a window is the only thing that tells walking from pacing.
- **When adding a modifier to an existing verb, the modifier's neutral value must reproduce the old behaviour exactly.** The aim is `pitch - neutralPitch`, so "nobody is aiming" is 0. Milestone 21 is what happens when you only do this for *half* the modifier: the pitch was neutral-correct and the yaw was never wired at all, so the aimable headbutt shipped aiming on one axis.
- **When one consumer of a shared idea is rebuilt to ask the world, the others must be too — or they quietly disagree.** Milestone 21 rebuilt the reticle to march the world and left `impactPoint` a fixed projection and `digsTerrain` an angle threshold. All three were "where does this swing go", and the marker said reachable-ground at 0.04 rad while the swing refused until 0.54, with the crater pinned at 1.87 m regardless. **The fix was to delete two of them:** one `aimHit` march now answers what the swing strikes, whether that is ground, whether it is in reach and where the sphere lands. Two things that cannot be computed separately cannot drift.
- **Prefer a geometric fact to a threshold that approximates it.** `DIG_ANGLE` was trying to express "do not crater the road you are lunging over". Asking whether the swing will actually strike ground says the same thing exactly, needs no tuning, and is simultaneously stricter on the flat and looser on a hill — which is what the threshold was always failing to be.
- **A rule that moves a body toward clear space must REACH clear space in one move, or it is a ratchet.** Four separate bugs in milestone 22 were this one shape. Lifting a buried body to the top of the voxel it is *in* puts its centre in the next voxel up, so it lifts again — one voxel per step, 33 m/s, and the debris pool reached **13 km**. A *bounded* lift is the same ratchet, slower. The same sentence describes JimothyController's levitation loop (playtest 2026-08-06).
- **"Not steering it" is not the same as "stopping it".** The buried case first skipped the body without touching its velocity, and one can that spawned inside a kerb still reached the waterline 46 m down while all 29 others rested correctly. Declining to act on a body under gravity is a decision to let it accelerate through the planet.
- **Pooled objects remember their previous life.** Debris slots are recycled by index, so a slot's "previous position" is wherever it was used last — and a clamp that reverts into that position teleports the chunk across the district. Anything that TELEPORTS a body must clear its sweep history (`PhysicsSystem.resetSweep`), the same discipline `teleportJimothy` already follows.
- **A bug that is invisible near the player cannot be found by playing.** JIM-42 survived four milestones because cans stream in around Jimothy: the ones you can see spawned seconds ago and have not sunk far yet. It hid behind its own streaming, and was only visible underground where the rubble has open tunnel to fall through.
- **A test hook that fakes half a system will hide the other half.** `faceJimothy` turned his body without the camera, which was fine until the camera became half the aim — then two streaming specs failed because they had him facing a wall and swinging elsewhere, *a state no player can reach*. Fix the hook, not the game: the hook's job is to reproduce a real situation.
- **A reticle's promise has to be the thing a player reads it for.** Milestone 20 asserted the marker and the blast were the same point, which was true and became meaningless the moment the marker moved onto the contact surface while the sphere kept burying itself past it. The promise that survives both is *same bearing, and the blast contains the marker*.
- **Two consumers of one formula must share the function, not the formula.** The reticle and the blast both call `impactPoint`; the way a reticle comes to lie is a second copy.
- **Sample the same point.** The mesher and the generator both read the height field at the **voxel centre**; deriving the same value from a caller's exact `(x, z)` disagreed by a whole voxel near a voxel edge and silently disabled the smoothing there (0.30 m of drift).
- **Snapshot ORDER is not identity.** A blast raises heat, heat spawns paparazzi, and `pursuers[0]` becomes somebody else mid-spec. Pursuers carry a stable `id`.
- **Set up, THEN baseline.** A treasure spec asserted heat was unchanged across a pickup and caught its own eleven digging blasts (950 points). The baseline belongs between the setup and the thing under test.
- **Don't await a promise that only settles inside `advanceTime`.** Nothing ticks until the `evaluate` returns. Capture into a global, step, then read.

## Read this before writing another seam check

**An automated seam check was attempted, looked convincing, and is wrong.** It measured the gap between adjacent bones' vertex buckets — zero everywhere would mean nothing had come apart.

Triangles straddle the boundary between two bones, so a joint that **stretches** separates the two vertex sets exactly as a torn one would. A fat mid-roll Jimothy measured **0.077 world units** at the hip by exact per-vertex skinning, with a provably intact mesh. Stretching is what the milestone was built to do, so the metric reports success as failure, and no threshold separates the two.

The mesh is one continuous surface and is topologically incapable of tearing. "Seam" names a *rendering* judgement, which is why the AC says playtest. Do not rebuild this.

## Blockers

- **⚠️ Six milestones await playtest** (17, 18, 19, 20, 21, 22), plus 08, 09, 12 and 15 from before. "Implemented, all AC ticked" is the ceiling (house rule 4). Milestone 10 is the only one signed off.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it. Confirm at the same playtest.
- **JIM-37 — buildings pop in at 106 m**, now that fog no longer hides the streaming boundary. Chris asked for this to be logged. The cheapest real fix is a **building LOD ring**: `Layout.buildingsIntersecting` answers "what buildings are in this box" from the baked plan *without generating a voxel*, anywhere on the island, so everything from 106 m to the horizon can be one `InstancedMesh` of boxes. One draw call, no streaming.
- **JIM-34 — greedy meshing implemented in milestone 25.** Sloped terrain retains its sampled shape.
- **JIM-35 — one headbutt is a five-star wanted level.** Balance; wants Chris's judgement, and milestone 21 sharpened it — digging sideways for ten swings reaches tier 5.
- **⚠️ 1 spec failing, PRE-EXISTING** (JIM-03) — `interrupted feast`.

## Newest asks (logged, not lost)

- **JIM-23 lasso** — design SETTLED: a landed lasso starts a struggle (mash roll), breaking free flings the catcher, a background **exhaustion** stat makes escaping twice unlikely, and a thrown lasso can tangle pedestrians/bins. Only the rope *implementation* (real cannon-es chain vs. convincing fake) is open — decide with a measurement.
- **JIM-24 "as big as a house"** — the fatness ceiling is ~1.9× width, an order of magnitude short of the fantasy. `SPEED_PENALTY_MAX` is already 0.7 as step one. The rest is a rebalance: the camera must pull back with girth, the kinematic sphere stops being a sane shape, the city becomes furniture, and `fat/(fat+SOFTCAP)` mathematically cannot exceed `MAX_WIDTH_GAIN`. Wants its own milestone, and **JIM-25 is the first thing it will meet**.
- **Hold-to-charge on the headbutt** — deliberately left in the backlog by milestone 20. Separate feel decision, wants its own playtest.

## What was proposed and NOT chosen (2026-08-09), so it does not have to be rediscovered

The gameplan delta, measured against the code rather than against the milestone list:

- **Heat tiers 4 and 5 do nothing.** `HEAT.MAX_TIER` is 5 and only two pursuer types exist. The constant's own comment says tiers 4–5 "stay unreachable until milestone 03" — which stopped being true when destruction heat landed, since one fat headbutt is 430 points against a tier-5 threshold of 100. **So the pitch's headline — escalation "up to army tanks" — currently ends in silence.** Milestone 03 covers it and is still `planned`; it bundles trees with the army and should be split when it comes up.
- **There are no trees, at all.** Core loop step 4 is "climb trees to loot weird finds" and `HEAT.PER_TREE_LOOT` is a constant nothing produces. Also milestone 03.
- Navigation (milestone 13), which the gameplan calls not-optional on a 2 km map; JIM-43 smoothing dug surfaces (must be decided together with JIM-34 greedy meshing); JIM-30 the eat button; JIM-31 the photo book; audio; the "stupidly impressive water".

## What is left, and what it now unblocks

- **Milestone 13 — navigation** (minimap, map screen, waypoints). Cheapest it will ever be: coastline, districts, sewer network and their names are all baked and queryable (`districtNameAtWorld`, `sewerNetwork`, `Terrain.grid`). A map that shows only where you have been is also what makes tunnels tense.
- **JIM-37's building LOD ring** — small, visible, and the thing Chris noticed unprompted.
- **Milestone 11 — scamper gait** (JIM-22). Independent. **Do not rewrite it from scratch** — `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift; it was orphaned when the real model arrived. Reconnect the tube logic to bones.
- **JIM-29 katamari roll**, **JIM-31 photo book** (which now has treasure to print), and the **easter-egg world tour**.
- **`cityPlan.js`'s parks, plazas and landmarks are not on the island** — the Space Noodle is nowhere. In the backlog; re-read its trademark warning before re-siting it.

## Notes for next session

- **Grade is not a constant.** Ask `voxels.terrainHeightAt(x, z)`.
- **The voxel world has NO colliders (ADR-0003), and never will.** Dynamic bodies are clamped against the grid after each substep by `PhysicsSystem._groundBodies`; Jimothy clamps himself and is deliberately excluded (he is KINEMATIC). Anything new with a mass gets the clamp for free by being handed to `physics.add`.
- **`fatFactor(fatness)` in `MathUtils`** remains the saturating curve for penalties and blast balance; `fatWidth`, `fatHeight` and `fatGrowth` drive size without the old ceiling. It was written longhand in four places; the dev readout would have been the fifth, and a readout that has drifted looks exactly like one that has not.
- **`voxels.raycast(ox,oy,oz, dx,dy,dz, maxDist)`** is the way to ask "what is along this line" — returns the hit point, the voxel, and the face normal, and skips the origin's own voxel. Same DDA as `hasLineOfSight`. The reticle and the camera boom both use it; anything else that needs to probe the world should too, rather than sampling in a loop.
- **The aim is TWO values.** `cameraSystem.aimPitch` (from the resting pitch) and `cameraSystem.yaw`. A move locks both at the moment it starts. `window.lookJimothy(yaw)` in specs; it forces `input.forcePointerLock`, because aiming only happens while locked and follow mode overwrites the yaw every tick.
- **`VOXEL.EMPTY` (255), not 0, for anything removed or carved.** Below the stored skin a 0 means "nothing stored, ask the height field", so a hole written as 0 heals itself instantly.
- **The level pipeline, in order:** `islandPlan.js` (data) → `Terrain.js` (height field + implicit ground) → `CityPlanner.js` (class grid, blocks, buildings, sewers) → `Layout.js` (adapter) → `VoxelCity.js` (footprint → voxels) → `VoxelWorld.js` (voxel engine, knows nothing about islands). The one-way dependency lets `CityPlanner` ask `Terrain` where the water is without a cycle.
- **Smoothing is mesh-time only.** Undisturbed ground has its top face displaced onto the height field; anything dug drops out and renders blocky. Smooth is what you found, voxel is what you did to it.
- **The bone rest-pose trap.** glTF bones carry their bind orientation in `bone.quaternion`. Writing `bone.rotation.x = …` destroys the rest pose and collapses the skeleton. `JimothyRig.pose()` is the only sanctioned way to move a bone.
- **Bone axis mapping, measured:** `x` pitch (the gait axis), `y` twist along the bone (invisible), `z` lateral (the sprawl axis for JIM-22).
- **Measure the SOURCE before blaming an asset.** JIM-10 cost an extra session because it was recorded as "the Meshy model is rough" without checking. It was fine. `node tools/mesh_report.mjs <file.glb>`.
- **A probe aimed at the middle of a thing cannot find a defect at its edges.** Sample where the geometry is interesting.
- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless.
- **To prove a failure is pre-existing without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000, run the specs there, then `git worktree remove --force`.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs** — only `rig.spec.js` pays the model load.
- `MOVES` carries per-move destruction *policy*, and `onImpact` takes the move's whole config plus a direction vector. Add moves by adding a config.
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. `cannon-es` keeps shapes in `body.shapes[]`; there is no `body.shape`.
