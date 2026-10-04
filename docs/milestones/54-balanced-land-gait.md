# Milestone 54: A slower, balanced land gait

## Status

Implemented, awaiting Chris's playtest. Continued after the three car follow-ups under the authorised sequential request. JIM-76 remains open for feel sign-off.

## Objective

Jimothy walks with his original low slinking posture and measured paw steps, without scuttling, rapid retargeting or curled dancing legs.

## Scope

Distance-matched stride/cadence, stable planted contacts, reach-limited turns and stop/start blending on the original rig. Test lean, medium and fat walking sizes and walking/scurry speeds. Preserve idle, headbutt, roll, swimming and M53 riding poses.

## Dependencies

**Depends on:** M11 rig/legs, existing foot grounding, M53 rider pose ownership.
**Blocks:** speed shoes and final giant movement feel. Rough terrain/sewer geometry is M55.

## Acceptance criteria

- [x] Record the reported rapid gait in native loaded-rig views; measure paw liftoff frequency, travel per stride, stance slip and knee position over walk/turn/stop routes before changing tuning.
- [x] Walking stays at or below five paw cycles/s at 6 m/s and seven at 10 m/s, with no more than one cycle/s variation across 30/60/120 Hz. Stride follows anatomical scale. stationary turning does not repeatedly fire full walk steps. Tune in Constants.js and assert cadence/travel bounds at 30/60/120 Hz based on the recorded reproduction.
- [x] Planted paws retain reachable targets, with stable support and no sustained knee curl; turning or stopping blends without body pops. Keep existing contact/reach regression thresholds.
- [x] Idle, attack, swim, growth, car entry/exit and restart restore their correct pose ownership without a stuck walk cycle.
- [ ] Chris approves the slower balanced slink in normal gameplay — verified by user playtest.

## Exit condition

Chris walks slowly, scurries, turns and stops on a street and a hill → Jimothy looks balanced and slinky, with readable individual steps and stable ground contact.

## Verification

Fail a concrete gait regression first, then run original-rig movement/IK and adjacent driving/water/idle checks, build and pixel smoke. Inspect native follow and side views at several speeds/sizes. Do not close this from foot-height assertions alone.

## Reproduction — 2026-10-04

At 6 m/s, the old gait starts 7.5 / 14.67 / 14.67 swings per paw per second at 30/60/120 Hz; at 10 m/s it reaches 19.67 at 120 Hz. At 3 m/s, both 25- and 90-fatness bodies still take 7.33 steps/s. The 120 Hz scurry also produces 2.96 cm maximum stance slip. The new cadence regression fails before changes: `output/iterate/land-gait-cadence-red.log`. Preserve existing contact/knee/lift checks while slowing this cycle; movement speed itself is not the reported defect.

## Implementation and review — 2026-10-04

Strides scale with the original rig's anatomy. A continuous transfer clock carries leftover frame time across diagonal landings; it no longer adds a display frame to every planted phase. Moving pairs alternate, initial steps respond immediately, and early swing targets adapt to turns/stops before locking for landing. Stopped body settling is gentler, and zero-time calls leave paws fixed. Travel speed, original skin, knee planes and all previous regression thresholds are retained.

Final measured paw cadence is 1.83 / 5 / 6.67 cycles/s at 1.5 / 6 / 10 m/s across 30/60/120 Hz. At 3 m/s, fatness 25/90 gives 1.67/1 cycle/s instead of 7.33. Straight-route stance drift peaks at 4.4 mm; the mixed acceleration/turn/stop route peaks at 15.9 mm. Walking knee splay remains below 13.2 cm, lift below 8.8 cm, and at least one diagonal supports him. A stationary half-turn settles to four paws with no continued steps; body correction stays below 8.6 cm/frame at 30 Hz.

Fifteen unique focused/adjacent browser checks pass across the final runs: original skin contacts/kerbs/destruction, growth/roll/hop/teleport, scratch/idle/reset, load-mid-roll, headbutt recovery, all six riding poses/boarding, swimming and shore return. Review exposed a paused-frame paw retarget and a 30 Hz turn dip; both failed first, then passed after correction (`land-gait-settle.log`). All 120 unit checks, build and production pixel smoke pass. Native original-rig side clips at four speed/size combinations and a keyboard-driven world route are console-clean. Evidence: `output/iterate/land-gait-{cadence-red,pass4,final-tests,settle,units,build,smoke}.log`, `land-gait-final/`, `land-gait-world-final*`; repeatable side-view tool: `tools/inspect-land-gait.mjs`. The final-tests log retains the pre-settling-fix turn failure; its unchanged regression passes in settle.log.

Final visual acceptance remains Chris's playtest; the existing extreme-size skin issue is separate. Next authorised milestone: M55 terrain and sewer traversal.
