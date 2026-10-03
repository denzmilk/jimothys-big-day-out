# Milestone 42: People drive, park and visit

## Status

Planned — Chris approved the order on 2026-10-03.

## Objective

Connect the existing street traffic to actual people. A driver arrives in a car, parks in a valid space, gets out to visit a destination, returns and drives away. Occupancy remains consistent when Jimothy interrupts the trip.

## Scope

- Visible seated drivers and a shared person/car ownership lifecycle.
- Reserved parking, arrival/departure manoeuvres and getting in/out with grounded transitions.
- Destination visits using milestone 41, plus reaction to damage and giant collection.

## Out of scope

- Player driving/stealing, citywide traffic simulation and passenger transit.

## Dependencies

- **Depends on:** 41, 32, 27, 29; fixed destruction/support behaviour.
- **Blocks:** none.

## Acceptance criteria

- [ ] The same visible person drives, parks, exits, visits, returns, enters and departs — test: `tests/drivers-parking.spec.js`.
- [ ] Cars reserve valid spaces, respect lane direction/signals and avoid conflicting parking manoeuvres — test: `tests/drivers-parking.spec.js`.
- [ ] Entry/exit uses a safe door-side position and ground contact; blocked exits wait or select another valid side — test: `tests/drivers-parking.spec.js`.
- [ ] Destroying or collecting cars/people cancels the trip without duplicated drivers, invisible occupants or stale reservations — test: `tests/drivers-parking.spec.js`.
- [ ] Travel/restart clean up ownership and reservations with bounded car/person populations — test: `tests/drivers-parking.spec.js`.
- [ ] Chris approves parking, entry/exit and the visible street activity — verified by user playtest.

## Exit condition

Chris watches a car arrive at a landmark → a driver parks, gets out, visits, returns and drives away; interrupting the trip produces a coherent reaction.

## Test plan

Failing lifecycle tests first. Inspect native views of each transition and interruption; run traffic, weight, pedestrian, ragdoll, collection and restart regressions, build and production pixel smoke.

## Notes

Source: Chris, 2026-10-03, “people should drive cars, park them, get in/out”.
