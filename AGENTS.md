# AGENTS.md

> Lean enforcement file for any AI agent working in this repository. Read this file **first**, every session, before any other action. Cross-tool standard (Cursor, Aider, Codex, Claude, etc.). Claude users: `CLAUDE.md` points here.

This project follows the [`make-game`](https://github.com/OpusGameLabs/game-creator) pipeline. Do not improvise process — follow the rules below.

## Project overview

- **Title:** Jimothy's Big Day Out
- **Pitch:** Third-person 3D meme-slop rampage as Jimothy, Seattle's viral short-spine raccoon. Tip trash cans, loot trees, and survive an escalating GTA-style response — up to army tanks — until the animal-control net (the only run-ender) catches you.
- **Genre / type:** Score-attack physics-comedy rampage, one-block arena
- **Engine:** Three.js (`three@^0.185.1`) + cannon-es physics (`^0.20.0`)
- **Language:** JavaScript (ES modules), Vite build
- **Target platform:** Desktop browser (keyboard/mouse + gamepad); GitHub Pages deploy

## Mandatory: run the make-game skill

Every session in this directory **must** run the `make-game` skill's session-start sub-pipeline before any other work. The skill enforces phase awareness, doc continuity, milestone discipline, and the live-iterate verification loop.

If the skill is not installed in your environment:

```
npx skills add opusgamelabs/game-creator --skill make-game -p -y
```

If the skill cannot be installed (e.g. unsupported agent tool), apply the rules in this file manually and tell the user the skill is missing.

## Source-of-truth files

These docs are the agreed state of the project. Read them at session start; do **not** unilaterally edit them — propose changes and get user confirmation first.

- `docs/STATE.md` — last session handoff. Read first, every session.
- `docs/gameplan.md` — game definition (loop, rules, heat tiers, art, anti-goals).
- `docs/tech.md` — stack, tooling, asset pipeline, conventions.
- `docs/milestones/` — feature work breakdown with acceptance criteria.
- `docs/architectural-decisions/` — locked decisions (0001 engine/stack, 0002 physics).
- `docs/backlog.md` — every deferred idea. Nothing the user mentions gets silently dropped.
- `docs/issues.md` — the tracked defect register (`JIM-NN` IDs, status, evidence, code locations). **Bugs go here, not only in the backlog:** the backlog is for ideas we chose not to do yet, this is for things that are wrong. Log a bug the session it's reported, even if it isn't being fixed.

## House rules (Chris's cross-repo conventions — non-negotiable)

1. **Commit and push at the end of each issue.** Chris, 2026-08-07: *"Commit/merge at the end of each issue so git is up to date."* This is standing authorization — do not stage and ask each time. An "issue" means a `JIM-NN` from `docs/issues.md`, or a milestone's worth of work: when it's coherent, tested and documented, commit it and push to `origin/main`. Do **not** batch several issues into one commit, and do not leave a session's work unpushed. (This supersedes the earlier "never push on your own initiative" rule, which let 36 files pile up across three sessions.) Still ask before anything genuinely destructive — force-push, history rewrite, deleting branches.
2. **Comments explain WHY, not what.** The constraint, trade-off, or bug avoided — link the ADR/milestone it came from. Never narrate what a line does.
3. **Never commit secrets.** API keys and tokens live in env/CI secrets, never in the repo. Scan the diff before every commit.
4. **Chris playtests before anything is "done."** Anything he can see or feel — movement, physics, camera, juice, UI — needs his hands-on sign-off. Automated tests and screenshots are necessary but never sufficient. Report status honestly: "implemented, awaiting playtest" is the ceiling until he's played it.
5. **Surgical scope.** Do what the milestone says, no more. New ideas mid-session go to `docs/backlog.md`, not into the diff.
6. **Tuned values live only in `src/core/Constants.js`.** "Feels wrong" bugs trace to drifted constants — never retune inline, never scatter magic numbers.

## Architecture rules

- **EventBus singleton** (`src/core/EventBus.js`) — all cross-module communication via pub/sub. Modules never import each other directly. Events use `domain:action` naming and are declared in the `Events` map.
- **GameState singleton** (`src/core/GameState.js`) — single centralized state object with `reset()` for restart safety. Systems read; events trigger mutations.
- **Constants.js** — every magic number, color, timing, balance value lives here. Zero hardcoded values in game logic.
- **PhysicsSystem owns the cannon-es world** (ADR-0002) — Jimothy is kinematic while controlled, dynamic while launched; props are dynamic bodies. Gameplay talks to physics only via EventBus/GameState.
- **`window.render_game_to_text()`** — JSON snapshot of game state for agent inspection without screenshots.
- **`window.advanceTime(seconds)`** — steps the simulation deterministically for verification.
- Resources are disposed on removal; restart must leak nothing.

## Stack-specific commands

- **Dev server:** `npm run dev` (port 3000)
- **Tests:** `npm run test:smoke` (needs the dev server running; headless screenshots composite WebGL black under SwiftShader — assert via the test's pixel readback, not screenshots)
- **Build:** `npm run build`
- **Lint / format:** n/a (deliberate — see `docs/tech.md`)

## Live iterate (after every code change)

After any meaningful code change in the development phase:

1. Confirm dev server is live; check console — must be error-free.
2. Call `render_game_to_text()` and verify state matches the change.
3. For time-dependent changes, step with `advanceTime(seconds)` and re-read.
4. If visual, verify via the smoke test's pixel readback; save any captures under `output/iterate/`.
5. Smoke-check adjacent state for regressions.
6. Hand back to the user with a one-line verdict and one focused question.

A change is **not done** until this loop has run — and not *signed off* until Chris has played it (house rule 4).

## Append vs spawn a new milestone

When new work surfaces:

- **Append** an AC to the current milestone if the work is in-scope refinement.
- **Spawn** a new milestone if the work is out of scope but related; use `Depends on:` to capture ordering.
- **Inline** trivial fixes (typos, one-liners) on the current milestone.

When in doubt, prefer spawning. Do not bloat milestones.

## Minimum-viable doc mode

If the user pushes back on documentation overhead, downgrade — do **not** skip:

- One-line milestone entry (title + AC) is acceptable.
- `docs/STATE.md` updates remain mandatory.
- `docs/gameplan.md` and `docs/tech.md` must exist.
- Engine / language / stack ADRs cannot be skipped.

## What to do if `make-game` isn't loaded

If the skill is missing or didn't trigger this session:

1. Stop. Do not start coding.
2. Read this file in full.
3. Read `docs/STATE.md`, then `docs/gameplan.md`, then `docs/tech.md`.
4. Identify the current phase and the open milestone.
5. Tell the user the skill isn't loaded and recommend they install it.
6. If proceeding without the skill, apply the rules above manually and update `docs/STATE.md` at the end of the session.

## Last regenerated

2026-07-23 by Claude / make-game scaffold. Regenerate when the engine, primary commands, or architecture rules change. The doc-drift audit will flag staleness.
