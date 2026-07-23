# ADR 0001: Engine, language, and art-style stack

## Status

accepted

## Date

2026-07-23

## Context

We're building "Jimothy's Big Day Out" — a 3D third-person meme slop game (see `docs/gameplan.md`). The user explicitly wants Three.js, shipped as a shareable browser game on GitHub Pages. The game is a single-feature score-attack loop on one city block, single-player, desktop-only — small enough that engine weight matters more than editor tooling. Meshy's API is unavailable on the free tier, so AI generation is reserved for the one model that must be custom: Jimothy himself.

## Decision

Build with **Three.js + plain JavaScript (ES modules) + Vite**, using the threejs-game skill's event-driven modular architecture (EventBus + centralized GameState). Art style is **demi-real with photo textures** — CC0 photographic PBR textures on simple geometry, deliberate early-2000s-render jank. **Jimothy is the only generated model** (Meshy 5 via the Meshy web app, manually exported as GLB); all other models come from open-source/CC0 libraries. Audio is **procedural Web Audio**, tests are **Playwright**, deployment is **GitHub Pages**.

## Consequences

### Positive

- Browser-native: zero-install shareable URL, which is the point of a slop game.
- Three.js + Vite is lightweight, fast to iterate, and well covered by the installed skills (threejs-game, add-3d-assets, meshyai, game-audio, qa-game).
- Meshy generation is the only realistic way to get a *short-spine* raccoon — stock model libraries can't capture the meme's defining silhouette — and limiting generation to Jimothy alone keeps it free-tier viable.
- Photo-texture demi-real turns free/CC0 asset mixing from a weakness into the aesthetic — mismatched sources read as intentional jank.
- Centralized GameState + EventBus keeps future multiplayer or feature milestones from forcing a rewrite.

### Negative

- No GUI editor — the block layout is hand-placed in code.
- Jimothy's model quality depends on manual Meshy web-app sessions (no API automation, no scripted retries); rigging/animation export quality is a known risk, mitigated by a procedural-animation fallback on a static GLB.
- Photo-texture PBR is heavier than low-poly toon: bigger textures, more lighting work to sell the look.
- Plain JS means no compile-time type safety; acceptable at vertical-slice scale.

## Alternatives considered

- **Unity / Godot:** real editors and physics, but heavyweight for a one-block browser slop game, weaker instant-web-share story, and outside the user's requested stack.
- **Phaser:** 2D only — the entire premise is Jimothy's 3D roundness.
- **TypeScript:** better safety, slower slop iteration; can be revisited if the project outgrows the slice.
- **Meshy API automation (meshyai skill):** rejected — the API is not available on Meshy's free tier. Manual web-app generation + GLB export instead, for Jimothy only.
- **Generating all models with AI:** rejected — non-unique assets (houses, cans, tanks) are free from open-source/CC0 libraries; generation spend is reserved for the one irreplaceable silhouette.
- **Low-poly toon art:** cheaper and safer, but the user chose photo-texture demi-real for the janky-liminal look.

## Related

- `docs/gameplan.md` — game design this stack serves
- `docs/tech.md` — the stack in detail
- ADR-0002 (future, at scaffold): physics approach for can-tipping (cannon-es vs. hand-rolled)
