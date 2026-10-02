# ADR-0005: Shared water surface, local ripples and buoyancy

- Date: 2026-10-02
- Status: accepted and implemented in milestone 31 under Chris's approved living-world pass

## Context

Chris requested simulated/textured water and swimming. Rendered waves must agree with buoyancy and the character's position. The island streams across kilometres, so a fluid grid covering its full destructible volume would exceed the current browser simulation budget.

## Decision

Use the same configured gravity-wave components in CPU sampling and the surface shader. Superimpose a bounded 64×64 damped wave field around Jimothy; fixed time steps respect the wave solver's stability limit. Movement, floating bodies and impacts disturb that field. Upload a separate copy to the rendering texture so verification can detect stale data.

WaterSystem owns surface sampling, wave/ripple buffers, reflections, shoreline colour/foam and splashes. PhysicsSystem retains ownership of all cannon-es bodies and applies buoyancy/drag after querying water through EventBus. JimothyController queries the same surface and applies a damped swimming height and paddle pose, then returns to ordinary ground contact at a beach. Restart clears disturbances and swimming without rebuilding GPU buffers.

## Consequences

The sea supports visible moving waves, local wakes, floating debris, wading and swimming. It is a height-field surface over the island's underlying terrain; it does not conserve finite water volumes or route water into new tunnels and breached pond basins. Fountain/pond drainage remains a separate backlog item. Reflection resolution, ripple area, active splashes and wake frequency are bounded in Constants.js.
