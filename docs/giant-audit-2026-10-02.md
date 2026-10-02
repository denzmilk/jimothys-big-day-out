# Giant Jimothy: reproduction and next work

Audited `a839c65` after Chris reported the giant silhouette, rolling collection, destruction and frame-rate problems. This is a diagnosis and proposed repair sequence; no runtime fix is included.

## What the running game does

Loaded the actual skinned Jimothy and all people/cars in Chromium, used the fatness controls and keyboard input, and inspected rendered captures and `render_game_to_text()`. The four presets were 0 / 90 / 250 / 400. No page errors were reported.

| Measurement | Lean | House | Block | Absurd |
|---|---:|---:|---:|---:|
| Collision radius, metres | 0.55 | 4.69 | 18.39 | 36.22 |
| Posed mesh bounds: width × height × length, metres | 0.91 × 1.45 × 1.70 | 7.43 × 3.99 × 11.40 | 33.14 × 15.03 × 50.10 | 67.43 × 29.38 × 101.65 |
| Roll blast radius, metres | 0.41 | 1.12 | 1.24 | 1.27 |
| Voxels removed by a flat headbutt at the same wall | 56 | 538 | 0 | 0 |
| Largest mesh-rebuild call during 90 rolling updates, milliseconds | 0 | 0 | 475 | 1,938 |

The geometry measurement skins every vertex and measures it in Jimothy's local frame. It includes the extremities; it is not the approximate bone-owned belly box used by the collector. The screenshots show the long, low form and distant attachments.

### Shape and contact — JIM-24 / JIM-29 / JIM-49

`JimothyRig.bindAspect()` caches a world-space belly AABB, then `JimothyController.postUpdate()` uses those proportions as body-bone scale axes. The body bone's Y axis runs along the spine, unlike world Y. Child counter-scales remain uniform under that nonuniform parent. Growth also scales around the rump and the tumble pivot only compensates vertically. At Block size the belly proxy centre is about 21.6 m longitudinally away from the physical centre in the sampled upright pose.

The collector registers 64 attachments at Block/Absurd size, but placement uses the approximate bone-owned box, which differs substantially from the blended visible skin. Pickup proximity instead uses the collision sphere. Rays from attached people's origins towards the belly centre first meet the visible skin **3.63–14.25 m away at Block**, and **8.97–31.19 m away at Absurd**. These are ray distances, not shortest distances to the surface; they still expose the bad placement together with the captures. Registration and parenting assertions did not test this visual contract.

### Sustained animation — JIM-60

Holding C keeps translating Jimothy, but `Math.min(1, move.t / R.DURATION)` caps the visual tumble. At both 1.0 and 1.5 seconds, `rollSpin` is exactly 2π, so collected objects stop revolving with him. The held movement conversion left the one-shot animation behind.

### Giant destruction — JIM-61

At the same procedural wall target, all four E presses entered and fired a headbutt. Lean/House damaged it; Block/Absurd did not. Block's blast centre was y=55.92 with radius 5.75, over ground y=39.56. Absurd's centre was y=73.75 with radius 5.93. The growing collision body's centre rises above buildings while reach and blast growth remain bounded. Roll ticks have an even smaller radius. There is no swept giant-body demolition path.

### Performance — JIM-48

The 90-update probe excludes repeated rendering and wraps individual system calls with `performance.now()`. At Block size mesh rebuilding consumed 2.84 seconds total; at Absurd, 5.08 seconds. `remeshDirty()` rebuilds every dirty chunk synchronously; even the streaming limit of one column can dirty several expensive chunks. Faster giant traversal reaches those columns more often. Lean traffic update cost was also about 9.8 ms per sampled update and needs profiling.

One subsequent render reported 1,807 / 1,913 / 2,894 / 3,831 renderer calls. These include the renderer's current passes and are not isolated main-view draw counts. Chromium used SwiftShader. **This is CPU diagnosis and draw telemetry, not native-GPU FPS or an equivalent-distance benchmark.** A fixed route on native graphics remains required. The initial hypothesis that the tumbling group origin caused the worst streaming cost was not established by this probe.

## Evidence and reproduction

Local artifacts under `output/iterate/`:

- `giant-audit.mjs` / `.log`: posed vertices, collider/proxy dimensions, C held for 90 updates, system timings and rendering counts. Captures: `giant-before-0.png`, `giant-before-90.png`, `giant-before-250.png`, `giant-before-400.png`.
- `giant-contact-audit.mjs` / `.log`: actual attachment-to-skin rays, collection snapshot and roll impacts. Ignore its later headbutt attempts: they were issued during cooldown and did not fire.
- `giant-headbutt-audit.mjs` / `.log`: independent resets, `findWallTarget()`, settled cooldown, ordinary E input, confirmed fired move and voxel-removal count at all four sizes.

The scripts are local diagnostic artifacts, not passing acceptance tests. New regressions must cover actual skin/contact, continued rotation, size-scaled contact destruction and bounded work. Existing collection counts and camera bounds are insufficient acceptance evidence.

## Proposed order

1. Repair the existing giant form and rolling contact in milestones 23–24. Align the visible body, collision shape, pivot and attachment surface; keep the tiny head/limbs and lean movement; verify continuous distance-based rotation and safe release.
2. Make giant destruction responsive. Establish render/simulation budgets first, remove synchronous meshing stalls, then use bounded contact/swept destruction at the giant's actual surface. Retain the headbutt's stronger demolition role and deliberate terrain digging. Do not multiply the current voxel-sphere loop to city-block volume.
3. Add military escalation: tanks and telegraphed jet passes at the appropriate heat/size, using the same bounded impacts. The existing gameplan and milestone 03 describe tanks but the runtime has no army. Jets are new scope. The question of military attacks ending a run is pending; the current rule remains net-only until Chris changes it.

Detailed proposed criteria, preserved performance requirements, beaches and underwater content remain in `backlog.md`. No new milestone has been activated.
