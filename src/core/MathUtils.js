// Shortest-path angle damp: frame-rate independent enough at our lerp rates,
// avoids the 2π wrap snap a naive lerp produces when crossing ±π.
export function dampAngle(current, target, lambda, delta) {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  diff -= Math.PI;
  return current + diff * Math.min(1, lambda * delta);
}
