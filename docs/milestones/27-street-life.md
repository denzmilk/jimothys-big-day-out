# Milestone 27: Traffic and physical street objects

## Status

Planned — approved by Chris 2026-10-02 as one ordered world pass; implementation requires his playtest before sign-off.

## Objective

Address Chris's world review: smaller Teardown-like blocks, recognisable varied houses, nearby moving people and cars, sky and water, and street objects that can be knocked loose and collected by a giant rolling Jimothy.

## Scope

A common physical entity contract for parked/moving cars, poles, hydrants, bins and street furniture; break/knock responses; size-dependent attachment to giant rolling Jimothy and release when rolling stops. Connect existing cans, food and people to the same collection flow where applicable (milestone 24).

## Acceptance criteria

- [ ] Parked cars and moving traffic occupy streets near the player and in distant districts.
- [ ] Poles, hydrants and street objects have physical knock/break responses, never decorative indestructible blockers.
- [ ] Collection is gated by rolling and Jimothy's size; collected objects follow his rolling body, then release into the world when he stops.
- [ ] People survive collection; food remains collectable and props remain physical after release.
- [ ] Restart clears attached/dropped objects and restores traffic/props without resource or body growth.
- [ ] Chris judges traffic, destruction, rolling collection, sky/water and the full world pass in play.

## Dependencies

Depends on: milestones 12, 17, 22; uses the existing in-progress milestone 23 scale work. Delivery order: 25 → 26 → 27. Milestone 27 implements the collection/release portion of milestone 24.

## Out of scope

Vehicle driving/stealing, police/army escalation, structural collapse of whole buildings, new scoring rules, and final katamari stash UI.

## Exit condition

Chris explores several streets and sees the approved world changes, then tries destruction and a giant roll through street life and confirms the result feels right.

## Test plan

Write focused failing acceptance tests first. Verify state through render_game_to_text and advanceTime, inspect pixel-readback captures under output/iterate, run adjacent regression tests and build. Commit/push this milestone independently; report implemented, awaiting playtest until Chris signs off.
