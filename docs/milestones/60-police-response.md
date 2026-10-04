# Milestone 60: Police pursuit and armed officers

## Status
Implemented, awaiting Chris’s playtest. Authorised playground sequence, step 4. M59 is pushed as `a756d47`; the intervening JIM-50 uphill repair is pushed as `8e21fe7`. Continue without another scope approval.

## Objective
Four stars bring recognisable patrol cars and officers who search, pursue, stop and shoot. Jimothy can escape, hijack the cars or knock the responders into the existing physical destruction/collection systems.

## Scope
- Source Kenney's CC0 police car and a compact firearm from its CC0 Blaster Kit. Preserve sources/licences and editable Blender imports; apply the existing metre scale, wheel/glass and fracture pipeline. Add an original fitted police cap to the existing MPFB human rig.
- At most two patrol cars and two officers. Cars follow connected roads toward visible or remembered positions, respect terrain, obstacles and junction ownership, and show lights/siren. No continuous hidden-player tracking.
- Reuse StreetLife car bodies, DrivingSystem seats/hijacking/ejection, and Pursuers human search/ragdoll/collection ownership. Driver and on-foot ownership cannot overlap. An approaching car stops, lets its officer out and remains driveable/destructible.
- Officers raise/aim a held gun, telegraph a committed shot and recover. Visible finite-speed projectiles sweep against walls and Jimothy; muzzle/impact effects and sound make use readable. Hits use existing mass-sensitive player ragdolls/immunity. Shield, riding/collection, lost sight and active net attempts interrupt appropriately; no new run-ending rule.
- Four stars become police response for every size; tanks/jets retain five-star escalation. Rifle infantry remains the next separate milestone.

## Depends on
M53 car/driver ownership and repairs, M57 player ragdolls, M58 wanted attribution, M59 response poses and JIM-50 grounding.

## Acceptance criteria
- [x] Tier three has no police; tier four introduces bounded patrols/officers with sourced models, readable lights/siren and a visible driver.
- [x] Patrols make route progress uphill/downhill, stop for physical obstacles, search the last observed area and do not follow an unseen moving target. Radar represents their perception.
- [x] Police cars can be hijacked, driven, crashed, submerged, collected/released and streamed without duplicate driver/body ownership; existing six civilian models remain unchanged.
- [x] An officer exits at a grounded clear point, raises the gun in both hands, warns before a shot, fires one swept projectile and recovers. A dodge or intervening wall avoids a hit; effects/audio/voices remain bounded.
- [x] Hits launch/recover small Jimothy and respect giant resistance, shields and net coordination. Police damage cannot raise player wanted points. Ragdoll/collection/destruction/capture/reset clear action and vehicle ownership.
- [x] Focused units, gameplay/state stepping, adjacent road/driver/response checks, native original-rig inspection, build and production pixel smoke pass without console errors. Assets/effects have bounded resource lifetimes.
- [ ] Chris judges pursuit, shot timing, handling, sound and appearance in play.

## Sources
Official pages and downloaded archive licences checked 2026-10-04:
- [Kenney Car Kit](https://kenney.nl/assets/car-kit), version 3.1, CC0. `police.glb` is included; the existing six civilian sources remain intact.
- [Kenney Blaster Kit](https://kenney.nl/assets/blaster-kit), version 2.1, CC0. Choose and inspect a compact held model in Blender before export.

Original sources/licences, editable Blender files and runtime exports are retained; rebuild steps are in `assets/sources/police/README.md`. Initial archives/previews are in `output/iterate/police-source-review`. The car uses the existing preparation pipeline; the compact firearm is 0.44 m long and the cap is an original project asset.

## Exit observation
Reach four stars through substantial destruction, see/hear a patrol approach by road, break sight to make it search, bait an officer's aimed shot and dodge behind cover. Hijack the stopped patrol car, drive away and restart without stranded occupants or effects.

## Review and refinements — 2026-10-04

- Initial acceptance run failed because police response was absent. Policy clock/memory checks then passed at 30/60/120 Hz.
- First integrated run exposed patrol spawn rejection beside every lamp/tree: car separation now applies to cars, while other props use their real oriented bounds. Dispatch, road progress, hijacking and initial cover checks then passed.
- Added checks exposed a 13.3 cm supporting-hand gap and uncarried officers retaining slots after travelling away. The held pose now fits within the unchanged 8 cm grip criterion; officers beyond the response window are removed through their existing human owner.
- Gunfire and patrol visibility target Jimothy's body centre. Testing a patrol's real dismount on a slope caught its earlier sight ray ending inside the road at the ground point.
- The headless OS audio sink later stalled every context (police, existing local responses and existing driving) at 0.00533 seconds despite a running state. Chromium's `--disable-audio-output` keeps its real processing/analyser graph while replacing the final OS stream; a separate probe advances all three clocks beyond one second. This test configuration change preserves waveform assertions. Speaker listening remains Chris's playtest. See `police-audio-{probe,device}.log`.
- The cover fixture observes peak impact particles during their lifetime and verifies a real voxel-wall interception; reading only after the 0.28-second effect had expired was not a valid impact observation. Audio checks wait for sample-clock progress and sample the single cue through the analyser instead of assuming device startup within 35 ms.
- Native Blender previews and an original-rig runtime pass show a fitted navy cap, two-handed gun and occupied sourced patrol. One shot produces one hit. The final evidence below supersedes the intermediate runs.

Intermediate evidence: `output/iterate/police-{red,first,second,focused,lifecycle-first,refined,final,contact}.log`, `police-policy-{red,green,final}.log`, `police-units-final.log`, `police-build.log`, `police-native/report.json`. These are implementation checks; Chris still judges pacing, sound, appearance and handling in play.

The long driving run exposed a seat-budget edge case: occupied stopped civilian cars can coexist with newly streamed traffic. The separate `police-capacity.spec.js` first reproduced ten civilian drivers and two driverless patrols. Driving now reserves eight civilian/two police slots using stable driver roles. The unchanged regression passes with two patrols, two officers, eight civilians and ten total occupants. The preceding frozen-source 52-case police/driving/traffic/local/military run passed; the final 14-case follow-up, native review and production smoke also pass.

## Final gameplay evidence

- `police-verified.log`: all 52 police/driving/traffic/local/military cases passed before the seat reservation refinement.
- `police-complete.log`: all 14 final police/capacity cases pass after that refinement, including the added police-car steep-road case. The sourced patrol clears 48 m uphill and downhill at 30/60/120 Hz, without a blocking contact; maximum sampled wheel gap 0.1194 m and maximum one-frame height change 0.2816 m. This retains the existing transient suspension limit; it is not perfect tyre contact on every frame.
- Actual dismount resumes the officer’s Idle action and physical actor. Fixed-target dodge, real voxel-wall interception, shared ragdoll recovery, net coordination, hijacking, water impact, variant streaming, far-actor cleanup and restart pass. The combined four-star response still permits stationary animal-control capture.
- Seat pressure: ten eligible civilian cars yield eight civilian occupants plus two patrol officers, total ten. The same fixture was red before reservation.
- One-cue analyser peaks: siren 0.00447 RMS and gun 0.00548 RMS; reset silences both. This verifies generated audio, not speaker mix quality.
- All 161 unit cases and build pass: `police-units-complete.log`, `police-build-complete.log`.
- Native original-rig frames in `police-native/` show the sourced occupied car, soft alternating lights, fitted cap and two-hand pose. The report has no errors, one shot/hit, eleven physical ragdoll bodies and a return to idle. Review camera follows the pair through knockback; it does not alter gameplay.
- Production `police-smoke-complete.log` passes pixel readback after the opening/hand-off, with no console errors. Across the broad run and final follow-up, 54 distinct gameplay cases pass.

**Limits:** Chris still signs off pursuit/handling, warning timing, appearance and speaker mix. This milestone does not resolve the recorded giant-performance budget (JIM-48), all cave surfaces or remaining giant skin stretch. Army automatic-rifle infantry is M61, next in the authorised sequence.
