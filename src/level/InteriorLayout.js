import {VOXEL,BUILDINGS,INTERIORS as C} from '../core/Constants.js';
const cell=m=>Math.max(1,Math.round(m/VOXEL.SIZE));
export const interiorHash=(x,z)=>Math.abs(Math.imul(x,73856093)^Math.imul(z,19349663))>>>0;

// ADR-0006: voxel walls, props and routes consume this same local plan, so
// rotating a facade cannot leave its residents walking through a different door.
export function interiorPoint(b,x,y,z){
 let px=x,pz=z;const front=b.front||0;
 if(front===1){px=b.vw-z;pz=x;}if(front===2){px=b.vw-x;pz=b.vd-z;}if(front===3){px=z;pz=b.vd-x;}
 return{x:(b.vx+px)*VOXEL.SIZE,y:(b.vy+y)*VOXEL.SIZE,z:(b.vz+pz)*VOXEL.SIZE};
}
const cache=new Map();
export function planInterior(b){
 const cacheKey=JSON.stringify([b.vx,b.vy,b.vz,b.vw,b.vd,b.vh,b.front,b.type,b.style,b.palette]);if(cache.has(cacheKey))return cache.get(cacheKey);
 const w=b.front%2?b.vd:b.vw,d=b.front%2?b.vw:b.vd,porch=b.type==='craftsman'?cell(BUILDINGS.PORCH_DEPTH):0;
 const storey=cell(BUILDINGS.STOREY),height=b.vh,id=`home:${b.vx}:${b.vz}`,seed=interiorHash(b.vx,b.vz);
 const count=b.type==='warehouse'?1:Math.max(1,1+Math.floor((height-cell(C.MIN_HEADROOM))/storey));
 const hall=cell(C.HALL),middle=Math.floor(w/2),hl=middle-Math.floor(hall/2),hr=hl+hall;
 const landing=cell(C.LANDING),start=porch+landing+1,end=d-landing-1,hasStairs=count>1;
 const stairs=hasStairs?{x0:w-1-cell(C.STAIR_WIDTH),x1:w-2,z0:start,z1:end,run:Math.max(1,Math.floor((end-start)/storey))}:null;
 if(stairs)stairs.z1=stairs.z0+stairs.run*storey-1;
 const floors=[],nodes=[],walls=[],rects=[],doors=[];
 const add=(key,x,y,z,floor)=>{const n={key:`${id}:${key}`,local:{x,y,z},...interiorPoint(b,x,y,z),floor,links:[]};nodes.push(n);return n;};
 const link=(a,b)=>{a.links.push(b.key);b.links.push(a.key);};
 const floorNodes=[];
 for(let f=0;f<count;f++){
  const y=f*storey,fy=y+1,top=f===count-1?height:Math.min(height,y+storey),key=`${id}:${f}`;
  const front=add(`${f}:front`,middle+.5,fy,porch+landing/2,f),back=add(`${f}:back`,middle+.5,fy,d-landing/2-1,f);floorNodes.push({front,back});
  const mid=add(`${f}:hall`,middle+.5,fy,(start+end)/2,f);link(front,mid);link(mid,back);
  const rooms=[],sides=[[1,hl-1],[hr+1,stairs?stairs.x0-2:w-2]],min=cell(C.ROOM_MIN);
  const compact=(b.type==='craftsman'&&f===0)||sides.some(([a,b])=>b-a+1<min)||end-start<min;
  const material=C.WALL_PALETTE[(seed+f)%C.WALL_PALETTE.length];
  const doorFor=(wall,roomIds,sign)=>{
   const axis=wall.axis,x=axis==='x'?wall.at+.5:wall.door0,z=axis==='x'?wall.door0:wall.at+.5;
   doors.push({id:`${key}:door:${doors.length}`,floor:key,axis,x,z,y:fy,width:(wall.door1-wall.door0+1)*VOXEL.SIZE,height:cell(BUILDINGS.DOOR_HEIGHT)*VOXEL.SIZE,rooms:roomIds,sign,exterior:false});
  };
  const roomFor=(purpose,x0,x1,z0,z1,side,open=false)=>{
   const index=rooms.length,id=`${key}:room:${index}`,doorZ=(z0+z1+1)/2;
   const route=add(`${f}:door:${index}`,middle+.5,fy,doorZ,f);link(front,route);link(route,back);
   const node=add(`${f}:room:${index}`,x0+(x1-x0+1)*(compact?C.COMPACT_NODE_RATIO:C.ROOM_NODE_RATIO),fy,doorZ,f);link(route,node);
   const room={id,purpose,x0,x1,z0,z1,node:node.key,side,open};rooms.push(room);return room;
  };
  if(compact){
   // Small homes cannot pay for a hall on both sides. Use the full depth for
   // living space, with a rear room only when both halves remain usable.
   const x0=1,x1=stairs?stairs.x0-2:w-2,z0=porch+1,z1=d-2,split=Math.floor((z0+z1)/2);
   const home=['craftsman','shed','apartment'].includes(b.type);
   if(split-z0>=min&&z1-split>=min){
    const a=roomFor(home?(f===0?'studio':'bedroom'):'office',x0,x1,z0,split-1,0),broom=roomFor(home?'bedroom':'stock',x0,x1,split+1,z1,0);
    const width=cell(C.DOOR),door0=middle-Math.floor(width/2),wall={material,axis:'z',at:split,from:x0,to:x1,y:fy,top:top-1,door0,door1:door0+width-1};
    walls.push(wall);doorFor(wall,[a.id,broom.id],-1);
   }else roomFor(home?'studio':b.type==='warehouse'?'stock':'office',x0,x1,z0,z1,0,true);
  }else{
   for(let side=0;side<2;side++){
    const [x0,x1]=sides[side],depth=end-start,cut=Math.max(start+min,Math.min(end-min-1,Math.floor(start+depth*C.SPLITS[seed%C.SPLITS.length])));
    const splits=depth>=min*2+1?[start,cut,end]:[start,end];
    for(let r=0;r<splits.length-1;r++){
     const z0=splits[r]+(r?1:0),z1=splits[r+1]-1,index=rooms.length;
     const home=['craftsman','shed','apartment'].includes(b.type);
     const purposes=home?(f===0?['living','kitchen','bedroom','bathroom']:['bedroom','bathroom','bedroom','office']):b.type==='warehouse'?['stock','office','stock','stock']:b.type==='shop'?['shop','cafe','stock','office']:['office','office','office','stock'];
     const room=roomFor(purposes[index%purposes.length],x0,x1,z0,z1,side),doorZ=Math.floor((z0+z1)/2),width=cell(C.DOOR),door0=doorZ-Math.floor(width/2);
     const wall={material,axis:'x',at:side?hr:hl,from:z0,to:z1,y:fy,top:top-1,door0,door1:door0+width-1};walls.push(wall);doorFor(wall,[room.id],side?1:-1);
     if(r>0)walls.push({material,axis:'z',at:z0-1,from:x0,to:x1,y:fy,top:top-1});
    }
   }
  }

  if(stairs){
   const sx=(stairs.x0+stairs.x1+1)/2,lower=add(`${f}:stair-front`,sx,fy,stairs.z0-landing/2,f),upper=add(`${f}:stair-back`,sx,fy,stairs.z1+landing/2+1,f);link(front,lower);link(back,upper);floorNodes[f].lower=lower;floorNodes[f].upper=upper;
   if(f<count-1){let prev=lower;for(let k=0;k<storey;k++){const n=add(`${f}:step:${k}`,sx,fy+k+1,stairs.z0+(k+.5)*stairs.run,f);link(prev,n);prev=n;}floorNodes[f].last=prev;}
  }
  floors.push({id:key,index:f,localY:fy,rooms,home:b,...interiorPoint(b,middle+.5,fy,(porch+d)/2),nodes:nodes.filter(n=>n.floor===f)});
  rects.push({x0:0,x1:w-1,z0:porch,z1:d-1,y,hole:f>0?stairs:null,material:['warehouse','shop','tower'].includes(b.type)?C.WET_FLOOR:C.FLOOR_MATERIAL});
 }
 if(stairs)for(let f=0;f<count-1;f++)link(floorNodes[f].last,floorNodes[f+1].upper);
 const entrance=add('exit',middle+.5,1,porch-cell(C.LANDING),0);link(entrance,floorNodes[0].front);
 const frontWidth=cell(BUILDINGS.DOOR_WIDTH);
 doors.unshift({id:`${id}:front-door`,floor:`${id}:0`,axis:'z',x:middle-Math.floor(frontWidth/2),z:porch+.5,y:1,width:frontWidth*VOXEL.SIZE,height:(cell(BUILDINGS.DOOR_HEIGHT)-1)*VOXEL.SIZE,rooms:[],sign:-1,exterior:true});
 const plan={id,seed,b,w,d,porch,storey,stairs,floors,nodes,walls,rects,doors,entrance};if(cache.size>=C.PLAN_CACHE)cache.delete(cache.keys().next().value);cache.set(cacheKey,plan);return plan;
}

export function* writeInterior(plan,put){
 const dh=cell(BUILDINGS.DOOR_HEIGHT);
 for(const r of plan.rects)for(let x=r.x0;x<=r.x1;x++){yield;for(let z=r.z0;z<=r.z1;z++){
  if(r.hole&&x>=r.hole.x0&&x<=r.hole.x1&&z>=r.hole.z0&&z<=r.hole.z1)continue;put(x,r.y,z,r.material);
 }}
 for(const wall of plan.walls)for(let y=wall.y;y<=wall.top;y++){yield;for(let a=wall.from;a<=wall.to;a++){
  if(a>=wall.door0&&a<=wall.door1&&y-wall.y<dh)continue;
  const trim=(a===wall.door0-1||a===wall.door1+1)&&y-wall.y<=dh||y-wall.y===dh&&a>=wall.door0-1&&a<=wall.door1+1;
  put(wall.axis==='x'?wall.at:a,y,wall.axis==='z'?wall.at:a,trim?C.WALL_MATERIAL:y===wall.y?C.SKIRT_MATERIAL:wall.material||C.WALL_MATERIAL);
 }}
 if(plan.stairs)for(let f=0;f<plan.floors.length-1;f++)for(let k=0;k<plan.storey;k++){
  yield;const s=plan.stairs;
  // A two-cell tread slab has an underside and remains individually breakable.
  for(let x=s.x0;x<=s.x1;x++)for(let z=s.z0+k*s.run;z<s.z0+(k+1)*s.run;z++)put(x,f*plan.storey+k+1,z,C.STAIR_MATERIAL);
 }
}

// Preserve the routes used by the people, including the long entrance spine
// in an open studio. Furniture in a corner must not cut a diagonal shortcut.
export function blocksInteriorRoute(plan,floor,x,z,hx,hz){
 const s=VOXEL.SIZE,pad=C.ROOM_CLEARANCE;
 const crosses=(a,b)=>{
  let enter=0,leave=1;
  for(const [p,d,lo,hi]of[[a.x*s,(b.x-a.x)*s,x-hx-pad,x+hx+pad],[a.z*s,(b.z-a.z)*s,z-hz-pad,z+hz+pad]]){
   if(Math.abs(d)<Number.EPSILON){if(p<lo||p>hi)return false;continue;}
   const t0=(lo-p)/d,t1=(hi-p)/d;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));if(enter>leave)return false;
  }
  return true;
 };
 for(const node of floor.nodes)for(const key of node.links){const next=plan.nodes.find(n=>n.key===key);if(next?.floor===floor.index&&crosses(node.local,next.local))return true;}
 for(const door of plan.doors.filter(d=>d.floor===floor.id)){
  const px=door.x*s,pz=door.z*s,dx=Math.max(Math.abs(px-x)-hx,0),dz=Math.max(Math.abs(pz-z)-hz,0);
  if(Math.hypot(dx,dz)<door.width+C.DOOR_CLEARANCE)return true;
 }
 return false;
}
