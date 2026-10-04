# Milestone 59: Photographers and kicking locals

## Status
Implemented, awaiting Chris’s playtest — authorised response step 4 after M58 (`0ea8894`).

## Objective
Make early wanted pressure visible and dodgeable: paparazzi raise cameras and take photos, then a small number of angry locals approach and kick with a clear windup.

## Scope
- Reuse existing MPFB people, search/occlusion, radar, grounding and shared ragdolls. Two bounded locals join at tier two; paparazzi and animal control retain their roles.
- A kick locks its heading, winds up, strikes once and recovers. It can miss, is blocked by walls, and respects shield/riding/attachment/ragdoll ownership and yields during committed net attempts. Shared hit immunity and mass resistance keep small Jimothy floppy and giants stable; the net stays the sole ending.
- Author a small editable Blender camera, attach it to a two-handed pose, show lens flash and a shutter cue. Tier-one photography is cosmetic; tier-two flash stun keeps its existing cooldown.
- Add bounded kick feedback, snapshot diagnostics and reset checks. Constants owns tuning.

## Out of scope
Police cars/guns and army rifle troops are separate next milestones. No changes to M58 heat weights or thresholds. Civilian daily routines and the remaining water/equipment queue stay separate.

## Depends on
M26 MPFB people, M51 human activity pose techniques, M57 player hit/ragdoll ownership, M58 pacing.

## Acceptance criteria
- [x] Tier one has visible photographers; tier two adds bounded varied locals; lower heat/reset removes managed roles safely.
- [x] Windup → one strike → recovery is consistent at 30/60/120 Hz; moving out of the locked attack or behind a wall avoids it. A miss cannot turn into a delayed hit.
- [x] Small Jimothy launches/recovers; giant rolls continue. Kicks cannot net him, attack a seated/attached target or bypass a shield.
- [x] Arms visibly hold the camera; lens flash and audible shutter agree. Kicking leg lifts/extends/returns while the support foot stays planted; ordinary navigation resumes.
- [x] Ragdoll/collection/reset interrupt action ownership; source assets, effects and audio remain bounded. Existing net/search, civilian routines and wanted pacing still pass.
- [ ] Chris finds the early response readable and fair in play.

## Exit observation
At one star, see a photographer raise a camera and flash. At two, bait a local's raised knee, dodge the committed kick, or get knocked floppy and regain control. Break sight to escape; restart returns to zero response actors/effects.

## Verification — 2026-10-04

- All **157 unit tests** pass (`node --test tests/*.test.mjs`). Three new clock tests cover 30/60/120 Hz contact, misses and cancellation.
- All **36 focused/adjacent browser cases** pass in one final serial run: `local-response`, `heat`, `net-pose`, `pedestrian-activities`, `ragdolls-capture`, `search-radar`. No assertion thresholds were loosened. Five focused cases cover actual models/camera grips, bounded collection population, kick/contact/occlusion, original-rig get-up, ownership cancellation, giant resistance and measured audio.
- Combined verification found and repaired **JIM-100**: locals yield during committed net phases. The stationary capture and score-persistence tests remain unchanged and now pass. The camera-only fixture disables locals and requires a recorded photograph because its previous generic stun predicate detected a physical kick instead. An added 8 cm supporting-grip limit exposed an 11.4 cm gap; solving the left arm against the camera's actual reach-clamped position repairs it.
- The initial kick fixture put the attacker a metre below its own hillside ground. It now chooses an open, level contact site, grounds each participant independently and asserts clear sight before contact tests. Cancellation checks first prove that a strike actually started.
- Build passes. Native original-rig photos and kick → physical launch → get-up views use the complete generated world with only the encounter isolated. Effects remain bounded at 40 particles/four audio voices. The 984-triangle camera shares one runtime material; editable Blender source and rebuild recipe are retained.

Evidence under `output/iterate/`: `local-response-{first,second,focused,adjacent,coordination,final}.log`, `early-response-trace.json`, `local-response-units-coordination.log`, `local-response-build-final.log`, and `local-response-native/report.json`. Final native inspection is console-clean: one photo, one kick, an eleven-body launch and recovery to zero bodies/effects. Both hands visibly hold the camera; the knee lift/extension and return are readable. Production pixel smoke passes with no console errors (`local-response-smoke.log`). The background native view exposes an ordinary tourist's deep uphill crouch; JIM-50 records it for a separate follow-up. None of these checks replaces Chris's judgement of kick timing, camera flash or sound balance. Giant performance/JIM-48 remains open.
