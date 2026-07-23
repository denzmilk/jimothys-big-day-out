# Backlog

> Out-of-scope ideas, feature requests, and follow-ups captured during sessions but **not** worked on in the session that captured them. Read at the start of every milestone-creation conversation. Append-only — promoted items get a checkbox tick and a link to the milestone that absorbed them, not a deletion.
>
> If an item turns out to be wrong / no longer wanted, mark it `~~struck through~~` with a one-line reason rather than removing it; future sessions need to see that it was considered and rejected.

## Gameplay & features

- [ ] Pants as wearable cosmetic — Jimothy visibly wears looted pants for the rest of the run (vs score-only pickup)
  - Source: 2026-07-23 scoping session ("maybe there's pants in trees")
  - Rough size: M · Rough value: L
  - Notes: pure comedy/clip value; blocked on the milestone 03 loot system and the open question below
- [ ] Shells knock over trash cans — tank fire causes collateral chaos that feeds the score
  - Source: 2026-07-23 milestone 03 design notes
  - Rough size: S · Rough value: M
- [ ] Tree score-banking / heat interaction — climbing the big tree banks the combo or has some mechanical payoff beyond loot
  - Source: 2026-07-23 idea-phase open question
  - Rough size: M · Rough value: M

## Polish & juice

- [ ] Asset milestone — Jimothy Meshy 5 GLB (waddle/scurry/stagger/caught clips), CC0 GLBs for houses/cans/trees/pursuers/tanks, CC0 photo PBR textures for the demi-real look
  - Source: 2026-07-23 scoping session
  - Rough size: L · Rough value: L
  - Notes: Chris exports jimothy.glb manually from the Meshy web app (no API on free tier); everything else via game-3d-assets skill
- [ ] Audio milestone — procedural Web Audio: honks, trash percussion, flash zaps, shell whistles/booms, heat-layered chase theme
  - Source: 2026-07-23 scoping session (gameplan audio direction)
  - Rough size: M · Rough value: L

## Tech & refactors

- [ ] GitHub Pages deploy — Actions workflow building `dist/` to Pages; `base: './'` already set in vite.config.js
  - Source: 2026-07-23 scoping session (deploy decision)
  - Rough size: S · Rough value: L

## Tooling & QA

- [ ] Full Playwright suite config — `playwright.config.js` with webServer auto-start so `npx playwright test` doesn't need a manually running dev server
  - Source: 2026-07-23 scaffold session
  - Rough size: S · Rough value: M

## Open questions

- Pants: cosmetic (Jimothy wears them) or score-only? Decide before milestone 03's loot table is finalized.
- Mobile touch support and multiplayer are v1 anti-goals (gameplan) — revisit only after the loop ships.
