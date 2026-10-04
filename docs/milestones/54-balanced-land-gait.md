# Milestone 54: A slower, balanced land gait

## Status

Planned — next after the car follow-up, under Chris's 2026-10-04 sequential request. JIM-76 is reopened; previous contact tests did not establish that the gait looks right.

## Objective

Jimothy walks with his original low slinking posture and measured paw steps, without scuttling, rapid retargeting or curled dancing legs.

## Scope

Distance-matched stride/cadence, stable planted contacts, reach-limited turns and stop/start blending on the original rig. Test lean, medium and fat walking sizes and walking/scurry speeds. Preserve idle, headbutt, roll, swimming and M53 riding poses.

## Dependencies

**Depends on:** M11 rig/legs, existing foot grounding, M53 rider pose ownership.
**Blocks:** speed shoes and final giant movement feel. Rough terrain/sewer geometry is M55.

## Acceptance criteria

- [ ] Record the reported rapid gait in native loaded-rig views; measure paw liftoff frequency, travel per stride, stance slip and knee position over walk/turn/stop routes before changing tuning.
- [ ] Walking cadence follows distance and speed; stationary turning does not repeatedly fire full walk steps. Tune in Constants.js and assert cadence/travel bounds at 30/60/120 Hz based on the recorded reproduction.
- [ ] Planted paws retain reachable targets, with stable support and no sustained knee curl; turning or stopping blends without body pops. Keep existing contact/reach regression thresholds.
- [ ] Idle, attack, swim, growth, car entry/exit and restart restore their correct pose ownership without a stuck walk cycle.
- [ ] Chris approves the slower balanced slink in normal gameplay — verified by user playtest.

## Exit condition

Chris walks slowly, scurries, turns and stops on a street and a hill → Jimothy looks balanced and slinky, with readable individual steps and stable ground contact.

## Verification

Fail a concrete gait regression first, then run original-rig movement/IK and adjacent driving/water/idle checks, build and pixel smoke. Inspect native follow and side views at several speeds/sizes. Do not close this from foot-height assertions alone.
