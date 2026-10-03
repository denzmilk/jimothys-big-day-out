import {VOXEL,SUPPORT as C} from './Constants.js';
const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
// Connectivity is grouped at 0.88 m, but links require touching real voxel
// faces. Checking only vertical columns would wrongly drop a spanning roof.
export function* supportTask(world,bounds){
 yield [];const s=VOXEL.SIZE,K=C.CELL_VOXELS,CX=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y,nodes=new Map();let work=0;
 const low=bounds.min.map(v=>Math.floor(v/s)),high=bounds.max.map(v=>Math.ceil(v/s));
 const key=(x,y,z)=>`${Math.floor(x/K)},${Math.floor(y/K)},${Math.floor(z/K)}`;
 for(const chunk of world.chunks.values()){
  const bx=chunk.cx*CX,by=chunk.cy*CY,bz=chunk.cz*CX;
  if(bx>high[0]||bx+CX<low[0]||by>high[1]||by+CY<low[1]||bz>high[2]||bz+CX<low[2])continue;
  for(const [column,bits] of chunk.damageColumns){
   const x=bx+column%CX,z=bz+Math.floor(column/CX);if(x<low[0]||x>high[0]||z<low[2]||z>high[2])continue;
   const wx=(x+.5)*s,wz=(z+.5)*s,grade=(world.terrain?.surfaceHeight(wx,wz)||0)+(world.channels?.sample(wx,wz)||0);
   let mask=bits;
   while(mask){
    if(++work%C.WORK===0)yield [];
    const bit=mask&-mask;mask=(mask&~bit)>>>0;const y=by+31-Math.clz32(bit);if(y<low[1]||y>high[1])continue;
    const mat=world.get(x,y,z);if(!mat||mat===VOXEL.BEDROCK)continue;
    const id=key(x,y,z);let node=nodes.get(id);if(!node){node={cells:[],links:new Set(),anchor:false};nodes.set(id,node);}node.cells.push([x,y,z,mat]);
    if(y*s<=grade+s)node.anchor=true;
    for(const [dx,dy,dz] of directions){
     const nx=x+dx,ny=y+dy,nz=z+dz,id2=key(nx,ny,nz);if(id2===id||!world.get(nx,ny,nz))continue;
     if(nx<low[0]||nx>high[0]||ny<low[1]||ny>high[1]||nz<low[2]||nz>high[2])node.anchor=true;
     else node.links.add(id2);
    }
   }
  }
 }
 const queue=[];for(const [id,node]of nodes)if(node.anchor){node.held=true;queue.push(id);}
 for(let i=0;i<queue.length;i++){
  if(++work%C.WORK===0)yield [];
  for(const key of nodes.get(queue[i]).links){const node=nodes.get(key);if(node&&!node.held){node.held=true;queue.push(key);}}
 }
 let removed=[];
 for(const node of nodes.values())if(!node.held)for(const [x,y,z,mat] of node.cells){
  if(++work%C.WORK===0){yield removed;removed=[];}
  if(world.get(x,y,z)!==mat)continue;
  world.setEdit(x,y,z,0);world.removedCount++;removed.push({x:(x+.5)*s,y:(y+.5)*s,z:(z+.5)*s,mat});
 }
 if(removed.length)yield removed;
}
