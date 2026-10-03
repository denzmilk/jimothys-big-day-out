import * as THREE from 'three';
import {GLASS_SHARDS as C,GLAZING} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';

export class GlassShards {
  constructor(scene){
    this.scene=scene;this.items=[];this.serial=0;this.bursts=0;
    const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(-.2,.5);shape.closePath();
    this.geometry=new THREE.ExtrudeGeometry(shape,{depth:1,steps:1,bevelEnabled:false});this.geometry.translate(0,0,-.5);
    this.material=new THREE.MeshPhysicalMaterial({color:C.COLOR,roughness:C.ROUGHNESS,transmission:C.TRANSMISSION,metalness:C.METALNESS,thickness:C.THICKNESS,ior:GLAZING.IOR});
    eventBus.on(Events.GLASS_SHATTER,e=>this.spawn(e));
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.items.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
    eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{
      const p=this.items.find(p=>p.id===id);if(!p)return;
      p.attached=false;p.life=C.LIFETIME;p.mesh.position.set(position.x,ground+p.half[1]+C.CLEARANCE,position.z);
      eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});
    });
  }
  spawn({points,origin}){
    if(!points.length)return;
    this.bursts++;
    const count=Math.min(C.PER_BURST,points.length);
    for(let i=0;i<count;i++){
      if(this.items.length>=C.MAX){const oldest=this.items.find(p=>!p.attached);if(!oldest)break;this.remove(oldest);}
      const n=this.serial++,phase=n*Math.PI*(3-Math.sqrt(5)),fraction=(n*.61803398875)%1;
      const length=C.LENGTH_MIN+(C.LENGTH_MAX-C.LENGTH_MIN)*fraction;
      const mesh=new THREE.Mesh(this.geometry,this.material),point=points[Math.floor(i*points.length/count)];
      mesh.scale.set(length,length*C.WIDTH_RATIO,C.THICKNESS);mesh.position.copy(point);
      mesh.rotation.set(phase,phase/2,-phase);this.scene.add(mesh);
      // Only pairs overlapping at birth get a short separation grace (M52).
      const p={id:`glass-${n}`,mesh,half:[length/2,length*C.WIDTH_RATIO/2,C.THICKNESS/2],mass:C.MASS,kind:'glass',spawnSafe:true,collisionFilterMask:C.COLLISION_MASK,loose:true,attached:false,life:C.LIFETIME};
      this.items.push(p);
      eventBus.emit(Events.PROP_CREATE,p);
      eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh,kind:'glass',size:length});
      const direction=new THREE.Vector3(point.x-origin.x,point.y-origin.y,point.z-origin.z).normalize();
      direction.add(new THREE.Vector3(Math.cos(phase),fraction,Math.sin(phase))).normalize().multiplyScalar(C.SPEED);direction.y+=C.LIFT;
      eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:direction.toArray(),spin:C.SPIN*(fraction-.5)});
    }
  }
  remove(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();this.items.splice(this.items.indexOf(p),1);}
  update(dt){for(const p of [...this.items])if(!p.attached&&(p.life-=dt)<=0)this.remove(p);}
  reset(){for(const p of [...this.items])this.remove(p);this.serial=0;this.bursts=0;}
  snapshot(){return {shards:this.items.length,bursts:this.bursts,attached:this.items.filter(p=>p.attached).length};}
}
