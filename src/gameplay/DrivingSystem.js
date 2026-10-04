import * as THREE from 'three';
import {DRIVING as C,STREET,WORLD,BODY_CONTACT,WATER} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {groundVehicle,solveTwoBone} from '../core/Grounding.js';
import {driveStep,boxesOverlap} from '../core/DrivingMath.js';
import {VehicleEffects} from './VehicleEffects.js';
import {CarDoor,VehicleCabins} from './VehicleCabin.js';

export class DrivingSystem {
  constructor(scene,jimothy,input,voxels){
    Object.assign(this,{scene,jimothy,input,voxels});this.cars=new Map();this.drivers=new Map();this.phase='onFoot';this.speed=0;this.steer=0;this.crashes=0;this.timer=0;this.refresh=0;this.cooldown=0;this.messageTime=0;
    this.effects=new VehicleEffects(scene);this.panel=document.createElement('div');this.panel.id='driving-hud';this.panel.hidden=true;document.body.appendChild(this.panel);
    this.cabins=new VehicleCabins(scene);
    eventBus.on(Events.VEHICLE_REGISTER,p=>this.cars.set(p.id,p));eventBus.emit(Events.VEHICLE_LIST,{receive:cars=>cars.forEach(p=>this.cars.set(p.id,p))});
    eventBus.on(Events.VEHICLE_REMOVE,({id,destroyed})=>{const p=this.cars.get(id);if(this.car===p)this.exit(true);this.releaseDriver(id,!destroyed);this.cars.delete(id);});
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{if(this.cars.has(id)){if(this.car?.id===id)this.exit(true);this.releaseDriver(id);}});
    eventBus.on(Events.HUMAN_UNREGISTER,({id})=>{for(const [key,p]of this.drivers)if(p.id===id)this.drivers.delete(key);});
    eventBus.on(Events.GAME_OVER,()=>{this.exit(true);this.effects.silence();});
    eventBus.on(Events.PLAYER_LAUNCHED,()=>{if(this.car)this.exit(true,true);});
  }
  message(text){this.reason=text;this.messageTime=C.MESSAGE_SECONDS;this.effects.cue('blocked');}
  fits(p){return this.jimothy.radius<=Math.min(C.FIT_MAX,p.half[0]*C.FIT_RATIO);}
  syncDrivers(){
    for(const [id,p]of this.drivers){const car=this.cars.get(id);if(!car||car.loose||car.attached)this.releaseDriver(id);}
    for(const car of this.cars.values()){
      if(this.drivers.size>=C.DRIVER_LIMIT)break;
      if(!car.driving||car.loose||car.attached||car.driverAssigned||car.playerControlled)continue;
      eventBus.emit(Events.DRIVER_REQUEST,{car,receive:p=>{
        car.driverAssigned=true;p.driverPose=[];p.visual.traverse(b=>{if(b.isBone)p.driverPose.push({bone:b,q:b.quaternion.clone()});});p.driverBase=p.visual.position.clone();
        this.drivers.set(car.id,p);this.poseDriver(p,car);
      }});
    }
  }
  restoreDriver(p){for(const b of p.driverPose||[])b.bone.quaternion.copy(b.q);p.visual.position.copy(p.driverBase);}
  poseDriver(p,car){
    this.restoreDriver(p);const h=p.height;
    // A seated hip keeps the original human proportions; limbs reach cabin
    // anchors instead of forcing the standing foot IK through the car floor.
    p.visual.position.y-=h*C.HUMAN_HIP;
    p.mesh.position.copy(this.seat(car,false));p.mesh.quaternion.copy(car.mesh.quaternion);p.mesh.visible=car.mesh.visible;
    p.x=p.mesh.position.x;p.z=p.mesh.position.z;p.y=p.mesh.position.y;p.mesh.updateMatrixWorld(true);
    for(const side of ['l','r']){
      const sign=side==='l'?1:-1;
      for(const [names,local,pole]of [[['upperarm','lowerarm','hand'],C.HUMAN_HAND,[sign,0,-1]],[['thigh','calf','foot'],C.HUMAN_FOOT,[0,1,1]]]){
        const bones=names.map(n=>p.visual.getObjectByName(`${n}_${side}`));if(bones.some(b=>!b))continue;
        const target=p.mesh.localToWorld(new THREE.Vector3(local[0]*sign,local[1],local[2]));
        solveTwoBone(...bones,target,new THREE.Vector3(...pole).applyQuaternion(p.mesh.quaternion),1);
      }
    }
    p.mesh.updateMatrixWorld(true);
  }
  releaseDriver(id,remove=false){
    const p=this.drivers.get(id),car=this.cars.get(id);if(!p)return;this.drivers.delete(id);p.vehicleSeat=null;this.restoreDriver(p);
    if(remove){eventBus.emit(Events.DRIVER_REMOVE,{id:p.id});return;}
    const at=(car===this.car&&this.driverExit)||this.exitPoint(car,C.DRIVER_RADIUS)||this.fallbackExit(car,C.DRIVER_RADIUS);
    p.mixer.stopAllAction();p.animation=null;this.restoreDriver(p);p.mesh.quaternion.identity();p.mesh.position.set(at.x,at.y-C.DRIVER_RADIUS,at.z);
    eventBus.emit(Events.ENTITY_RELEASE,{id:p.id,position:p.mesh.position.clone(),ground:p.mesh.position.y});
  }
  seat(p,player=true){p.mesh.updateWorldMatrix(true,false);return p.mesh.localToWorld(new THREE.Vector3(C.SEAT_X,(player?C.PLAYER_SEAT_Y:C.SEAT_Y)+Math.max(0,p.half[1]-C.CABIN_BASE_HEIGHT),player?C.PLAYER_SEAT_Z:C.SEAT_Z));}
  nearby(){
    const j=this.jimothy.body.position;let best=null,dist=Infinity;
    for(const p of this.cars.values()){
      if(p.attached||p.loose||p.playerControlled)continue;
      const delta=new THREE.Vector3().copy(j).sub(p.mesh.position).applyQuaternion(p.mesh.quaternion.clone().invert());
      const gap=Math.hypot(Math.max(0,Math.abs(delta.x)-p.half[0]),Math.max(0,Math.abs(delta.z)-p.half[2]));
      if(gap<C.ENTER_REACH&&Math.abs(delta.y)<p.half[1]+this.jimothy.radius&&gap<dist){best=p;dist=gap;}
    }return best;
  }
  ground(x,z,from){return this.voxels.groundHeightAt(x,z,from);}
  contacts(){let result=[];eventBus.emit(Events.VEHICLE_CONTACTS,{receive:items=>result=items});return result;}
  clearExit(p,x,z,radius){
    const base=p.mesh.position.y-p.half[1],ground=this.ground(x,z,base+C.EXIT_STEP),at=new THREE.Vector3(x,ground+radius,z);
    if(Math.abs(ground-base)>C.EXIT_STEP+radius)return null;
    for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius]){
      if(Math.abs(this.ground(x+dx,z+dz,ground+C.EXIT_STEP)-ground)>C.EXIT_STEP)return null;
      for(const y of [C.EXIT_FLOOR_CLEARANCE,radius,Math.max(C.EXIT_HEADROOM,radius*2)])if(this.voxels.solidAtWorld(x+dx,ground+y,z+dz))return null;
    }
    const own={x,z,yaw:0,half:[radius,radius,radius]};
    for(const q of this.contacts())if(q.id!==p.id&&Math.abs(q.mesh.position.y-at.y)<q.half[1]+radius&&boxesOverlap(own,{x:q.mesh.position.x,z:q.mesh.position.z,yaw:q.mesh.rotation.y,half:q.half},C.BODY_SKIN))return null;
    return at;
  }
  exitPoint(p,radius){
    if(!p)return null;const yaw=p.yaw??p.mesh.rotation.y,s=Math.sin(yaw),c=Math.cos(yaw);
    for(const side of C.EXIT_SIDES)for(const along of C.EXIT_ALONG){
      const x=p.mesh.position.x+c*side*(p.half[0]+radius+C.EXIT_MARGIN)+s*along*p.half[2],z=p.mesh.position.z-s*side*(p.half[0]+radius+C.EXIT_MARGIN)+c*along*p.half[2];
      const at=this.clearExit(p,x,z,radius);if(at)return at;
    }return null;
  }
  fallbackExit(p,radius){
    // Wrecks may fill both doors. Search outward, then fall beside the car;
    // a roof snap or return to the boarding point could cross whole blocks.
    for(const ring of C.EXIT_SEARCH_RINGS)for(let i=0;i<C.EXIT_SEARCH_DIRECTIONS;i++){const angle=i*Math.PI*2/C.EXIT_SEARCH_DIRECTIONS,at=this.clearExit(p,p.mesh.position.x+Math.sin(angle)*(p.half[2]+ring+radius),p.mesh.position.z+Math.cos(angle)*(p.half[2]+ring+radius),radius);if(at)return at;}
    const yaw=p.yaw??p.mesh.rotation.y;
    return new THREE.Vector3(p.mesh.position.x-Math.cos(yaw)*(p.half[0]+radius+C.EXIT_MARGIN),p.mesh.position.y+p.half[1]+radius,p.mesh.position.z+Math.sin(yaw)*(p.half[0]+radius+C.EXIT_MARGIN));
  }
  enter(p){
    if(!p||this.phase!=='onFoot')return false;
    if(!this.fits(p)){this.message('Too big for this car');return false;}
    if((p.route?.speed||0)>C.ENTER_SPEED){this.message('Slow the car before hijacking');return false;}
    if(this.jimothy.move||gameState.player.stunned||this.jimothy.swimming){this.message('Get onto clear ground first');return false;}
    const at=this.exitPoint(p,this.jimothy.radius);if(!at){this.message('Both doors are blocked');return false;}
    const from=this.jimothy.body.position,to=at.clone(),delta=to.clone().sub(from),length=delta.length();
    if(length>C.ENTER_REACH+this.jimothy.radius*2||this.voxels.raycast(from.x,from.y,from.z,delta.x,delta.y,delta.z,length)){this.message('Reach a clear driver door');return false;}
    this.car=p;this.safeBoard=at;this.boardOrigin=new THREE.Vector3().copy(from);this.phase='boarding';this.timer=0;this.speed=0;this.steer=0;this.cooldown=0;
    // The driver steps beside the doorway; using Jimothy's boarding point
    // for both actors made them occupy the same patch of road (M53 visual).
    const yaw=p.yaw??p.mesh.rotation.y;
    this.driverExit=this.clearExit(p,at.x+Math.sin(yaw)*C.DRIVER_EXIT_OFFSET,at.z+Math.cos(yaw)*C.DRIVER_EXIT_OFFSET,C.DRIVER_RADIUS)||this.exitPoint(p,C.DRIVER_RADIUS);
    p.driving=false;p.playerControlled=true;p.yaw??=p.mesh.rotation.y;p.mesh.traverse(m=>{if(m.isMesh)m.visible=true;});
    this.door=new CarDoor(p);this.wheels=p.mesh.children.filter(m=>m.isMesh&&/wheel-(front|back)-(left|right)$/.test(m.name));for(const w of this.wheels)w.userData.driveBase??=w.quaternion.clone();this.wheelSpin=0;
    eventBus.emit(Events.PROP_CONTROL,{id:p.id});eventBus.emit(Events.PLAYER_CONTROLLED);eventBus.emit(Events.PLAYER_RIDE,{active:true});
    this.effects.cue('door');if(this.drivers.has(p.id))eventBus.emit(Events.TOOL_CHAOS,{points:C.HIJACK_HEAT});this.publish();return true;
  }
  exit(force=false,keepLaunch=false){
    const p=this.car;if(!p)return false;
    if(!force&&Math.abs(this.speed)>C.EXIT_SPEED){this.message('Brake before getting out');return false;}
    let at=this.exitPoint(p,this.jimothy.radius);if(!at&&!force){this.message('Both doors are blocked');return false;}at ||=this.fallbackExit(p,this.jimothy.radius);
    this.releaseDriver(p.id);this.door?.dispose();this.door=null;for(const w of this.wheels||[])w.quaternion.copy(w.userData.driveBase);this.wheels=[];p.playerControlled=false;p.driving=false;p.route=null;
    this.car=null;this.driverExit=null;this.phase='onFoot';this.speed=0;this.steer=0;this.timer=0;this.publish();
    if(!keepLaunch)eventBus.emit(Events.PLAYER_CONTROLLED);eventBus.emit(Events.PLAYER_RIDE,{active:false,position:at,keepLaunch});this.effects.silence();if(!force)this.effects.cue('door');return true;
  }
  publish(){Object.assign(gameState.vehicle,{id:this.car?.id||null,phase:this.phase,speed:this.speed,steer:this.steer,seatBlend:this.phase==='driving'?1:this.phase==='boarding'?THREE.MathUtils.smoothstep(this.timer/C.BOARD_SECONDS,C.DRIVER_EXIT_SHARE,1):0});}
  update(dt){
    this.messageTime=Math.max(0,this.messageTime-dt);this.cooldown=Math.max(0,this.cooldown-dt);this.refresh-=dt;
    if(this.refresh<=0){this.refresh=C.DRIVER_REFRESH;this.syncDrivers();}
    if(!gameState.game.isPlaying){this.effects.silence();return;}
    const action=this.input.consumeVehicle(),suppressed=this.input.suppressed||this.input.focusLost||document.hidden;
    if(action&&!suppressed){if(this.car)this.exit();else if(gameState.arrival.phase==='done')this.enter(this.nearby());}
    const p=this.car;
    if(p){
      if(p.loose||p.attached||!this.fits(p)){this.exit(true);return;}
      let water=null;eventBus.emit(Events.WATER_SAMPLE,{x:p.mesh.position.x,z:p.mesh.position.z,receive:value=>water=value});
      if(water&&water.height>p.mesh.position.y-p.half[1]+C.WATER_CLEARANCE){
        // JIM-97: releasing control must carry the approach velocity into
        // buoyancy. A zeroed body stops dead and cannot produce an entry hit.
        const speed=this.speed,velocity=[Math.sin(p.yaw)*speed,Math.tan(p.grounding?.pitch||0)*speed,Math.cos(p.yaw)*speed];
        p.loose=true;eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});
        eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity,spin:0});this.exit(true);
        if(Math.abs(speed)>WATER.ENTRY_MIN_SPEED)this.effects.cue('splash');return;
      }
      if(this.phase==='boarding'){
        this.timer+=dt;
        if(this.timer>=C.BOARD_SECONDS*C.DRIVER_EXIT_SHARE)this.releaseDriver(p.id);
        if(this.timer>=C.BOARD_SECONDS){this.phase='driving';this.effects.cue('start');}
      }else{
        for(const w of this.wheels||[])w.quaternion.copy(w.userData.driveBase);
        Object.assign(this,driveStep(this.speed,this.steer,{throttle:suppressed?0:this.input.vehicleThrottle,steer:suppressed?0:this.input.vehicleSteer,handbrake:suppressed||this.input.vehicleBrake},dt));
        this.move(dt);
      }
      if(this.car){this.playerPose();if(this.input.vehicleHorn&&!this.hornHeld)this.effects.cue('horn');this.hornHeld=this.input.vehicleHorn;}
      this.door?.pose(this.phase==='boarding'?Math.sin(Math.PI*Math.min(1,this.timer/C.BOARD_SECONDS)):0);
    }
    this.publish();const skid=!!this.car&&Math.abs(this.speed)>C.IMPACT_SPEED&&this.input.vehicleBrake;
    this.effects.engineSound(this.phase==='driving'&&!suppressed,this.speed,skid);this.effects.update(dt,this.phase==='driving'?this.car:null,this.speed,skid);
    const near=this.car||this.nearby();this.panel.hidden=!near&&this.messageTime<=0;
    this.panel.textContent=this.messageTime>0?this.reason:this.phase==='boarding'?'HIJACKING…':this.car?`${Math.round(Math.abs(this.speed)*C.KMH)} km/h · W/S / RT/LT accelerate & brake · A/D / stick steer\nSpace / A handbrake · H / L3 horn · Y exit`:near?`${this.fits(near)?'Y '+(this.drivers.has(near.id)?'hijack':'enter'):'Too big for'} car`:'';
  }
  move(dt){
    const p=this.car,steps=Math.max(1,Math.ceil(Math.abs(this.speed)*dt/C.SWEEP_STEP)),contacts=this.contacts();
    for(let i=0;i<steps&&this.car;i++){
      const old=p.mesh.position.clone(),oldRotation=p.mesh.quaternion.clone(),oldWheels=(this.wheels||[]).map(w=>w.position.y),oldYaw=p.yaw,distance=this.speed*dt/steps;
      const yaw=oldYaw+distance*Math.tan(this.steer)/(p.half[2]*C.WHEELBASE_RATIO),x=old.x+Math.sin(yaw)*distance,z=old.z+Math.cos(yaw)*distance;
      // JIM-96: suspension lifts the chassis on steep grades. Compare road
      // heights, otherwise that lift is mistaken for a cliff under the car.
      const base=this.ground(old.x,old.z,old.y-p.half[1]+C.MAX_STEP),ground=this.ground(x,z,base+C.MAX_STEP),c=Math.cos(yaw),s=Math.sin(yaw);
      let hit=null,blocked=Math.abs(x)>WORLD.BOUNDS-p.half[2]||Math.abs(z)>WORLD.BOUNDS-p.half[2]||ground<base-C.MAX_DROP||ground>base+C.MAX_STEP;
      // Resolve suspension at the proposed position before checking the hull.
      // Reusing the previous pitch made a shallow ditch lip act like a wall;
      // more engine pull alone could never overcome that false contact (M53).
      p.mesh.position.set(x,ground+p.half[1],z);p.mesh.rotation.set(0,yaw,0);
      const grounding=groundVehicle(p.mesh,p.half,(px,pz)=>this.ground(px,pz,base+C.MAX_STEP+C.MAX_GRADE*Math.hypot(px-x,pz-z)));
      // Smooth paving can lie below its storage voxel. Only the actual
      // surface blocks the hull; walls still return their solid column top.
      for(let dx=-p.half[0];dx<=p.half[0]+C.BODY_SKIN&&!blocked;dx+=C.PROBE_SPACING)for(let dz=-p.half[2];dz<=p.half[2]+C.BODY_SKIN&&!blocked;dz+=C.PROBE_SPACING){
        for(const y of C.BODY_PROBE_HEIGHTS){const point=new THREE.Vector3(dx,-p.half[1]+y,dz).applyQuaternion(p.mesh.quaternion).add(p.mesh.position);if(this.voxels.solidAtWorld(point.x,point.y,point.z)&&this.ground(point.x,point.z,point.y)>point.y){blocked=true;this.lastContact={kind:'terrain',point:point.toArray(),base,ground};break;}}
      }
      const hull={x,z,yaw,half:p.half};
      for(const q of contacts){
        if(q.id===p.id||Math.abs(q.mesh.position.y-old.y)>q.half[1]+p.half[1])continue;
        if(boxesOverlap(hull,{x:q.mesh.position.x,z:q.mesh.position.z,yaw:q.mesh.rotation.y,half:q.half},-C.BODY_SKIN)){
          if(q.mass>C.SHOVE_MASS){blocked=true;hit=q;this.lastContact={kind:'prop',id:q.id};break;}
          if(Math.abs(this.speed)>C.IMPACT_SPEED)eventBus.emit(Events.TOOL_FORCE,{mesh:q.mesh,velocity:[s*this.speed*C.SHOVE_GAIN,C.IMPACT_LIFT,c*this.speed*C.SHOVE_GAIN]});
        }
      }
      if(blocked){p.mesh.position.copy(old);p.mesh.quaternion.copy(oldRotation);for(const [i,w]of(this.wheels||[]).entries())w.position.y=oldWheels[i];p.mesh.updateMatrixWorld(true);this.crash(hit);break;}
      p.yaw=yaw;p.grounding=grounding;
      eventBus.emit(Events.PROP_POSE,{id:p.id,position:p.mesh.position,quaternion:p.mesh.quaternion});
    }
    if(this.car&&Math.abs(this.speed)>C.IMPACT_SPEED){
      const obstacles=[];eventBus.emit(Events.TRAFFIC_OBSTACLES,{obstacles});
      for(const a of obstacles)if(a.id?.startsWith('ped-')||a.id?.startsWith('pursuer')){
        if(Math.abs(a.y-p.mesh.position.y)>p.half[1]+BODY_CONTACT.HUMAN_HEIGHT)continue;
        if(boxesOverlap({x:p.mesh.position.x,z:p.mesh.position.z,yaw:p.yaw,half:p.half},{x:a.x,z:a.z,yaw:0,half:[C.DRIVER_RADIUS,1,C.DRIVER_RADIUS]}))eventBus.emit(Events.HUMAN_IMPACT,{id:a.id,x:a.x-Math.sin(p.yaw)*Math.sign(this.speed),y:a.y,z:a.z-Math.cos(p.yaw)*Math.sign(this.speed),radius:C.DRIVER_RADIUS,source:'car'});
      }
    }
  }
  crash(hit){
    const p=this.car,speed=Math.abs(this.speed);this.speed=0;if(speed<C.IMPACT_SPEED||this.cooldown>0)return;
    this.cooldown=C.CRASH_COOLDOWN;this.crashes++;this.effects.cue('crash');this.effects.emit(p.mesh.position,C.SPARK_COLOR,Math.ceil(speed));eventBus.emit(Events.TOOL_CHAOS,{points:C.CRASH_HEAT});
    if(speed>=C.BREAK_SPEED){const id=p.id,yaw=p.yaw;this.exit(true);eventBus.emit(Events.VEHICLE_BREAK,{id,radius:STREET.CAR.EXPLODE_RADIUS});if(hit?.kind==='car')eventBus.emit(Events.VEHICLE_BREAK,{id:hit.id,radius:STREET.CAR.BREAK_RADIUS});eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[Math.sin(yaw)*speed*C.SHOVE_GAIN,C.EJECT_UP,Math.cos(yaw)*speed*C.SHOVE_GAIN],seconds:C.EJECT_SECONDS,mass:BODY_CONTACT.HUMAN_MASS});}
    else if(speed>=C.GLASS_SPEED){eventBus.emit(Events.VEHICLE_GLASS,{id:p.id});if(hit?.kind==='car')eventBus.emit(Events.VEHICLE_GLASS,{id:hit.id});}
  }
  playerPose(){
    if(!this.car)return;let position=this.seat(this.car);
    if(this.phase==='boarding')position=this.boardOrigin.clone().lerp(position,THREE.MathUtils.smoothstep(this.timer/C.BOARD_SECONDS,C.DRIVER_EXIT_SHARE,1));
    eventBus.emit(Events.PLAYER_RIDE_POSE,{position,yaw:this.car.yaw,quaternion:this.car.mesh.quaternion});
  }
  afterUpdate(dt){
    for(const [id,p]of this.drivers){const car=this.cars.get(id);if(car){
      this.poseDriver(p,car);
      if(car===this.car&&this.phase==='boarding'){
        const t=THREE.MathUtils.smoothstep(this.timer/(C.BOARD_SECONDS*C.DRIVER_EXIT_SHARE),0,1);
        // Restore standing height while leaving the seat, not a frame after
        // reaching the road; otherwise the displaced driver crouches then pops.
        p.visual.position.lerp(p.driverBase,t);for(const b of p.driverPose)b.bone.quaternion.slerp(b.q,t);
        const exit=this.driverExit||this.safeBoard;
        p.mesh.position.lerp(exit.clone().add(new THREE.Vector3(0,-C.DRIVER_RADIUS,0)),t);
        p.mesh.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,car.yaw),t);
      }
    }}
    this.playerPose();
    if(this.car){this.wheelSpin+=this.speed*dt/C.WHEEL_RADIUS;this.car.steering=this.steer;for(const w of this.wheels||[]){w.quaternion.copy(w.userData.driveBase);if(w.name.includes('front'))w.rotateY(this.steer*C.WHEEL_STEER_RATIO);w.rotateX(this.wheelSpin);}}
    this.cabins.update([...new Set([...this.drivers.keys(),...(this.car?[this.car.id]:[])])].map(id=>this.cars.get(id)).filter(Boolean),this.car);
  }
  reset(){this.exit(true);for(const id of [...this.drivers.keys()])this.releaseDriver(id,true);this.effects.reset();this.cabins.reset();this.phase='onFoot';this.speed=0;this.steer=0;this.crashes=0;this.refresh=0;this.messageTime=0;this.panel.hidden=true;this.publish();}
  snapshot(){return {phase:this.phase,car:this.car?.id||null,speed:+this.speed.toFixed(3),steer:+this.steer.toFixed(3),drivers:[...this.drivers].map(([car,p])=>({car,id:p.id,model:p.model})),boarding:this.timer,crashes:this.crashes,reason:this.messageTime>0?this.reason:null,effects:this.effects.particles.length,effectLimit:C.EFFECT_LIMIT,audio:this.effects.audioSnapshot()};}
}
