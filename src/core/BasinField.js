// M45 basins share their exact boundary with water shaders. A coarse island
// depth texture alone cannot represent the narrow space between lock walls.
export function basinGround(x,z,ground,basins){
 for(const b of basins)if(Math.abs(x-b.x)<b.halfX&&Math.abs(z-b.z)<b.halfZ){
  const ramp=Math.max(0,Math.min(1,(Math.abs(z-b.z)-b.halfZ+b.ramp)/b.ramp));
  return b.floor+(b.rim-b.floor)*ramp;
 }
 return ground;
}
export function basinShader(basins){
 const f=n=>Number(n).toFixed(6);
 return `float basinGround(vec2 p,float ground){${basins.map(b=>`if(abs(p.x-(${f(b.x)}))<${f(b.halfX)}&&abs(p.y-(${f(b.z)}))<${f(b.halfZ)})return mix(${f(b.floor)},${f(b.rim)},clamp((abs(p.y-(${f(b.z)}))-${f(b.halfZ)}+${f(b.ramp)})/${f(b.ramp)},0.,1.));`).join('')}return ground;}`;
}
