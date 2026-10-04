import {VOXEL,SUPPORT as C} from './Constants.js';
const directions=[[0,1],[0,-1],[1,0],[-1,0]];

// JIM-48: connected horizontal runs have identical support, so a broad slab
// needs a graph of rows rather than one object and six lookups per voxel.
// Runs stop at every gap; the one-cell cuts from JIM-73 remain exact.
export function* supportTask(world,bounds){
 scan:while(true){
 yield [];
 const version=bounds.revision;
 const s=VOXEL.SIZE,CX=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y;
 const low=bounds.min.map(v=>Math.floor(v/s)),high=bounds.max.map(v=>Math.ceil(v/s)),height=high[1]-low[1]+1;
 const rowKey=(y,z)=>y-low[1]+height*(z-low[2]);
 const rows=new Map(),runs=[],revisions=new Map(),channelVersion=world.channels?.version;let work=0,scanned=0;
 const add=(x,end,y,z)=>{
  const run={x,end,y,z,links:[],held:false};runs.push(run);
  const key=rowKey(y,z);let row=rows.get(key);if(!row){row=[];rows.set(key,row);}row.push(run);
 };
 for(const chunk of world.chunks.values()){
  const bx=chunk.cx*CX,by=chunk.cy*CY,bz=chunk.cz*CX;
  if(bx>high[0]||bx+CX<low[0]||by>high[1]||by+CY<low[1]||bz>high[2]||bz+CX<low[2])continue;
  revisions.set(chunk,chunk.revision);
  for(let z=Math.max(0,low[2]-bz);z<=Math.min(CX-1,high[2]-bz);z++)for(let y=Math.max(0,low[1]-by);y<=Math.min(CY-1,high[1]-by);y++){
   if(++scanned%C.WORK===0){yield [];if(bounds.revision!==version)continue scan;}
   const row=y+CY*z;if(!chunk.rowCounts[row])continue;
   if(++work%C.ROW_WORK===0){yield [];if(bounds.revision!==version)continue scan;}
   const start=Math.max(0,low[0]-bx),end=Math.min(CX-1,high[0]-bx);let first=-1;
   for(let x=start;x<=end+1;x++){
    const stored=x<=end?chunk.data[x+CX*row]:0;
    const mat=stored&&stored!==VOXEL.EMPTY?world.get(bx+x,by+y,bz+z):0;
    if(mat&&mat!==VOXEL.BEDROCK){if(first<0)first=x;}
    else if(first>=0){add(bx+first,bx+x-1,by+y,bz+z);first=-1;}
   }
  }
 }
 for(const row of rows.values())row.sort((a,b)=>a.x-b.x);
 const rowAt=(y,z)=>y<low[1]||y>high[1]||z<low[2]||z>high[2]?[]:rows.get(rowKey(y,z))||[];
 const anchorGap=(r,start,end,y,z)=>{for(let x=start;x<=end;x++)if(world.get(x,y,z)){r.held=true;break;}};
 const overlapStart=(row,x)=>{let a=0,b=row.length;while(a<b){const m=(a+b)>>1;if(row[m].end<x)a=m+1;else b=m;}return a;};
 for(const row of rows.values())for(let i=0;i<row.length;i++){
  if(++work%C.ROW_WORK===0){yield [];if(bounds.revision!==version)continue scan;}
  const r=row[i];
  for(const [other,x]of [[row[i-1],r.x-1],[row[i+1],r.end+1]]){
   if(other&&other.x<=x&&other.end>=x)r.links.push(other);
   else if(world.get(x,r.y,r.z))r.held=true;
  }
  for(const [dy,dz]of directions){
   const y=r.y+dy,z=r.z+dz,neighbours=rowAt(y,z);let cursor=r.x;
   for(let j=overlapStart(neighbours,r.x);j<neighbours.length&&neighbours[j].x<=r.end;j++){
    const other=neighbours[j];r.links.push(other);
    if(!r.held&&other.x>cursor)anchorGap(r,cursor,Math.min(r.end,other.x-1),y,z);
    cursor=Math.max(cursor,other.end+1);
   }
   if(!r.held&&cursor<=r.end)anchorGap(r,cursor,r.end,y,z);
  }
 }
 const queue=runs.filter(r=>r.held);
 for(let i=0;i<queue.length;i++){
  if(++work%C.ROW_WORK===0){yield [];if(bounds.revision!==version)continue scan;}
  for(const other of queue[i].links)if(!other.held){other.held=true;queue.push(other);}
 }
 // A cut made while this cooperative scan yielded may split a former run.
 // Rebuild only if its sampled chunks/channel changed, before deleting cells.
 if(world.channels?.version!==channelVersion||[...revisions].some(([c,r])=>c.revision!==r)){
  continue;
 }
 let removed=[];
 for(const r of runs){
  if(++work%C.WORK===0){yield removed;removed=[];}
  if(r.held)continue;
  for(let x=r.x;x<=r.end;x++){
   if(++work%C.WORK===0){yield removed;removed=[];}
   const mat=world.get(x,r.y,r.z);if(!mat||mat===VOXEL.BEDROCK)continue;
   world.setEdit(x,r.y,r.z,0);world.removedCount++;removed.push({x:(x+.5)*s,y:(r.y+.5)*s,z:(r.z+.5)*s,mat});
  }
 }
 if(removed.length)yield removed;
 if(bounds.revision!==version)continue;
 return;
 }
}
