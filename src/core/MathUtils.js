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
