# ADR-0006 — Continuous building interiors

Accepted 2026-10-02 for the user-authorised interior pass (milestone 38).

## Decision
Generate rooms inside the existing voxel shells, with destructible floor slabs, partitions and stairs. A seeded layout description is shared by voxel generation, furnishings and resident navigation. Doors are open passageways: no portal scene or loading transition. This keeps broken walls and windows, giant demolition and rolling collection continuous with the street.

Only nearby buildings/floors activate detailed furniture and residents. Use existing event-driven prop physics, human ragdolls and asset caches. Retain removed/moved furnishings for the run, reset them on restart. Use the existing ambient/day-night lighting without adding a point light per room.

## Trade-offs
Tall buildings gain sparse floor/partition geometry. Furnishings and residents are distance/vertical-budgeted, rather than simulating every apartment at once. Floor-aware queries must start near the actor's feet so upper storeys do not pull people onto roofs.

## Amendment — 2026-10-03, milestone 50
Chris requested front and connected room doors plus less cramped rooms. The open-passage-only scope is superseded by nearby hinged leaves driven from the same voxel plan. Door models are parameterised panel/handle meshes in `DoorModels.js`; frames remain destructible voxels. Hinged leaves are kinematic shared props and open on approach. Impact or loss of the jamb releases/breaks them through the existing dynamic prop and collection lifecycle. All physics remains owned by PhysicsSystem.

Voxel sight and the camera also query animated leaves through `WORLD_OCCLUSION`; `WORLD_OCCLUSION_CHANGED` invalidates cached radar sight shapes. This avoids writing/remeshing voxels whenever a door turns. Interior residents and traffic-obstacle snapshots of outdoor people/pursuers trigger opening. Small homes use open living space and a connected rear room; other footprints only subdivide when a room remains at least three metres across. Near budgets stay four floors, 64 furnishings, 16 fragments and eight residents, plus at most 32 door leaves.
