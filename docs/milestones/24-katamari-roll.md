# Milestone 24: The katamari roll — rolling is how a giant hoards

## Status

**Partially implemented 2026-10-02, awaiting playtest.** Milestone 27 delivers size-gated collection, attachment to the rolling belly, and release of physical props, edible food and living civilians/pursuers. Final stash/sifting presentation remains open.

Depends on: milestone 23 (break the fatness ceiling) — the roll is only a traversal mode once he is big enough to need one.

## Objective

Turn the roll from a way of *moving* into a way of *harvesting*: a block-sized Jimothy accretes food, props and people like a marble, then stops somewhere quiet and sifts what he picked up.

This is **JIM-29**, whose design Chris settled on 2026-08-07 and which `docs/issues.md` records in full. Do not re-litigate it here — read the issue.

> *"think of it as a mass food and item hoarding strategy when jimothy is fat, you get into katamari mode to move quick enough to collect things like a marble — then when you stop everything unloads and you can sift through what you picked up — people included. So if you get some paparazzi or animal control, or military in the roll — you'll need to get away from them to do anything with the stash."*

## Why it is separated from milestone 23

Milestone 23 makes the roll **fast and sustained**, because a 40 m animal that walks at 1.8 m/s is broken. That is a movement fix and one playtest.

This is a whole loop on top of it — accretion, a stash, sifting, and the pressure of having swallowed a pursuer — and it is a completely different playtest. Bundling them would mean neither could be signed off on its own.

## Scope

- Accretion while rolling: food, props and people stick to him.
- The stash: what is stuck comes off where he stops, and can be sifted.
- Anything alive comes back out alive — so rolling through a crowd means losing the crowd before the stash pays.
- Roll destruction rebalanced: Chris asked for it to be *"a little less destructive to buildings"* than the headbutt, which `MOVES.ROLL.FAT_BLAST_SHARE` already half-expresses.

## Out of scope

- Growing (milestone 23).
- What sifting *looks* like — see the open question on JIM-29, and note it may share the eat animation with JIM-30.

## Acceptance criteria

To be written when this becomes the active milestone — the shape of the stash depends on how milestone 23's roll actually feels, and writing checkable criteria now would be guessing at numbers that do not exist yet. **The exit condition below is the fixed point; the criteria serve it.**

## Exit condition

User rolls a block-sized Jimothy through a street, picks up bins, snacks and an animal-control officer, loses the pursuit, stops in an alley, and sifts a pile that includes a very annoyed man.
