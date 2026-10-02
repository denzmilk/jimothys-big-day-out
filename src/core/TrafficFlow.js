import {TRAFFIC as C,STREET} from './Constants.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Pure traffic state/geometry: StreetLife owns meshes and publishes physics
// poses. Junction reservations survive phase changes until the rear clears.
export class TrafficFlow {
 constructor(routes,clear){this.routes=routes;this.clear=clear;this.time=0;this.reservations=new Map();this.broken=new Set();this.paths=new Map();}
 reset(){this.time=0;this.reservations.clear();this.broken.clear();}
 signal(junction,axis){
  if(this.broken.has(junction.id)||junction.signalled===false||junction.outgoing.length<C.SIGNAL_MIN_ROADS)return 'yield';
  const half=C.GREEN+C.AMBER+C.ALL_RED,t=((this.time+junction.offset)%(2*half)+2*half)%(2*half),active=t<half?0:1,phase=t%half;
  return axis!==active||phase>=C.GREEN+C.AMBER?'red':phase<C.GREEN?'green':'amber';
 }
 path(road,next){
  const key=`${road.id}/${next.id}`;if(this.paths.has(key))return this.paths.get(key);
  const a=road.end,b=next.start,reach=Math.max(distance(a,b),road.width)*C.CURVE_SHARE;
  const c={x:a.x+road.dir.x*reach,z:a.z+road.dir.z*reach},d={x:b.x-next.dir.x*reach,z:b.z-next.dir.z*reach};
  const points=[];let length=0,valid=true;
  for(let i=0;i<=C.CONNECTOR_STEPS;i++){
   const t=i/C.CONNECTOR_STEPS,u=1-t,p={x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,z:u*u*u*a.z+3*u*u*t*c.z+3*u*t*t*d.z+t*t*t*b.z};
   if(i)length+=distance(p,points.at(-1));points.push({...p,distance:length});if(!this.clear(p.x,p.z))valid=false;
  }
  const path={points,length,valid};this.paths.set(key,path);return path;
 }
 choose(p,road,turns){
  const all=road.to.outgoing.filter(r=>this.path(road,r).valid),onward=all.filter(r=>r.to!==road.from),choices=onward.length?onward:all;
  choices.sort((a,b)=>dot(b.dir,road.dir)-dot(a.dir,road.dir)||a.id.localeCompare(b.id));
  return choices[C.ROUTE_CHOICES[(p.seed+turns)%C.ROUTE_CHOICES.length]%choices.length]||null;
 }
 assign(p,road,d=0){
  this.release(p.id);p.route={road,distance:d,speed:0,next:this.choose(p,road,0),connector:null,committed:false,turns:0,wait:0,reason:null};p.driving=true;this.pose(p);
 }
 point(route,ahead=0){
  let d=route.distance+ahead;
  if(!route.connector&&d<=route.road.length)return {x:route.road.start.x+route.road.dir.x*d,z:route.road.start.z+route.road.dir.z*d,dir:route.road.dir};
  let path=route.connector;
  if(!path){if(!route.next)return {...route.road.end,dir:route.road.dir};path=this.path(route.road,route.next);d-=route.road.length;}
  if(d>=path.length){const n=route.next;return {x:n.start.x+n.dir.x*(d-path.length),z:n.start.z+n.dir.z*(d-path.length),dir:n.dir};}
  const i=Math.max(1,path.points.findIndex(p=>p.distance>=d)),a=path.points[i-1],b=path.points[i],span=b.distance-a.distance,t=span?(d-a.distance)/span:0;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,dir:{x:(b.x-a.x)/span,z:(b.z-a.z)/span}};
 }
 pose(p){const point=this.point(p.route);p.mesh.position.x=point.x;p.mesh.position.z=point.z;p.yaw=Math.atan2(point.dir.x,point.dir.z);p.mesh.rotation.set(0,p.yaw,0);}
 release(id){for(const [key,holder] of this.reservations)if(holder===id)this.reservations.delete(key);}
 exitClear(p,others){
  const n=p.route.next;if(!n)return false;
  return !others.some(q=>q.id!==p.id&&Math.abs((q.x-n.start.x)*n.dir.z-(q.z-n.start.z)*n.dir.x)<p.half[0]+q.width+C.LATERAL_GAP&&
   (q.x-n.start.x)*n.dir.x+(q.z-n.start.z)*n.dir.z>-q.length&&
   (q.x-n.start.x)*n.dir.x+(q.z-n.start.z)*n.dir.z<p.half[2]*2+q.length+C.GAP);
 }
 update(dt,cars,obstacles,surface){
  this.time+=dt;
  const active=new Set(cars.map(p=>p.id));for(const [j,id] of this.reservations)if(!active.has(id))this.reservations.delete(j);
  // Evaluate against one frame's positions, so array order cannot let a later
  // car skip a queue merely because the lead car has already moved this tick.
  const others=[...obstacles,...cars.map(p=>({id:p.id,x:p.mesh.position.x,z:p.mesh.position.z,y:p.mesh.position.y,width:p.half[0],length:p.half[2]}))];
  for(const p of cars){
   const r=p.route;if(!r)continue;
   if(r.clearJunction&&r.distance>p.half[2]+C.RESERVATION_CLEAR){this.release(p.id);r.clearJunction=null;}
   let limit=Infinity;r.reason=null;
   if(!r.connector&&!r.committed){
    const j=r.road.to,gate=r.road.length-p.half[2]-C.STOP_SETBACK,remaining=gate-r.distance;
    const phase=this.signal(j,r.road.axis),holder=this.reservations.get(j.id);
    if(remaining<C.GAP&&r.speed<C.STOP_SPEED)r.wait+=dt;
    const allowed=(phase==='green'||phase==='yield'&&r.wait>=C.YIELD_WAIT)&&(!holder||holder===p.id)&&this.exitClear(p,others);
    if(!allowed){limit=Math.max(0,remaining);r.reason=holder&&holder!==p.id?'junction':phase==='green'?'exit':phase;}
    if(allowed&&remaining<=Math.max(C.GAP,r.speed*dt)){
     this.reservations.set(j.id,p.id);r.committed=true;r.wait=0;
    }
   }
   const nearby=others.filter(q=>q.id!==p.id&&distance(q,p.mesh.position)<C.LOOK_AHEAD+p.half[2]+q.length);
   for(let d=C.PROBE_STEP;d<=C.LOOK_AHEAD;d+=C.PROBE_STEP){
    const point=this.point(r,d),surfaceY=surface(point.x,point.z);
    if(!Number.isFinite(surfaceY)){
     const gap=Math.max(0,d-p.half[2]-C.GAP);if(gap<limit){limit=gap;r.reason='road';}break;
    }
    if(nearby.some(q=>Math.abs(q.y-surfaceY)<C.OBSTACLE_HEIGHT&&Math.abs((q.x-point.x)*point.dir.z-(q.z-point.z)*point.dir.x)<p.half[0]+q.width+C.LATERAL_GAP&&Math.abs((q.x-point.x)*point.dir.x+(q.z-point.z)*point.dir.z)<q.length+C.PROBE_STEP/2)){
     const gap=Math.max(0,d-p.half[2]-C.GAP);if(gap<limit){limit=gap;r.reason='obstacle';}break;
    }
   }
   const desired=Math.min(r.connector?C.TURN_SPEED:STREET.SPEED,Math.sqrt(2*C.BRAKE*limit));
   r.speed=Math.max(0,r.speed+clamp(desired-r.speed,-C.BRAKE*dt,C.ACCELERATION*dt));
   const step=Math.min(r.speed*dt,limit);if(limit<C.STOP_SPEED)r.speed=0;
   r.distance+=step;
   if(!r.connector&&r.distance>=r.road.length){
    if(r.next&&r.committed){r.distance-=r.road.length;r.connector=this.path(r.road,r.next);}else{r.distance=r.road.length;r.speed=0;}
   }
   if(r.connector&&r.distance>=r.connector.length){
    const j=r.road.to.id;r.distance-=r.connector.length;r.road=r.next;r.connector=null;r.committed=false;r.clearJunction=j;r.next=this.choose(p,r.road,++r.turns);
   }
   this.pose(p);
  }
 }
}
