import * as THREE from 'three';
import {GRAPHICS as C,STREAM,VOXEL,WORK_BUDGET} from '../core/Constants.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';

export class RenderQuality {
 constructor(scene,renderer,camera){
  this.scene=scene;this.renderer=renderer;this.camera=camera;this.frustum=new THREE.Frustum();this.projection=new THREE.Matrix4();this.sphere=new THREE.Sphere();
  this.set(localStorage.getItem(C.STORAGE)||C.DEFAULT,false);
  eventBus.on(Events.GRAPHICS_CHANGED,({preset})=>this.set(preset));
 }
 set(name,save=true){
  this.name=C.PRESETS[name]?name:C.DEFAULT;this.preset=C.PRESETS[this.name];const p=this.preset;
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,p.PIXEL_RATIO));
  this.camera.far=p.DISTANCE;this.camera.updateProjectionMatrix();
  STREAM.LOAD_RADIUS=p.COLUMNS;STREAM.UNLOAD_RADIUS=p.COLUMNS+C.UNLOAD_MARGIN;STREAM.FLY_LOAD_RADIUS=p.FLY_COLUMNS;
  WORK_BUDGET.MESH_MS=p.MESH_MS;WORK_BUDGET.GENERATION_MS=p.GEN_MS;WORK_BUDGET.DAMAGE_MS=p.DAMAGE_MS;
  gameState.world.graphics={preset:this.name,distance:p.DISTANCE,detail:p.DETAIL,aiDistance:p.AI_DISTANCE,aiInterval:p.AI_INTERVAL};
  this.shadows();this.renderer.shadowMap.needsUpdate=true;if(save)localStorage.setItem(C.STORAGE,this.name);
 }
 shadows(){const p=this.preset;
  for(const light of this.scene.children)if(light.isDirectionalLight){
   if(light.shadow.mapSize.x!==p.SHADOW_SIZE){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.setScalar(p.SHADOW_SIZE);}
  }
 }
 update(reference,radius,underground){
  const p=this.preset;this.shadows();
  // Keep physical city data ahead of a giant even on the smallest visual preset.
  STREAM.LOAD_RADIUS=Math.max(p.COLUMNS,Math.ceil(radius/(VOXEL.SIZE*VOXEL.CHUNK_XZ))+C.CONTACT_COLUMNS);
  STREAM.UNLOAD_RADIUS=STREAM.LOAD_RADIUS+C.UNLOAD_MARGIN;
  if(!underground){this.scene.fog.near=p.DISTANCE*C.FOG_START;this.scene.fog.far=p.DISTANCE*C.FOG_END;}
  this.camera.updateMatrixWorld();this.projection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);
  this.scene.updateMatrixWorld();this.culled=0;
  this.scene.traverse(o=>{
   if(!o.isMesh&&!o.isPoints)return;
   if(o.isBatchedMesh||o.userData.farDetail||o.isSkinnedMesh)return;
   const geometry=o.geometry;
   if(o.isInstancedMesh){o.computeBoundingSphere();o.frustumCulled=true;this.sphere.copy(o.boundingSphere);}
   else{if(!geometry.boundingSphere||o.isPoints)geometry.computeBoundingSphere();if(o.isPoints)o.frustumCulled=true;this.sphere.copy(geometry.boundingSphere);}
   this.sphere.applyMatrix4(o.matrixWorld);
   const visible=this.sphere.center.distanceTo(reference)<=p.DETAIL+this.sphere.radius+radius;
   if(visible)o.layers.enable(0);else{o.layers.disable(0);this.culled++;}
  });
  gameState.world.graphics={preset:this.name,distance:p.DISTANCE,detail:p.DETAIL,aiDistance:p.AI_DISTANCE,aiInterval:p.AI_INTERVAL,culled:this.culled};
 }
 inView(position,radius){this.sphere.center.copy(position);this.sphere.radius=radius;return this.frustum.intersectsSphere(this.sphere);}
 snapshot(){return{...gameState.world.graphics,pixelRatio:this.renderer.getPixelRatio(),columns:STREAM.LOAD_RADIUS};}
}
