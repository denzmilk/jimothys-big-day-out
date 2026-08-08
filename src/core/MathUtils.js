import { FATNESS } from './Constants.js';

/** The asymptotic fatness factor: 0 when lean, approaching 1 and never
 *  reaching it. Every consequence of eating rides this one curve — body width
 *  and height, blast radius, the speed penalty, how badly bushes stop fitting —
 *  which is what makes "what you see is what you wreck" true rather than a
 *  coincidence of four separately tuned numbers.
 *
 *  It was written out longhand in four places. That is three more than this
 *  repo's own rule allows (docs/STATE.md: two consumers of one formula must
 *  share the function, not the formula), and the dev panel's power readout
 *  would have been the fifth — the one place a divergence would be invisible,
 *  since a readout that lies looks exactly like a readout that does not. */
export function fatFactor(fatness) {
  return fatness / (fatness + FATNESS.SOFTCAP);
}

// Shortest-path angle damp: frame-rate independent enough at our lerp rates,
// avoids the 2π wrap snap a naive lerp produces when crossing ±π.
export function dampAngle(current, target, lambda, delta) {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  diff -= Math.PI;
  return current + diff * Math.min(1, lambda * delta);
}

/** Even-odd point-in-polygon over [[x, z], …]. Shared by the masterplan bake
 *  and the terrain bake (milestone 17) so the coast and the street network can
 *  never disagree about which cells are land through two copies of the test. */
export function inPolygon(x, z, poly) {
  let hit = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, za] = poly[a];
    const [xb, zb] = poly[b];
    if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) hit = !hit;
  }
  return hit;
}

/** Axis-aligned bounds of a polygon as [minX, minZ, maxX, maxZ]. Bakes use it
 *  to skip the grid a shape does not touch — without it the masterplan bake
 *  tested every cell against every region: 6 million calls, 1.3 s. */
export function polygonBounds(poly) {
  let minX = Infinity; let maxX = -Infinity;
  let minZ = Infinity; let maxZ = -Infinity;
  for (const [x, z] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

/** Smooth 0→1 ramp with zero slope at both ends. Used for hill falloff and the
 *  beach, where a linear ramp leaves a visible crease at the top. */
export function smoothstep(t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
}
