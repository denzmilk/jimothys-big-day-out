# Milestone 29: Ragdolls and a fair capture contest

## Status

Implemented, awaiting Chris’s playtest — 2026-10-02.

## Objective

Roll or headbutt a civilian or pursuer → their jointed body tumbles, settles and gets back up; dodge a slow net swing or knock the catcher away before the capture bar fills.

## Scope

- Jointed, bounded cannon-es ragdolls for civilians and both pursuer types; attacks apply outward impulses and suspend AI/IK while down.
- People recover alive, can still be collected during giant rolling, and release/restart removes every temporary body and constraint.
- Animal control visibly winds up and swings; contact fills a visible capture meter. Growth slows capture while the existing lean movement advantage remains.
- Escaping range or interrupting the catcher breaks the hold; only a full meter ends the run.

## Dependencies

- **Depends on:** milestone 28; ADR-0002.

## Acceptance criteria

- [x] JIM-75 refinement (Chris, 2026-10-03): swing hoop-first with both arms visibly moving and both palms gripping the shaft; recover without a pose snap, clear uphill ground and retain the hand attachment during ragdolls. — `tests/net-pose.spec.js`; appearance awaits playtest.
- [x] JIM-68 refinement (Chris, 2026-10-03): zero-fatness scurries/rolls stop against standing people; a deliberate lean headbutt gives a modest knockdown and loses lunge momentum. Growth enables rolling knockdowns. — `tests/contact-weight.spec.js`; the older roll/recovery fixture must use grown Jimothy.
- [x] Jointed, bounded cannon-es ragdolls for civilians and both pursuer types; attacks apply outward impulses and suspend AI/IK while down. — tests: `tests/ragdolls-capture.spec.js`
- [x] People recover alive, can still be collected during giant rolling, and release/restart removes every temporary body and constraint. — tests: `tests/ragdolls-capture.spec.js`
- [x] Animal control visibly winds up and swings; contact fills a visible capture meter. Growth slows capture while the existing lean movement advantage remains. — tests: `tests/ragdolls-capture.spec.js`
- [x] Escaping range or interrupting the catcher breaks the hold; only a full meter ends the run. — tests: `tests/ragdolls-capture.spec.js`
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Roll or headbutt a civilian or pursuer → their jointed body tumbles, settles and gets back up; dodge a slow net swing or knock the catcher away before the capture bar fills.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.

## Evidence

**JIM-75, 2026-10-03:** the two original pose checks failed before the repair (`net-pose-red.log`). The shield-on-arrival check independently reproduced an undefined heading/non-finite transform (`net-shield-test-red.log`). The 33-case regression passes (`net-regression.log`), followed by six final net/capture/shield checks including the new shield case (`net-final.log`): 34 unique gameplay cases overall. All 70 unit checks, build and production pixel smoke pass (`net-units.log`, `net-build.log`, `net-smoke.log`). Twenty heading/phase poses keep the hoop forward and the wrists on their targets (`net-headings.log`). Native production Chrome/Metal captures with the original Jimothy and MPFB worker were inspected: `net-carry-after.png`, `net-windup-after.png`, `net-contact-after.png`, `net-recovery-after.png`, plus close-up `*-detail.png` views with Jimothy temporarily hidden for inspection. `net-production.json` records phases/hand targets and no console errors. Capture timings, range, size resistance and the full-meter ending remain unchanged. This verifies implementation, not Chris's visual/feel sign-off.

Three final behaviour checks pass, including real roll contact, both enemy types, recovery, collection, constraint cleanup, capture timing, size resistance and interruption (`ragdolls-final.log`). Full regression: 162/167 passed; the remaining five are the existing JIM-03, JIM-48 and JIM-49 failures (`ragdolls-full-suite.log`). Build and rendered smoke passed with no console errors. Inspected captures: `ragdoll-launch.png`, `ragdoll-land.png`, `ragdoll-recover.png`, `net-windup.png`, `net-holding.png`. All paths under `output/iterate/`. JIM-52 restart carry-over was fixed and pushed separately.
