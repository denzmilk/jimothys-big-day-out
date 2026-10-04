import {SEWER as C,VOXEL,PLAYER_CONFIG as P} from '../core/Constants.js';
import {profile} from './SewerLayout.js';

const plans=new WeakMap();

// M55: broad flights and level corners share one plan with voxel generation
// and traversal inspection; the old one-cell spiral could not support a body.
export function planSewerStairs(entrance,terrain){
 let cache=plans.get(terrain);if(!cache)plans.set(terrain,cache=new Map());
 const key=`${entrance.x},${entrance.z}`;if(cache.has(key))return cache.get(key);
 const s=VOXEL.SIZE,n=C.SHAFT,w=C.STAIR_WIDTH,tread=C.STAIR_TREAD;
 const ox=Math.round(entrance.x/s)-Math.floor(n/2),oz=Math.round(entrance.z/s)-Math.floor(n/2);
 let floor=terrain.topSolidVoxelY(entrance.x,entrance.z)-Math.round(C.DEPTH/s);
 const portals=[];
 for(let cell=0;cell<n;cell++)for(const [x,z] of [[-2,cell],[n+1,cell],[cell,-2],[cell,n+1]]){
  const wx=(ox+x+.5)*s,wz=(oz+z+.5)*s,bore=profile(wx,wz);
  if(bore.inside){const y=Math.round(bore.floor/s);floor=Math.min(floor,y);portals.push({x:wx,y:y*s,z:wz,d:bore.d});}
 }
 // A graded bore may be several metres below the centre of the shaft.
 // Finish at its lowest doorway, so the bottom landing never seals the exit.
 const corners=[[0,0],[n-w,0],[n-w,n-w],[0,n-w]];
 const levels=corners.map(([x,z])=>terrain.topSolidVoxelY((ox+x+w/2)*s,(oz+z+w/2)*s));
 const entrySide=levels.indexOf(Math.min(...levels)),top=levels[entrySide];
 const spiral=turn=>{
  let y=top,side=entrySide;const slabs=[],path=[];
  const add=(x,z,dx,dz,landing=false)=>{
   slabs.push({x:ox+x,z:oz+z,dx,dz,y,landing});
   path.push({x:(ox+x+dx/2)*s,y:(y+1)*s,z:(oz+z+dz/2)*s,landing});
  };
  while(y>=floor){
   const [x,z]=corners[side];add(x,z,w,w,true);
   for(let distance=w;distance<n-w&&y>=floor;distance+=tread){
    const length=Math.min(tread,n-w-distance),edge=turn>0?side:(side+3)%4,d=turn>0?distance:n-distance-length;y--;
    if(edge===0)add(d,0,length,w);
    if(edge===1)add(n-w,d,w,length);
    if(edge===2)add(n-d-length,n-w,length,w);
    if(edge===3)add(0,n-d-length,w,length);
   }
   side=(side+turn+corners.length)%corners.length;
  }
  const radius=C.STAIR_DOOR_CELLS*s/2;
  const center={x:(ox+n/2)*s,z:(oz+n/2)*s};
  const exits=portals.filter(q=>{
   const steps=Math.ceil(Math.hypot(q.x-center.x,q.z-center.z)/s);
   for(let i=0;i<=steps;i++){
    const x=center.x+(q.x-center.x)*i/steps,z=center.z+(q.z-center.z)*i/steps;
    if(slabs.some(t=>x+radius>t.x*s&&x-radius<(t.x+t.dx)*s&&z+radius>t.z*s&&z-radius<(t.z+t.dz)*s
      &&q.y+P.RADIUS<(t.y+1)*s&&q.y+C.STAIR_HEADROOM>(t.y-C.STAIR_THICKNESS+1)*s))return false;
   }
   return true;
  }).sort((a,b)=>a.y-b.y||a.d-b.d);
  return {slabs,path,exit:exits[0],turn};
 };
 // Reversing the flights keeps the lower doorway from being crossed by a
 // low tread. Pick the direction with the lowest clear connection to the bore.
 const choices=[spiral(1),spiral(-1)].sort((a,b)=>(a.exit?.y??Infinity)-(b.exit?.y??Infinity));
 const {slabs,path,exit,turn}=choices[0];
 const first=path[0],outward=[[-1,0],[0,-1],[1,0],[0,1]][entrySide];
 const approach={x:first.x+outward[0]*(w/2+C.STAIR_APPROACH)*s,z:first.z+outward[1]*(w/2+C.STAIR_APPROACH)*s};
 approach.y=Math.ceil(terrain.surfaceHeight(approach.x,approach.z)/s)*s;
 const route=[approach,...path,{x:(ox+n/2)*s,y:floor*s,z:(oz+n/2)*s},...(exit?[exit]:[])];
 const plan={ox,oz,n,width:w,top,floor,slabs,path,portals,entrySide,route,turn,exit};cache.set(key,plan);return plan;
}
