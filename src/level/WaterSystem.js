import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {WATER as C,WORLD,TERRAIN,OCEAN} from '../core/Constants.js';
import {RippleField,waveHeight,waveShader,waterReaction} from '../core/WaterField.js';
import {sandShader} from '../core/SandField.js';
import {groundChannelShader} from '../core/GroundChannelField.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Terrain from './Terrain.js';

export class WaterSystem {
 constructor(scene,jimothy,voxels,sky,sandUniforms,channelUniforms){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.time=0;this.wakeClock=0;this.lastReflection=-Infinity;this.floating=new Set();this.bodyWakes=new Map();this.drops=[];this.rings=[];this.serial=0;this.reactions=0;this.lastReaction=null;this.playerWet=false;this.playerAbove=false;
  this.field=new RippleField((x,z)=>Terrain.surfaceHeight(x,z)+(voxels.channels?.sample(x,z)||0));this.field.centerAt(jimothy.body.position.x,jimothy.body.position.z);
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
  this.surface.rotation.x=-Math.PI/2;this.surface.userData.farDetail=true;this.surface.frustumCulled=false;
  const m=this.surface.material,u=m.uniforms;m.transparent=true;m.depthWrite=false;m.side=THREE.DoubleSide;
  Object.assign(u,sandUniforms,channelUniforms,{waterTime:{value:0},rippleMap:{value:this.rippleTexture},rippleGrid:{value:new THREE.Vector2()},rippleCell:{value:C.RIPPLE_CELL},nearHalf:{value:C.NEAR_SIZE/2},depthMap:{value:this.depthTexture},detailMap:{value:this.normalTexture},nearCenter:{value:new THREE.Vector2()},farSurface:{value:0},reflectionReady:{value:0},daylight:{value:1},underSurface:{value:new THREE.Color(OCEAN.SURFACE_COLOR)},deepColor:{value:new THREE.Color(C.DEEP)},shallowColor:{value:new THREE.Color(C.SHALLOW)},foamColor:{value:new THREE.Color(C.FOAM)},skyTop:sky.material.uniforms.topColor,skyHorizon:sky.material.uniforms.horizonColor,lightDirection:sky.material.uniforms.sunDir});
  const fields=`${sandShader()} ${groundChannelShader()} uniform float waterTime,farSurface,rippleCell,nearHalf;uniform sampler2D rippleMap,depthMap;uniform vec2 rippleGrid,nearCenter;
   ${waveShader()}
   float ripple(vec2 p){vec2 g=p/rippleCell-rippleGrid;vec2 i=floor(g),f=fract(g);if(any(lessThan(i,vec2(0.)))||any(greaterThanEqual(i,vec2(${(C.RIPPLE_SIZE-1).toFixed(1)}))))return 0.;vec2 uv=(i+.5)/${C.RIPPLE_SIZE.toFixed(1)};vec2 d=vec2(1./${C.RIPPLE_SIZE.toFixed(1)},0.);return mix(mix(texture2D(rippleMap,uv).r,texture2D(rippleMap,uv+d.xy).r,f.x),mix(texture2D(rippleMap,uv+d.yx).r,texture2D(rippleMap,uv+d.xx).r,f.x),f.y);}
   float waterHeight(vec2 p){return waves(p,waterTime)+ripple(p);}
   float bottom(vec2 p){vec2 g=(p/${WORLD.BOUNDS.toFixed(1)}*.5+.5)*${(N-1).toFixed(1)},i=floor(g),f=fract(g),uv=(i+.5)/${N.toFixed(1)},d=vec2(1./${N.toFixed(1)},0.);return mix(mix(texture2D(depthMap,uv).r,texture2D(depthMap,uv+d.xy).r,f.x),mix(texture2D(depthMap,uv+d.yx).r,texture2D(depthMap,uv+d.xx).r,f.x),f.y)+channelOffset(p)+(abs(channelOffset(p))<.0001?sandOffset(p):0.);}`;
  m.vertexShader=`${fields} uniform mat4 textureMatrix;varying vec3 wp;varying vec4 reflectionCoord;
   void main(){vec4 p=modelMatrix*vec4(position,1.);p.y=waterHeight(p.xz);wp=p.xyz;reflectionCoord=textureMatrix*p;gl_Position=projectionMatrix*viewMatrix*p;}`;
  m.fragmentShader=`${fields} uniform sampler2D mirrorSampler,detailMap;uniform float reflectionReady,daylight;uniform vec3 underSurface,deepColor,shallowColor,foamColor,skyTop,skyHorizon,lightDirection;varying vec3 wp;varying vec4 reflectionCoord;
   void main(){if(farSurface>.5&&max(abs(wp.x-nearCenter.x),abs(wp.z-nearCenter.y))<nearHalf)discard;
    float depth=wp.y-bottom(wp.xz);if(depth<0.)discard;
    if(cameraPosition.y<wp.y){float shimmer=(sin(wp.x*.7+waterTime)+sin(wp.z*.9-waterTime))*.5;vec3 c=underSurface*(.2+.8*daylight)+vec3(shimmer*${OCEAN.SURFACE_SHIMMER.toFixed(4)}*daylight);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;}

    float dx=(waterHeight(wp.xz+vec2(.12,0.))-waterHeight(wp.xz-vec2(.12,0.)))/.24;
    float dz=(waterHeight(wp.xz+vec2(0.,.12))-waterHeight(wp.xz-vec2(0.,.12)))/.24;
    vec2 detail=(texture2D(detailMap,wp.xz*${C.NORMAL_REPEAT.toFixed(4)}+vec2(waterTime*.015,0.)).xy+texture2D(detailMap,wp.xz*${(C.NORMAL_REPEAT*1.7).toFixed(4)}-vec2(0.,waterTime*.011)).xy-1.)*${C.NORMAL_STRENGTH.toFixed(4)};
    vec3 n=normalize(vec3(-dx+detail.x,1.,-dz+detail.y)),view=normalize(cameraPosition-wp),reflection=reflect(-view,n);
    if(cameraPosition.y<wp.y)n=-n;
    float fres=.02+.98*pow(1.-max(0.,dot(view,n)),5.);
    vec3 reflected=mix(skyHorizon,skyTop,max(0.,reflection.y));vec2 uv=reflectionCoord.xy/reflectionCoord.w+n.xz*.025;
    if(reflectionReady>.5&&all(greaterThan(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.))))reflected=mix(reflected,texture2D(mirrorSampler,uv).rgb,.8);
    vec3 c=mix(shallowColor,deepColor,1.-exp(-depth*${C.ABSORPTION.toFixed(4)}))*(.18+.82*daylight);
    c=mix(c,reflected,fres*.85);vec3 light=daylight>.15?lightDirection:-lightDirection;
    c+=vec3(1.,.88,.7)*pow(max(0.,dot(reflect(-light,n),view)),140.)*(.2+daylight);
    float edge=1.-smoothstep(0.,${C.FOAM_DEPTH.toFixed(3)},depth);float foam=edge*smoothstep(-.3,.8,sin(depth*14.-waterTime*3.+detail.x*16.));foam=max(foam,smoothstep(.15,.4,max(0.,ripple(wp.xz)))*.65);
    c=mix(c,foamColor*(.25+.75*daylight),foam*${C.FOAM_OPACITY.toFixed(3)});gl_FragColor=vec4(c,mix(${C.SHALLOW_ALPHA.toFixed(3)},${C.DEEP_ALPHA.toFixed(3)},1.-exp(-depth*${C.ABSORPTION.toFixed(3)})));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`;
  m.lights=false;this.uniforms=u;
  this.far=new THREE.Mesh(new THREE.PlaneGeometry(WORLD.BOUNDS*4,WORLD.BOUNDS*4,C.FAR_SEGMENTS,C.FAR_SEGMENTS),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{...u,farSurface:{value:1}},vertexShader:m.vertexShader,fragmentShader:m.fragmentShader}));this.far.rotation.x=-Math.PI/2;scene.add(this.far,this.surface);
  const reflect=this.surface.onBeforeRender;
  this.surface.onBeforeRender=(renderer,s,camera)=>{
   if(camera.position.y<TERRAIN.SEA_LEVEL||camera.position.y-TERRAIN.SEA_LEVEL>C.REFLECTION_MAX_HEIGHT){u.reflectionReady.value=0;return;}
   if(this.time-this.lastReflection<C.REFLECTION_INTERVAL)return;
   this.far.visible=false;reflect(renderer,s,camera);this.far.visible=true;this.lastReflection=this.time;u.reflectionReady.value=1;
  };
  this.splashMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(C.SPLASH_SIZE,4,3),new THREE.MeshBasicMaterial({color:C.FOAM}),C.SPLASH_COUNT);this.splashMesh.frustumCulled=false;this.splashMesh.count=0;scene.add(this.splashMesh);this.matrix=new THREE.Object3D();
  const ringGeometry=new THREE.RingGeometry(C.FOAM_INNER,1,C.FOAM_SEGMENTS);ringGeometry.rotateX(-Math.PI/2);
  this.ringOpacity=new THREE.InstancedBufferAttribute(new Float32Array(C.FOAM_RINGS),1);ringGeometry.setAttribute('ringOpacity',this.ringOpacity);
  this.ringWidth=new THREE.InstancedBufferAttribute(new Float32Array(C.FOAM_RINGS),1);ringGeometry.setAttribute('ringWidth',this.ringWidth);
  const ringMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:u,
   vertexShader:`${fields} attribute float ringOpacity,ringWidth;varying float alpha,width;varying vec2 ringUV;varying vec3 wp;
    void main(){vec4 p=modelMatrix*instanceMatrix*vec4(position,1.);p.y=waterHeight(p.xz)+${C.FOAM_LIFT.toFixed(4)};wp=p.xyz;ringUV=position.xz;alpha=ringOpacity;width=ringWidth;gl_Position=projectionMatrix*viewMatrix*p;}`,
   fragmentShader:`${fields} uniform vec3 foamColor;uniform float daylight;varying float alpha,width;varying vec2 ringUV;varying vec3 wp;
    void main(){if(bottom(wp.xz)>=wp.y||cameraPosition.y<wp.y-${C.FOAM_LIFT.toFixed(4)})discard;
     float r=length(ringUV),edge=smoothstep(1.-width,1.-width*(1.-${C.FOAM_EDGE.toFixed(4)}),r)*(1.-smoothstep(1.-width*${C.FOAM_EDGE.toFixed(4)},1.,r));
     float angle=atan(ringUV.y,ringUV.x),grain=.5+.5*sin(angle*${C.FOAM_NOISE_ARCS.toFixed(1)}+waterTime*${C.FOAM_NOISE_SPEED.toFixed(4)})*sin(angle*${(C.FOAM_NOISE_ARCS/2).toFixed(4)}-waterTime);
     gl_FragColor=vec4(foamColor*(.25+.75*daylight),edge*alpha*(1.-${C.FOAM_BREAKUP.toFixed(4)}+grain*${C.FOAM_BREAKUP.toFixed(4)}));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  this.ringMesh=new THREE.InstancedMesh(ringGeometry,ringMaterial,C.FOAM_RINGS);this.ringMesh.count=0;this.ringMesh.frustumCulled=false;scene.add(this.ringMesh);
  eventBus.on(Events.WATER_DISTURB,q=>{
   this.floating.add(q.id);
   if(q.fraction>=1&&!q.entering)return;
   const interval=C.PROP_WAKE_INTERVAL*Math.max(1,Math.sqrt((q.radius??C.REACTION_BASE_RADIUS)/C.REACTION_BASE_RADIUS));
   if(!q.entering&&(q.speed<C.PROP_WAKE_SPEED||this.time-(this.bodyWakes.get(q.id)??-Infinity)<interval))return;
   if(this.react({...q,kind:'body'}))this.bodyWakes.set(q.id,this.time);
  });
  eventBus.on(Events.WATER_SAMPLE,q=>q.receive(this.sample(q.x,q.z,q.id)));
  eventBus.on(Events.WORLD_DEMOLISHED,q=>{if(q.groundOnly&&q.bounds.min[1]<=TERRAIN.SEA_LEVEL)this.field.refreshGround(q.bounds);});
  eventBus.on(Events.WORLD_IMPACT,h=>{if(this.sample(h.x,h.z)&&Math.abs(h.y-this.heightAt(h.x,h.z))<h.radius)
   this.react({...h,kind:'impact',entering:true,speed:0,verticalSpeed:-C.SPLASH_THRESHOLD});});
  this.update(0);
 }
 heightAt(x,z){return waveHeight(x,z,this.time)+this.field.sample(x,z);}
 // Read the uploaded texture and wave uniforms, independently of the active
 // solver arrays, to catch stale render data during verification.
 renderHeightAt(x,z){
  const u=this.uniforms,g=u.rippleGrid.value,N=C.RIPPLE_SIZE,fx=x/u.rippleCell.value-g.x,fz=z/u.rippleCell.value-g.y,i=Math.floor(fx),j=Math.floor(fz),a=u.rippleMap.value.image.data,tx=fx-i,tz=fz-j,k=j*N+i;
  const h=i<0||j<0||i>=N-1||j>=N-1?0:(a[k]*(1-tx)+a[k+1]*tx)*(1-tz)+(a[k+N]*(1-tx)+a[k+N+1]*tx)*tz;
  return waveHeight(x,z,u.waterTime.value)+h;
 }
 sample(x,z,id){
  const height=this.heightAt(x,z),ground=Terrain.surfaceHeight(x,z)+(this.voxels.channels?.sample(x,z)||0)+this.voxels.sandOffsetAt(x,z);if(ground>=height-C.MIN_DEPTH)return null;
  return {height,baseHeight:waveHeight(x,z,this.time),depth:height-ground};
 }
 react(q){
  const radius=q.radius??C.REACTION_BASE_RADIUS,p=this.jimothy.body.position;
  if(!this.sample(q.x,q.z)||Math.max(Math.abs(q.x-p.x),Math.abs(q.z-p.z))>this.field.size*this.field.cell/2+radius)return false;
  if(q.kind!=='jimothy'&&this.reactions>=C.MAX_REACTIONS)return false;
  this.reactions++;
  const fall=Math.max(0,-(q.verticalSpeed||0)),r=waterReaction(radius,q.speed||0,fall,q.entering);
  const trail=q.entering?0:r.radius*C.WAKE_TRAIL,x=q.x-(q.vx||0)/Math.max(C.WADE_SPEED,q.speed||0)*trail,z=q.z-(q.vz||0)/Math.max(C.WADE_SPEED,q.speed||0)*trail;
  this.field.disturb(x,z,-r.strength,r.radius*(q.entering?1:C.WAKE_FOOTPRINT));
  const life=Math.min(C.RING_MAX_LIFE,C.RING_LIFE+Math.sqrt(r.radius)*C.RING_LIFE_GAIN);
  const ring={x,z,radius:r.radius,life,duration:life,strength:r.strength,speed:C.RING_SPEED+Math.sqrt(r.radius)*C.RING_SPEED_GAIN,
   width:Math.max(C.FOAM_WIDTH_MIN,Math.min(C.FOAM_WIDTH_MAX,r.radius*C.FOAM_WIDTH_RATIO)),opacity:q.entering?1:C.FOAM_WAKE_OPACITY};
  if(this.rings.length<C.FOAM_RINGS)this.rings.push(ring);
  else {
   let weakest=0;for(let i=1;i<this.rings.length;i++)if(this.rings[i].strength*this.rings[i].life<this.rings[weakest].strength*this.rings[weakest].life)weakest=i;
   if(ring.strength*life>this.rings[weakest].strength*this.rings[weakest].life)this.rings[weakest]=ring;
  }
  if(q.entering&&fall>=C.SPLASH_MIN_FALL)this.splash(q.x,q.z,r.radius,r.scale);
  else if(!q.entering&&q.speed>C.SPLASH_WAKE_SPEED)this.splash(x,z,r.radius*C.WAKE_FOOTPRINT,r.scale*C.SPLASH_WAKE_SCALE,C.SPLASH_WAKE_PARTICLES);
  this.lastReaction={kind:q.kind,radius:r.radius,strength:r.strength,entering:!!q.entering,splashScale:r.scale};return true;
 }
 splash(x,z,radius=C.REACTION_BASE_RADIUS,scale=1,baseCount=C.SPLASH_PARTICLES){
  const count=Math.min(C.SPLASH_MAX_PARTICLES,Math.ceil(baseCount*Math.sqrt(scale))),duration=C.SPLASH_LIFE*Math.sqrt(scale);
  for(let i=0;i<count;i++){
   const a=(this.serial++ + i)*Math.PI*(3-Math.sqrt(5));if(this.drops.length>=C.SPLASH_COUNT)this.drops.shift();
   const variation=1+Math.sin(a)*C.SPLASH_VARIATION;
   const px=x+Math.cos(a)*radius*C.SPLASH_RIM,pz=z+Math.sin(a)*radius*C.SPLASH_RIM;if(!this.sample(px,pz))continue;
   this.drops.push({x:px,y:this.heightAt(px,pz)+C.SPLASH_CLEARANCE,z:pz,vx:Math.cos(a)*C.SPLASH_SPEED*Math.sqrt(scale)*variation,vz:Math.sin(a)*C.SPLASH_SPEED*Math.sqrt(scale)*variation,vy:C.SPLASH_LIFT*Math.sqrt(scale)*variation,life:duration,duration,scale:scale*variation});
  }
 }
 update(dt){
  if(gameState.game.isPlaying)this.time+=dt;this.floating.clear();this.reactions=0;const p=this.jimothy.body.position;this.playerFall=Math.min(this.jimothy.vy,this.jimothy.body.velocity.y);
  this.field.centerAt(p.x,p.z,this.jimothy.radius*C.BODY_WINDOW);this.field.update(dt);
  for(const [id,time] of this.bodyWakes)if(this.time-time>C.PROP_WAKE_RETENTION)this.bodyWakes.delete(id);
  this.surface.position.set(Math.round(p.x),TERRAIN.SEA_LEVEL,Math.round(p.z));this.surface.scale.setScalar(Math.max(1,this.field.size*this.field.cell*C.NEAR_WINDOW_MARGIN/C.NEAR_SIZE));this.uniforms.nearHalf.value=C.NEAR_SIZE*this.surface.scale.x/2;this.uniforms.nearCenter.value.set(this.surface.position.x,this.surface.position.z);
  this.syncSurface();
 }
 syncSurface(){
  this.rippleTexture.image.data.set(this.field.current);this.rippleTexture.needsUpdate=true;
  this.uniforms.rippleCell.value=this.field.cell;this.uniforms.rippleGrid.value.set(this.field.x,this.field.z);this.uniforms.waterTime.value=this.time;this.uniforms.daylight.value=gameState.world.daylight??1;
 }
 afterUpdate(dt){
  const j=this.jimothy,p=j.body.position,water=this.sample(p.x,p.z);this.wakeClock+=dt;
  const fraction=water?Math.max(0,Math.min(1,(water.height-p.y+j.radius)/(j.radius*2))):0;
  const entering=fraction>0&&!this.playerWet&&(fraction<1||this.playerAbove);
  const interval=C.WAKE_INTERVAL*Math.max(1,Math.sqrt(j.radius/C.REACTION_BASE_RADIUS));
  if(entering||(fraction>0&&fraction<1&&j.speed>C.WADE_SPEED&&this.wakeClock>=interval)){
   this.react({kind:'jimothy',x:p.x,z:p.z,radius:j.radius,speed:j.speed,vx:j.vel.x,vz:j.vel.z,verticalSpeed:Math.min(this.playerFall,j.vy),entering});this.wakeClock=0;
  }
  this.playerWet=fraction>0||(this.playerWet&&!!water&&p.y-j.radius<=water.baseHeight+C.CONTACT_RESET_MARGIN);this.playerAbove=!!water&&p.y-j.radius>=water.height;
  this.rings=this.rings.filter(r=>{r.life-=dt;r.radius+=r.speed*dt;return r.life>0;});
  this.ringMesh.count=this.rings.length;this.rings.forEach((r,i)=>{
   this.matrix.position.set(r.x,0,r.z);this.matrix.scale.setScalar(r.radius);this.matrix.updateMatrix();this.ringMesh.setMatrixAt(i,this.matrix.matrix);
   this.ringOpacity.setX(i,r.opacity*C.RING_OPACITY*Math.sqrt(r.life/r.duration)*Math.min(1,r.strength/C.WAKE_STRENGTH));
   this.ringWidth.setX(i,Math.min(1-C.FOAM_INNER,r.width/r.radius));
  });this.ringMesh.instanceMatrix.needsUpdate=true;this.ringOpacity.needsUpdate=true;this.ringWidth.needsUpdate=true;
  this.drops=this.drops.filter(p=>{p.life-=dt;if(p.life<=0)return false;p.vy-=C.GRAVITY*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;return p.y>this.heightAt(p.x,p.z);});
  this.splashMesh.count=this.drops.length;this.drops.forEach((p,i)=>{this.matrix.position.set(p.x,p.y,p.z);this.matrix.scale.setScalar(p.scale*p.life/p.duration);this.matrix.updateMatrix();this.splashMesh.setMatrixAt(i,this.matrix.matrix);});this.splashMesh.instanceMatrix.needsUpdate=true;this.syncSurface();
 }
 reset(){this.field.reset();this.floating.clear();this.bodyWakes.clear();this.drops=[];this.rings=[];this.ringMesh.count=0;this.splashMesh.count=0;this.time=0;this.wakeClock=0;this.playerWet=false;this.playerAbove=false;this.reactions=0;this.lastReaction=null;this.lastReflection=-Infinity;gameState.player.swimming=false;this.syncSurface();}
 snapshot(){return {swimming:!!gameState.player.swimming,diving:!!gameState.player.diving,time:this.time,ripples:this.field.energy(),splashes:this.drops.length,foamRings:this.rings.length,rippleSpan:this.field.size*this.field.cell,lastReaction:this.lastReaction,floating:this.floating.size,waveHeight:this.heightAt(this.jimothy.body.position.x,this.jimothy.body.position.z)};}
}
