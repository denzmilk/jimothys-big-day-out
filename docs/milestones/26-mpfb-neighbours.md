# Milestone 26: Varied animated neighbours

## Status

Planned — approved by Chris 2026-10-02 as one ordered world pass; implementation requires his playtest before sign-off.

## Objective

Address Chris's world review: smaller Teardown-like blocks, recognisable varied houses, nearby moving people and cars, sky and water, and street objects that can be knocked loose and collected by a giant rolling Jimothy.

## Scope

Create six clothed MPFB humans in Blender, preserve editable sources and a reproducible recipe, export game rigs, and stream animated pedestrians near the player. People navigate clear land and react to Jimothy.

## Acceptance criteria

- [ ] Six visibly varied clothed humans use MPFB geometry, with documented assets and editable Blender source.
- [ ] Exported models load in the game with walking animation, ground contact and varied appearance.
- [ ] Populated streets near spawn and distant districts contain pedestrians; movement avoids buildings and water.
- [ ] Scaring generates heat once per encounter; restart restores population without accumulating objects.
- [ ] Chris judges variety, animation and street activity in play.

## Dependencies

Depends on: milestones 12, 17, 22; uses the existing in-progress milestone 23 scale work. Delivery order: 25 → 26 → 27. Milestone 27 implements the collection/release portion of milestone 24.

## Out of scope

Vehicle driving/stealing, police/army escalation, structural collapse of whole buildings, new scoring rules, and final katamari stash UI.

## Exit condition

Chris explores several streets and sees the approved world changes, then tries destruction and a giant roll through street life and confirms the result feels right.

## Test plan

Write focused failing acceptance tests first. Verify state through render_game_to_text and advanceTime, inspect pixel-readback captures under output/iterate, run adjacent regression tests and build. Commit/push this milestone independently; report implemented, awaiting playtest until Chris signs off.
