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

Three final behaviour checks pass, including real roll contact, both enemy types, recovery, collection, constraint cleanup, capture timing, size resistance and interruption (`ragdolls-final.log`). Full regression: 162/167 passed; the remaining five are the existing JIM-03, JIM-48 and JIM-49 failures (`ragdolls-full-suite.log`). Build and rendered smoke passed with no console errors. Inspected captures: `ragdoll-launch.png`, `ragdoll-land.png`, `ragdoll-recover.png`, `net-windup.png`, `net-holding.png`. All paths under `output/iterate/`. JIM-52 restart carry-over was fixed and pushed separately.
