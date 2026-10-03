import {VOXEL,SUPPORT as C} from './Constants.js';
const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

// JIM-73: a one-cell cut must sever a wall even inside a former coarse group.
// Sparse stored cells include footings at grade; unedited implicit earth can
// anchor them only through a remaining neighbour, never through old height.
export function* supportTask(world,bounds){
 yield [];
 const s=VOXEL.SIZE,CX=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y,nodes=new Map();let work=0;
 const low=bounds.min.map(v=>Math.floor(v/s)),high=bounds.max.map(v=>Math.ceil(v/s));
 const width=high[0]-low[0]+1,height=high[1]-low[1]+1;
 const inside=(x,y,z)=>x>=low[0]&&x<=high[0]&&y>=low[1]&&y<=high[1]&&z>=low[2]&&z<=high[2];
 const key=(x,y,z)=>x-low[0]+width*(y-low[1]+height*(z-low[2]));
 for(const chunk of world.chunks.values()){
  const bx=chunk.cx*CX,by=chunk.cy*CY,bz=chunk.cz*CX;
  if(bx>high[0]||bx+CX<low[0]||by>high[1]||by+CY<low[1]||bz>high[2]||bz+CX<low[2])continue;
  for(let z=Math.max(0,low[2]-bz);z<=Math.min(CX-1,high[2]-bz);z++)for(let y=Math.max(0,low[1]-by);y<=Math.min(CY-1,high[1]-by);y++){
   if(++work%C.WORK===0)yield [];
   const row=y+CY*z;if(!chunk.rowCounts[row])continue;
   for(let x=Math.max(0,low[0]-bx);x<=Math.min(CX-1,high[0]-bx);x++){
    if(++work%C.WORK===0)yield [];
    const stored=chunk.data[x+CX*row];if(!stored||stored===VOXEL.EMPTY)continue;
    const vx=bx+x,vy=by+y,vz=bz+z,mat=world.get(vx,vy,vz);if(!mat||mat===VOXEL.BEDROCK)continue;
    nodes.set(key(vx,vy,vz),{x:vx,y:vy,z:vz,mat,held:false});
   }
  }
 }
 const queue=[];
 for(const node of nodes.values()){
  if(++work%C.WORK===0)yield [];
  for(const [dx,dy,dz]of directions){
   const x=node.x+dx,y=node.y+dy,z=node.z+dz;
   if(inside(x,y,z)&&nodes.has(key(x,y,z)))continue;
   if(world.get(x,y,z)){node.held=true;queue.push(node);break;}
  }
 }
 for(let i=0;i<queue.length;i++){
  if(++work%C.WORK===0)yield [];
  const n=queue[i];if(!world.get(n.x,n.y,n.z))continue;
  for(const [dx,dy,dz]of directions){
   const x=n.x+dx,y=n.y+dy,z=n.z+dz;if(!inside(x,y,z))continue;
   const node=nodes.get(key(x,y,z));
   if(node&&!node.held){node.held=true;queue.push(node);}
  }
 }
 let removed=[];
 for(const node of nodes.values()){
  if(++work%C.WORK===0){yield removed;removed=[];}
  if(node.held)continue;
  const {x,y,z,mat}=node;if(world.get(x,y,z)!==mat)continue;
  world.setEdit(x,y,z,0);world.removedCount++;removed.push({x:(x+.5)*s,y:(y+.5)*s,z:(z+.5)*s,mat});
 }
 if(removed.length)yield removed;
}
