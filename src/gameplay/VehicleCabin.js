import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRIVING as C} from '../core/Constants.js';

// M53: keep the sourced body triangles/UVs. Only the driver's panel is split
// temporarily for boarding; normal traffic still uses the original batches.
export class CarDoor {
  constructor(car){
    this.car=car;this.original=[];this.parts=[];this.hinge=new THREE.Group();
    this.hinge.position.set(car.half[0]*C.DOOR_SIDE,0,car.half[2]*C.DOOR_Z[1]);
    for(const mesh of [...car.mesh.children]){
      if(!mesh.isMesh||mesh.name.includes('wheel'))continue;
      mesh.updateMatrix();const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);
      const pos=geo.attributes.position,sets=[[],[]];
      const planes=[v=>v.position[0]-car.half[0]*C.DOOR_SIDE,v=>v.position[2]-car.half[2]*C.DOOR_Z[0],v=>car.half[2]*C.DOOR_Z[1]-v.position[2],v=>v.position[1]-car.half[1]*(2*C.DOOR_Y[0]-1),v=>car.half[1]*(2*C.DOOR_Y[1]-1)-v.position[1]];
      const split=(poly,plane)=>{const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b);(da>=0?inside:outside).push(a);if((da>=0)!==(db>=0)){const t=da/(da-db),v={};for(const name of Object.keys(a))v[name]=a[name].map((x,k)=>x+(b[name][k]-x)*t);inside.push(v);outside.push(v);}}return [inside,outside];};
      const triangles=(polygon,into)=>{for(let i=1;i<polygon.length-1;i++)into.push(polygon[0],polygon[i],polygon[i+1]);};
      for(let i=0;i<pos.count;i+=3){let poly=Array.from({length:3},(_,j)=>Object.fromEntries(Object.entries(geo.attributes).map(([name,a])=>[name,Array.from({length:a.itemSize},(_,n)=>a.getComponent(i+j,n))])));
        for(const plane of planes){if(!poly.length)break;const [inside,outside]=split(poly,plane);triangles(outside,sets[0]);poly=inside;}triangles(poly,sets[1]);
      }
      if(!sets[1].length){geo.dispose();continue;}
      this.original.push(mesh);mesh.visible=false;
      for(let side=0;side<2;side++){
        if(!sets[side].length)continue;const geometry=new THREE.BufferGeometry();
        for(const [name,a]of Object.entries(geo.attributes))geometry.setAttribute(name,new THREE.Float32BufferAttribute(sets[side].flatMap(v=>v[name]),a.itemSize));
        if(side)geometry.translate(-this.hinge.position.x,-this.hinge.position.y,-this.hinge.position.z);
        const part=new THREE.Mesh(geometry,mesh.material);part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;part.userData.sourcePane=mesh.userData.glassPane;this.parts.push(part);(side?this.hinge:car.mesh).add(part);
      }geo.dispose();
    }car.mesh.add(this.hinge);
  }
  pose(amount){this.hinge.rotation.y=-amount*C.DOOR_ANGLE;for(const mesh of this.original)mesh.visible=false;for(const part of this.parts)if(part.userData.sourcePane!==undefined)part.visible=!this.car.brokenWindows.includes(part.userData.sourcePane);}
  dispose(){for(const p of this.parts){p.removeFromParent();p.geometry.dispose();}for(const mesh of this.original)mesh.visible=true;this.hinge.removeFromParent();}
}

export class VehicleCabins {
  constructor(scene){this.scene=scene;this.items=new Map();this.ready=false;this.loading=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/vehicles/cabin.glb`).then(g=>{this.template=g.scene;g.scene.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});this.ready=true;}).catch(e=>console.error('Vehicle cabin failed',e));}
  update(cars,active){
    const ids=new Set(cars.map(p=>p.id));for(const [id,p]of this.items)if(!ids.has(id)){p.removeFromParent();this.items.delete(id);}
    if(!this.ready)return;
    for(const car of cars){let root=this.items.get(car.id);if(!root){root=this.template.clone(true);this.items.set(car.id,root);this.scene.add(root);}
      root.position.copy(car.mesh.position).add(new THREE.Vector3(0,Math.max(0,car.half[1]-C.CABIN_BASE_HEIGHT),0).applyQuaternion(car.mesh.quaternion));root.quaternion.copy(car.mesh.quaternion);root.visible=car.mesh.visible;
      const wheel=root.getObjectByName('steering-wheel');if(wheel){wheel.userData.base??=wheel.quaternion.clone();wheel.quaternion.copy(wheel.userData.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...C.WHEEL_AXIS).normalize(),car===active?-(active.steering||0):0));}
    }
  }
  reset(){for(const root of this.items.values())root.removeFromParent();this.items.clear();}
}
