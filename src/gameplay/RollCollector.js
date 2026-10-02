import * as THREE from 'three';
import * as Layout from '../level/Layout.js';
import {COLLECTION as C,BODY_CONTACT} from '../core/Constants.js';
import {canPush} from '../core/BodyContact.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';

// Ownership stays with each source system. The registry only borrows a visual
// while its owner's physics/AI is suspended, then hands back a world position.
export class RollCollector {
  constructor(scene,jimothy,voxels){
    this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.entities=new Map();this.attached=[];this.cooldown=0;
    this.point=new THREE.Vector3();this.center=new THREE.Vector3();this.box=new THREE.Box3();this.radii=new THREE.Vector3();this.normal=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);this.objectBox=new THREE.Box3();
    eventBus.on(Events.ENTITY_LIST,({receive})=>receive(this.entities.values()));
    eventBus.on(Events.ENTITY_REGISTER,e=>this.entities.set(e.id,e));
    eventBus.on(Events.ENTITY_UNREGISTER,({id})=>{this.entities.delete(id);const i=this.attached.findIndex(e=>e.id===id);if(i>=0)this.attached.splice(i,1);});
  }
  eligible(e){return this.jimothy.move?.kind==='roll'&&this.jimothy.radius>=C.MIN_RADIUS&&e.size<=this.jimothy.radius*2*C.SIZE_RATIO&&
    (e.kind!=='car'||canPush(gameState.player.fatness,e.mass||0,BODY_CONTACT.CAR_PUSH_RATIO));}
  update(dt){
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.jimothy.move?.kind!=='roll'){if(this.attached.length)this.release();return;}
    const j=this.jimothy,r=j.radius;j.group.updateMatrixWorld(true);
    const local=j.group.worldToLocal(this.center.copy(j.body.position).clone());this.radii.setScalar(r);
    if(j.rig?.loaded&&!j.rig.bellyLocalBox(j.group,this.box).isEmpty()){this.box.getCenter(local);this.box.getSize(this.radii).multiplyScalar(.5);this.center.copy(local);j.group.localToWorld(this.center);}
    if(!Number.isFinite(this.center.lengthSq()))return;
    let projections=C.CONTACTS_PER_FRAME;
    const place=e=>{
      this.normal.copy(e.direction).divide(this.radii).normalize();
      e.mesh.quaternion.setFromUnitVectors(this.up,this.normal);
      e.mesh.position.copy(e.direction).multiply(this.radii).multiplyScalar(e.surfaceRatio).add(local).addScaledVector(this.normal,e.baseOffset+C.SKIN_CLEARANCE);
    };
    for(const e of this.attached){
      if(e.surfaceWidth!==j.widthScale&&projections>0&&j.rig?.surfaceRatio){e.surfaceRatio=j.rig.surfaceRatio(e.direction,local,this.radii);e.surfaceWidth=j.widthScale;projections--;}
      place(e);
    }
    if(this.cooldown>0)return;
    for(const e of this.entities.values()){
      if(this.attached.length>=C.CAPACITY||projections<=0)break;
      if(e.attached||!this.eligible(e))continue;
      e.mesh.getWorldPosition(this.point);
      if(!Number.isFinite(this.point.lengthSq()))continue;
      // Ground-level objects touch the bottom hemisphere; a planar radius
      // would also pull people from roofs and rooms several storeys above.
      if(this.point.distanceTo(this.center)>r*C.CONTACT+e.size/2)continue;
      e.mesh.updateWorldMatrix(true,true);
      this.objectBox.setFromObject(e.mesh).applyMatrix4(new THREE.Matrix4().copy(e.mesh.matrixWorld).invert());
      e.baseOffset=Math.max(0,-this.objectBox.min.y);
      eventBus.emit(Events.ENTITY_ATTACH,{id:e.id});
      e.attached=true;e.direction=j.group.worldToLocal(this.point.clone()).sub(local).divide(this.radii).normalize();
      if(e.direction.lengthSq()===0)e.direction.set(0,-1,0);
      e.surfaceRatio=j.rig?.surfaceRatio?j.rig.surfaceRatio(e.direction,local,this.radii):1;e.surfaceWidth=j.widthScale;projections--;
      j.group.attach(e.mesh);place(e);this.attached.push(e);
    }
  }
  release(){
    const j=this.jimothy;let i=0;
    for(const e of this.attached){
      this.scene.attach(e.mesh);
      let x=j.body.position.x,z=j.body.position.z,y=this.voxels.terrainHeightAt(x,z);
      for(let attempt=0;attempt<C.CAPACITY;attempt++){
        const angle=(i+attempt)*Math.PI*(3-Math.sqrt(5)),r=j.radius+C.RELEASE_GAP+Math.sqrt(i+attempt)*C.RELEASE_SPACING;
        const candidateX=j.body.position.x+Math.cos(angle)*r,candidateZ=j.body.position.z+Math.sin(angle)*r;
        if(Layout.Masterplan.classAt(candidateX,candidateZ)===Layout.Masterplan.CLASS.WATER&&!j.diving)continue;
        if(Layout.Masterplan.buildingsIn(candidateX,candidateZ,candidateX,candidateZ).some(b=>candidateX>=b.x&&candidateX<=b.x+b.w&&candidateZ>=b.z&&candidateZ<=b.z+b.d))continue;
        const surface=this.voxels.terrainHeightAt(candidateX,candidateZ),candidateY=this.voxels.groundHeightAt(candidateX,candidateZ,surface+C.RELEASE_SCAN);
        if(!this.voxels.solidAtWorld(candidateX,candidateY+C.FALLBACK_Y,candidateZ)){x=candidateX;y=candidateY;z=candidateZ;break;}
      }
      const position=new THREE.Vector3(x,y+e.size/2,z);e.mesh.position.copy(position);e.mesh.quaternion.identity();e.attached=false;
      eventBus.emit(Events.ENTITY_RELEASE,{id:e.id,position,ground:y});i++;
    }
    this.attached=[];this.cooldown=C.RELEASE_IMMUNITY;
  }
  reset(){this.release();this.cooldown=0;}
  snapshot(){return {count:this.attached.length,capacity:C.CAPACITY,items:this.attached.map(e=>({id:e.id,kind:e.kind,size:e.size}))};}
}
