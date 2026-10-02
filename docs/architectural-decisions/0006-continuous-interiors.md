# ADR-0006 — Continuous building interiors

Accepted 2026-10-02 for the user-authorised interior pass (milestone 38).

## Decision
Generate rooms inside the existing voxel shells, with destructible floor slabs, partitions and stairs. A seeded layout description is shared by voxel generation, furnishings and resident navigation. Doors are open passageways: no portal scene or loading transition. This keeps broken walls and windows, giant demolition and rolling collection continuous with the street.

Only nearby buildings/floors activate detailed furniture and residents. Use existing event-driven prop physics, human ragdolls and asset caches. Retain removed/moved furnishings for the run, reset them on restart. Use the existing ambient/day-night lighting without adding a point light per room.

## Trade-offs
Tall buildings gain sparse floor/partition geometry. Furnishings and residents are distance/vertical-budgeted, rather than simulating every apartment at once. Floor-aware queries must start near the actor's feet so upper storeys do not pull people onto roofs.
