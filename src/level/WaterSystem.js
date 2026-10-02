import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {WATER as C,WORLD,TERRAIN} from '../core/Constants.js';
import {RippleField,waveHeight,waveShader} from '../core/WaterField.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Terrain from './Terrain.js';

export class WaterSystem {
 constructor(scene,jimothy,voxels,sky){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.time=0;this.wakeClock=0;this.lastReflection=-Infinity;this.floating=new Set();this.bodyWakes=new Map();this.drops=[];this.serial=0;
  this.field=new RippleField((x,z)=>Terrain.surfaceHeight(x,z));this.field.centerAt(jimothy.body.position.x,jimothy.body.position.z);
  this.rippleTexture=new THREE.DataTexture(this.field.current.slice(),C.RIPPLE_SIZE,C.RIPPLE_SIZE,THREE.RedFormat,THREE.FloatType);this.rippleTexture.needsUpdate=true;
  const N=C.DEPTH_SIZE,depths=new Float32Array(N*N);
  for(let z=0;z<N;z++)for(let x=0;x<N;x++)depths[z*N+x]=Terrain.surfaceHeight((x/(N-1)*2-1)*WORLD.BOUNDS,(z/(N-1)*2-1)*WORLD.BOUNDS);
  this.depthTexture=new THREE.DataTexture(depths,N,N,THREE.RedFormat,THREE.FloatType);this.depthTexture.needsUpdate=true;
  const normalData=new Uint8Array(C.NORMAL_SIZE*C.NORMAL_SIZE*4);
  for(let y=0;y<C.NORMAL_SIZE;y++)for(let x=0;x<C.NORMAL_SIZE;x++){
   const u=x/C.NORMAL_SIZE*Math.PI*2,v=y/C.NORMAL_SIZE*Math.PI*2;
   const nx=Math.cos(u*3+Math.sin(v*2))*.45+Math.cos(u*7+v*5)*.2,nz=Math.sin(v*4+Math.cos(u*2))*.4+Math.sin(u*5-v*7)*.2;
   const n=new THREE.Vector3(nx,1,nz).normalize();normalData.set([(n.x*.5+.5)*255,(n.z*.5+.5)*255,(n.y*.5+.5)*255,255],(y*C.NORMAL_SIZE+x)*4);
  }
  this.normalTexture=new THREE.DataTexture(normalData,C.NORMAL_SIZE,C.NORMAL_SIZE);this.normalTexture.wrapS=this.normalTexture.wrapT=THREE.RepeatWrapping;this.normalTexture.magFilter=this.normalTexture.minFilter=THREE.LinearFilter;this.normalTexture.needsUpdate=true;
  this.surface=new Water(new THREE.PlaneGeometry(C.NEAR_SIZE,C.NEAR_SIZE,C.NEAR_SEGMENTS,C.NEAR_SEGMENTS),{textureWidth:C.REFLECTION_SIZE,textureHeight:C.REFLECTION_SIZE,waterNormals:this.normalTexture});
  this.surface.rotation.x=-Math.PI/2;this.surface.frustumCulled=false;
  const m=this.surface.material,u=m.uniforms;m.transparent=true;m.depthWrite=false;
  Object.assign(u,{waterTime:{value:0},rippleMap:{value:this.rippleTexture},rippleGrid:{value:new THREE.Vector2()},depthMap:{value:this.depthTexture},detailMap:{value:this.normalTexture},nearCenter:{value:new THREE.Vector2()},farSurface:{value:0},reflectionReady:{value:0},daylight:{value:1},deepColor:{value:new THREE.Color(C.DEEP)},shallowColor:{value:new THREE.Color(C.SHALLOW)},foamColor:{value:new THREE.Color(C.FOAM)},skyTop:sky.material.uniforms.topColor,skyHorizon:sky.material.uniforms.horizonColor,lightDirection:sky.material.uniforms.sunDir});
  const fields=`uniform float waterTime,farSurface;uniform sampler2D rippleMap,depthMap;uniform vec2 rippleGrid,nearCenter;
   ${waveShader()}
   float ripple(vec2 p){vec2 g=p/${C.RIPPLE_CELL.toFixed(8)}-rippleGrid;vec2 i=floor(g),f=fract(g);if(any(lessThan(i,vec2(0.)))||any(greaterThanEqual(i,vec2(${(C.RIPPLE_SIZE-1).toFixed(1)}))))return 0.;vec2 uv=(i+.5)/${C.RIPPLE_SIZE.toFixed(1)};vec2 d=vec2(1./${C.RIPPLE_SIZE.toFixed(1)},0.);return mix(mix(texture2D(rippleMap,uv).r,texture2D(rippleMap,uv+d.xy).r,f.x),mix(texture2D(rippleMap,uv+d.yx).r,texture2D(rippleMap,uv+d.xx).r,f.x),f.y);}
   float waterHeight(vec2 p){return waves(p,waterTime)+ripple(p);}
   float bottom(vec2 p){vec2 g=(p/${WORLD.BOUNDS.toFixed(1)}*.5+.5)*${(N-1).toFixed(1)},i=floor(g),f=fract(g),uv=(i+.5)/${N.toFixed(1)},d=vec2(1./${N.toFixed(1)},0.);return mix(mix(texture2D(depthMap,uv).r,texture2D(depthMap,uv+d.xy).r,f.x),mix(texture2D(depthMap,uv+d.yx).r,texture2D(depthMap,uv+d.xx).r,f.x),f.y);}`;
  m.vertexShader=`${fields} uniform mat4 textureMatrix;varying vec3 wp;varying vec4 reflectionCoord;
   void main(){vec4 p=modelMatrix*vec4(position,1.);p.y=waterHeight(p.xz);wp=p.xyz;reflectionCoord=textureMatrix*p;gl_Position=projectionMatrix*viewMatrix*p;}`;
  m.fragmentShader=`${fields} uniform sampler2D mirrorSampler,detailMap;uniform float reflectionReady,daylight;uniform vec3 deepColor,shallowColor,foamColor,skyTop,skyHorizon,lightDirection;varying vec3 wp;varying vec4 reflectionCoord;
   void main(){if(farSurface>.5&&max(abs(wp.x-nearCenter.x),abs(wp.z-nearCenter.y))<${(C.NEAR_SIZE/2-.01).toFixed(4)})discard;
    float depth=wp.y-bottom(wp.xz);if(depth<0.)discard;
    float dx=(waterHeight(wp.xz+vec2(.12,0.))-waterHeight(wp.xz-vec2(.12,0.)))/.24;
    float dz=(waterHeight(wp.xz+vec2(0.,.12))-waterHeight(wp.xz-vec2(0.,.12)))/.24;
    vec2 detail=(texture2D(detailMap,wp.xz*${C.NORMAL_REPEAT.toFixed(4)}+vec2(waterTime*.015,0.)).xy+texture2D(detailMap,wp.xz*${(C.NORMAL_REPEAT*1.7).toFixed(4)}-vec2(0.,waterTime*.011)).xy-1.)*${C.NORMAL_STRENGTH.toFixed(4)};
    vec3 n=normalize(vec3(-dx+detail.x,1.,-dz+detail.y)),view=normalize(cameraPosition-wp),reflection=reflect(-view,n);
    float fres=.02+.98*pow(1.-max(0.,dot(view,n)),5.);
    vec3 reflected=mix(skyHorizon,skyTop,max(0.,reflection.y));vec2 uv=reflectionCoord.xy/reflectionCoord.w+n.xz*.025;
    if(reflectionReady>.5&&all(greaterThan(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.))))reflected=mix(reflected,texture2D(mirrorSampler,uv).rgb,.8);
    vec3 c=mix(shallowColor,deepColor,1.-exp(-depth*${C.ABSORPTION.toFixed(4)}))*(.18+.82*daylight);
    c=mix(c,reflected,fres*.85);vec3 light=daylight>.15?lightDirection:-lightDirection;
    c+=vec3(1.,.88,.7)*pow(max(0.,dot(reflect(-light,n),view)),140.)*(.2+daylight);
    float edge=1.-smoothstep(0.,${C.FOAM_DEPTH.toFixed(3)},depth);float foam=edge*smoothstep(-.3,.8,sin(depth*14.-waterTime*3.+detail.x*16.));foam=max(foam,smoothstep(.15,.4,abs(ripple(wp.xz)))*.65);
    c=mix(c,foamColor*(.25+.75*daylight),foam*${C.FOAM_OPACITY.toFixed(3)});gl_FragColor=vec4(c,mix(${C.SHALLOW_ALPHA.toFixed(3)},${C.DEEP_ALPHA.toFixed(3)},1.-exp(-depth*${C.ABSORPTION.toFixed(3)})));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`;
  m.lights=false;this.uniforms=u;
  this.far=new THREE.Mesh(new THREE.PlaneGeometry(WORLD.BOUNDS*4,WORLD.BOUNDS*4,C.FAR_SEGMENTS,C.FAR_SEGMENTS),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...u,farSurface:{value:1}},vertexShader:m.vertexShader,fragmentShader:m.fragmentShader}));this.far.rotation.x=-Math.PI/2;scene.add(this.far,this.surface);
  const reflect=this.surface.onBeforeRender;
  this.surface.onBeforeRender=(renderer,s,camera)=>{
   if(camera.position.y-TERRAIN.SEA_LEVEL>C.REFLECTION_MAX_HEIGHT){u.reflectionReady.value=0;return;}
   if(this.time-this.lastReflection<C.REFLECTION_INTERVAL)return;
   this.far.visible=false;reflect(renderer,s,camera);this.far.visible=true;this.lastReflection=this.time;u.reflectionReady.value=1;
  };
  this.splashMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(C.SPLASH_SIZE,4,3),new THREE.MeshBasicMaterial({color:C.FOAM}),C.SPLASH_COUNT);this.splashMesh.frustumCulled=false;this.splashMesh.count=0;scene.add(this.splashMesh);this.matrix=new THREE.Object3D();
  eventBus.on(Events.WATER_DISTURB,q=>{
   this.floating.add(q.id);
   if(q.speed<C.PROP_WAKE_SPEED||this.time-(this.bodyWakes.get(q.id)??-Infinity)<C.PROP_WAKE_INTERVAL)return;
   this.bodyWakes.set(q.id,this.time);this.field.disturb(q.x,q.z,Math.min(C.PROP_WAKE_MAX,q.speed*C.PROP_WAKE_GAIN));
   if(q.verticalSpeed>C.SPLASH_THRESHOLD)this.splash(q.x,q.z);
  });
  eventBus.on(Events.WATER_SAMPLE,q=>q.receive(this.sample(q.x,q.z,q.id)));
  eventBus.on(Events.WORLD_IMPACT,h=>{if(this.sample(h.x,h.z)&&Math.abs(h.y-this.heightAt(h.x,h.z))<h.radius){this.field.disturb(h.x,h.z,C.IMPACT_STRENGTH);this.splash(h.x,h.z);}});
  this.update(0);
 }
 heightAt(x,z){return waveHeight(x,z,this.time)+this.field.sample(x,z);}
 // Read the uploaded texture and wave uniforms, independently of the active
 // solver arrays, to catch stale render data during verification.
 renderHeightAt(x,z){
  const u=this.uniforms,g=u.rippleGrid.value,N=C.RIPPLE_SIZE,fx=x/C.RIPPLE_CELL-g.x,fz=z/C.RIPPLE_CELL-g.y,i=Math.floor(fx),j=Math.floor(fz),a=u.rippleMap.value.image.data,tx=fx-i,tz=fz-j,k=j*N+i;
  const h=i<0||j<0||i>=N-1||j>=N-1?0:(a[k]*(1-tx)+a[k+1]*tx)*(1-tz)+(a[k+N]*(1-tx)+a[k+N+1]*tx)*tz;
  return waveHeight(x,z,u.waterTime.value)+h;
 }
 sample(x,z,id){
  const height=this.heightAt(x,z),ground=Terrain.surfaceHeight(x,z);if(ground>=height-C.MIN_DEPTH)return null;
  return {height,depth:height-ground};
 }
 splash(x,z){
  for(let i=0;i<C.SPLASH_PARTICLES;i++){
   const a=(this.serial++ + i)*Math.PI*(3-Math.sqrt(5));if(this.drops.length>=C.SPLASH_COUNT)this.drops.shift();
   this.drops.push({x,y:this.heightAt(x,z),z,vx:Math.cos(a)*C.SPLASH_SPEED,vz:Math.sin(a)*C.SPLASH_SPEED,vy:C.SPLASH_LIFT,life:C.SPLASH_LIFE});
  }
 }
 update(dt){
  if(gameState.game.isPlaying)this.time+=dt;this.floating.clear();const p=this.jimothy.body.position;
  this.field.centerAt(p.x,p.z);this.field.update(dt);
  for(const [id,time] of this.bodyWakes)if(this.time-time>C.PROP_WAKE_RETENTION)this.bodyWakes.delete(id);
  this.surface.position.set(Math.round(p.x),TERRAIN.SEA_LEVEL,Math.round(p.z));this.uniforms.nearCenter.value.set(this.surface.position.x,this.surface.position.z);
  this.syncSurface();
 }
 syncSurface(){
  this.rippleTexture.image.data.set(this.field.current);this.rippleTexture.needsUpdate=true;
  this.uniforms.rippleGrid.value.set(this.field.x,this.field.z);this.uniforms.waterTime.value=this.time;this.uniforms.daylight.value=gameState.world.daylight??1;
 }
 afterUpdate(dt){
  const p=this.jimothy.body.position,swim=!!gameState.player.swimming;this.wakeClock+=dt;
  if(swim&&!this.wasSwimming)this.splash(p.x,p.z);
  if((swim||(this.sample(p.x,p.z)&&p.y-this.jimothy.radius<this.heightAt(p.x,p.z)&&this.jimothy.speed>C.WADE_SPEED))&&this.wakeClock>C.WAKE_INTERVAL){this.field.disturb(p.x,p.z,-C.WAKE_STRENGTH);this.wakeClock=0;}
  this.wasSwimming=swim;
  this.drops=this.drops.filter(p=>{p.life-=dt;if(p.life<=0)return false;p.vy-=C.GRAVITY*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;return p.y>this.heightAt(p.x,p.z);});
  this.splashMesh.count=this.drops.length;this.drops.forEach((p,i)=>{this.matrix.position.set(p.x,p.y,p.z);this.matrix.scale.setScalar(p.life/C.SPLASH_LIFE);this.matrix.updateMatrix();this.splashMesh.setMatrixAt(i,this.matrix.matrix);});this.splashMesh.instanceMatrix.needsUpdate=true;this.syncSurface();
 }
 reset(){this.field.reset();this.floating.clear();this.bodyWakes.clear();this.drops=[];this.splashMesh.count=0;this.time=0;this.wakeClock=0;this.wasSwimming=false;this.lastReflection=-Infinity;gameState.player.swimming=false;this.syncSurface();}
 snapshot(){return {swimming:!!gameState.player.swimming,time:this.time,ripples:this.field.energy(),splashes:this.drops.length,floating:this.floating.size,waveHeight:this.heightAt(this.jimothy.body.position.x,this.jimothy.body.position.z)};}
}
