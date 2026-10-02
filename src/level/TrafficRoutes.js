import * as City from './CityPlanner.js';
import {TRAFFIC as C,STREET} from '../core/Constants.js';

const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const width=(r,i)=>r.streetFrame.widths[i%r.arterialEvery===0?'arterial':'street'].width;
export const roadClear=(x,z)=>[[0,0],[STREET.ROAD_CLEARANCE,0],[-STREET.ROAD_CLEARANCE,0],[0,STREET.ROAD_CLEARANCE],[0,-STREET.ROAD_CLEARANCE]].every(([dx,dz])=>City.classAt(x+dx,z+dz)===City.CLASS.ROAD);

// M32: lanes share the district frame used to stamp roads and grade paving.
// An arbitrary world grid can send cars diagonally across a rotated street.
export function buildTrafficRoutes(){
 City.bake();const junctions=new Map(),roads=[],lamps=[],signals=[];
 for(const region of City.regions){
  const f=region.streetFrame;if(!f)continue;
  const local=region.polygon.map(([x,z])=>[x*f.cos+z*f.sin-f.originU,-x*f.sin+z*f.cos-f.originV]);
  const world=(u,v)=>({x:(u+f.originU)*f.cos-(v+f.originV)*f.sin,z:(u+f.originU)*f.sin+(v+f.originV)*f.cos});
  const key=(u,v)=>`${region._index}:${u}:${v}`;
  for(let u=Math.floor(Math.min(...local.map(p=>p[0]))/region.block[0]);u<=Math.ceil(Math.max(...local.map(p=>p[0]))/region.block[0]);u++)
   for(let v=Math.floor(Math.min(...local.map(p=>p[1]))/region.block[1]);v<=Math.ceil(Math.max(...local.map(p=>p[1]))/region.block[1]);v++){
    const wu=width(region,u),wv=width(region,v),p=world(u*region.block[0]+wu/2,v*region.block[1]+wv/2);
    if(!roadClear(p.x,p.z)||City.regionAtWorld(p.x,p.z)!==region)continue;
    junctions.set(key(u,v),{id:key(u,v),...p,u,v,wu,wv,region:region._index,outgoing:[],incoming:[],offset:Math.abs(u*C.OFFSET_U+v*C.OFFSET_V)%C.OFFSET_SPAN});
   }
  for(const j of junctions.values())if(j.region===region._index)for(const [index,[du,dv]] of directions.entries()){
   const to=junctions.get(key(j.u+du,j.v+dv));if(!to)continue;
   const dir={x:du*f.cos-dv*f.sin,z:du*f.sin+dv*f.cos},axis=du?0:1,roadWidth=du?j.wv:j.wu,lane=Math.min(C.LANE_OFFSET,roadWidth*C.LANE_SHARE);
   const startInset=(du?j.wu:j.wv)/2+C.APPROACH_MARGIN,endInset=(du?to.wu:to.wv)/2+C.APPROACH_MARGIN;
   const centreStart={x:j.x+dir.x*startInset,z:j.z+dir.z*startInset},centreEnd={x:to.x-dir.x*endInset,z:to.z-dir.z*endInset};
   const start={x:centreStart.x-dir.z*lane,z:centreStart.z+dir.x*lane},end={x:centreEnd.x-dir.z*lane,z:centreEnd.z+dir.x*lane};
   const length=Math.hypot(end.x-start.x,end.z-start.z);let clear=length>C.MIN_ROAD;
   for(let d=0;clear&&d<=length;d+=C.ROAD_SAMPLE)clear=roadClear(start.x+(end.x-start.x)*d/length,start.z+(end.z-start.z)*d/length);
   if(!clear||!roadClear(end.x,end.z))continue;
   const road={id:`${j.id}>${to.id}`,from:j,to,axis,index,dir,start,end,centreStart,centreEnd,length,width:roadWidth,lane};
   roads.push(road);j.outgoing.push(road);to.incoming.push(road);
   for(let d=C.LAMP_START;d<length-C.LAMP_START;d+=C.LAMP_SPACING){
    const x=start.x+dir.x*d-dir.z*(roadWidth/2+C.PAVEMENT_INSET-lane),z=start.z+dir.z*d+dir.x*(roadWidth/2+C.PAVEMENT_INSET-lane);
    if(City.classAt(x,z)===City.CLASS.FOOTPATH)lamps.push({id:`lamp-${road.id}-${d}`,x,z,yaw:Math.atan2(dir.x,dir.z),seed:0});
   }
  }
 }
 // Baked pavement edges are quantized, so a mathematically centred corner
 // may land just outside them. Fit every approach before enabling its signal.
 for(const j of junctions.values()){
  const heads=[];j.signalled=false;
  if(j.outgoing.length<C.SIGNAL_MIN_ROADS)continue;
  for(const road of j.incoming){
   const {dir,end,width,lane}=road;let site=null;
   for(let back=0;!site&&back<=C.SIGNAL_SEARCH;back+=C.SIGNAL_SEARCH_STEP)for(const inset of C.SIGNAL_SITE_OFFSETS){
    const x=end.x-dir.x*back-dir.z*(width/2+inset-lane),z=end.z-dir.z*back+dir.x*(width/2+inset-lane);
    if(City.classAt(x,z)===City.CLASS.FOOTPATH){site={x,z};break;}
   }
   if(site)heads.push({id:`signal-${road.id}`,...site,yaw:Math.atan2(-dir.x,-dir.z),junction:j.id,axis:road.axis,seed:0});
  }
  j.signalled=heads.length===j.incoming.length;
  if(j.signalled)signals.push(...heads);
 }
 return {junctions,roads,lamps,signals};
}
