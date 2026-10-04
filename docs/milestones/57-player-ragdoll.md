# Milestone 57: Jimothy impact ragdoll

## Status and scope

Implemented, awaiting Chris's playtest. Authorised by the sequential playground queue, step 3. Depends on M53 vehicle ownership, M54/M55 footing, M56 rolling and the JIM-69 skin checkpoint. Keep the original skinned Jimothy and the net-only run ending. Size reduces knockback and limits articulated simulation to smaller bodies. Kicks use the same hit contract; the NPC kick behaviour belongs to the following wanted-response milestone.

## Acceptance criteria

- [x] An existing strong launch gives small Jimothy articulated Cannon limbs, head and tail, with one torso/movement owner. A car impact, car blast and military blast trigger visible knockback; parked/slow cars and harmless effects do not repeatedly launch him.
- [x] The same impact moves a heavy Jimothy less. Giant hits retain bounded recoil without adding giant limb bodies. Repeated hits cannot multiply bodies/constraints or indefinitely trap control.
- [x] Ground/ceiling contact, bounded get-up and return to walking remain fluid in the regression routes. Water, riding, size changes, comet spawn, capture and restart release physical/pose ownership safely. Extinguisher propulsion keeps its existing tool-controlled behaviour.
- [x] Regression checks cover 30/60/120 Hz, lifecycle cleanup and nearby human ragdolls/vehicle collisions. Native original-rig impact/get-up clips, state snapshots, build and pixel smoke are console-clean. Record remaining limits explicitly.
- [ ] Chris judges floppy impact, size resistance and recovery feel — verified by user playtest.

## Direction

PhysicsSystem keeps the current player sphere as the dynamic torso during launch and lends it to one bounded ragdoll. Additional jointed limb/head/tail bodies drive the original skeleton; self-collision is disabled within that ragdoll. Recovery releases the added bodies and blends back to the normal controller/IK pose. This extends ADR-0002's launch regime without duplicating the player's torso or importing another model.

**Exit:** a small Jimothy gets hit by a moving car or blast → tumbles with loose limbs → lands and gets up → movement works; repeating the hit at giant size gives a smaller response without a simulation spike.

## Implementation and evidence — 2026-10-04

The existing sphere is the single dynamic torso; the original twelve-bone skin receives ten additional articulated head/tail/leg segments. Car motion is swept relative to the player before Cannon steps, including kinematic traffic. `player:hit` applies size resistance and immunity. Nearby car/firework/tank-wreck effects use it; military shells retain their prior impulse and cooldown, with one launch per hit. Parked and 2 m/s cars stay quiet; a 14 m/s sweep gives a 15.75 m/s launch. One car blast gives 18.01 m/s at fat 0, 3.39 at fat 90 and 0.918 at fat 400; the latter two keep their held roll and create no limbs.

Eleven focused browser cases pass in `player-ragdoll-final.log`. Loaded-rig launches at 30/60/120 Hz retain the same skin, create eleven bodies/ten joints including the borrowed torso, rotate the limbs and return grounded control with no residual constraints. The real voxel room catches the torso exactly at its 41.36 m ceiling and returns feet to its 39.16 m floor. The initial ceiling fixture compared two points on a sloping street after physical sideways drift; replacing that fixture with a level voxel floor isolates the intended same-storey assertion without widening its tolerance.

Review reproduced and fixed direct-reset stun/ride masks, giant car blasts cancelling rolls, and missing firework knockback. Further launches redirect an active tumble without extending its recovery timer or multiplying bodies. Army blasts apply one launch; extinguisher propulsion retains its equipped tool and animated pose. All 142 Node tests and production build pass.

Native original-rig clips: `output/iterate/player-ragdoll-native/{blast,car,giant}.mp4`, plus frames and `report.json`. Console errors: zero. Maximum sampled joint-pivot separation is 1.84 cm for the blast and 21.97 cm during car contact; all parts release on recovery. This is bounded arcade ragdoll behaviour with the existing torso sphere and voxel clamp, not a per-triangle soft-body simulation. Original mesh texture stretch and giant performance (JIM-48) remain separate open concerns. NPC kicking behaviour is scheduled in the next response milestone; this milestone supplies its hit contract.

Twelve of thirteen adjacent cases pass: car crashes/ejection/reset/water/growth, human knockdowns/collection, military recovery, building ceiling/wall contact and two comet lifecycle cases. The remaining comet-exit case fails identically on isolated prior pushed HEAD `c55fee8` (2.63 m versus >3 m); new traffic impacts disabled also retain the snag. JIM-99 tracks this existing movement blocker for the next repair; the assertion remains unchanged. Logs: `player-ragdoll-adjacent.log`, `player-ragdoll-comet-baseline.log`, `player-ragdoll-comet-exit.json`. Native actual-world `player-ragdoll-world` frames/report show the physical → idle return and cleared stun with no console errors. Production smoke reads distinct sky/ground pixels and reports no console errors (`player-ragdoll-smoke.log`). No FPS improvement is claimed.
