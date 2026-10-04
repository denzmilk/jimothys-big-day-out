import * as THREE from 'three';
import {TOOLS as C} from './Constants.js';

// M65 renders the same frozen contact plan used by the instantaneous sonic/
// status action. A fading shot must not retarget another person after firing.
export class ToolPulse {
 constructor(scene,cue){
  this.items=[];this.time=0;this.cue=cue;this.dummy=new THREE.Object3D();this.up=new THREE.Vector3(0,1,0);this.forward=new THREE.Vector3(0,0,1);
  const material=()=>new THREE.MeshBasicMaterial({transparent:true,opacity:C.PULSE_OPACITY,depthWrite:false});
  this.segments=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,C.FLOW_TUBE_SEGMENTS),material(),C.PULSE_LIMIT*C.PULSE_SEGMENTS);
  this.cores=new THREE.InstancedMesh(this.segments.geometry,material(),C.PULSE_LIMIT);
  this.rings=new THREE.InstancedMesh(new THREE.TorusGeometry(1,C.PULSE_RING_WIDTH,...C.FLOW_RING_SEGMENTS),material(),C.PULSE_RINGS);
  this.contacts=new THREE.InstancedMesh(new THREE.SphereGeometry(1,...C.FLOW_SPHERE_SEGMENTS),material(),C.PULSE_LIMIT);
  const atlas=this.iconAtlas();
  this.marks=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,uniforms:{atlas:{value:atlas},slots:{value:C.PULSE_MARK_KINDS.length}},
   vertexShader:[
    'attribute float icon;varying float vIcon;varying vec2 vUv;',
    'void main(){vUv=uv;vIcon=icon;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);',
    'center.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*center;}',
   ].join('\n'),
   fragmentShader:[
    'uniform sampler2D atlas;uniform float slots;varying float vIcon;varying vec2 vUv;',
    'void main(){gl_FragColor=texture2D(atlas,vec2((vUv.x+vIcon)/slots,vUv.y));if(gl_FragColor.a<.01)discard;',
    '#include <tonemapping_fragment>',
    '#include <colorspace_fragment>',
    '}',
   ].join('\n'),
  }),C.PULSE_MARKS);
  this.icons=new THREE.InstancedBufferAttribute(new Float32Array(C.PULSE_MARKS),1);this.marks.geometry.setAttribute('icon',this.icons);
  this.meshes=[this.segments,this.cores,this.rings,this.contacts,this.marks];for(const m of this.meshes){m.frustumCulled=false;scene.add(m);}this.reset();
 }
 iconAtlas(){
  const canvas=document.createElement('canvas'),size=C.PULSE_ICON_PIXELS;canvas.width=size*C.PULSE_MARK_KINDS.length;canvas.height=size;
  const ctx=canvas.getContext('2d'),css=c=>'#'+c.toString(16).padStart(6,'0');
  for(let i=0;i<C.PULSE_MARK_KINDS.length;i++){
   ctx.save();ctx.translate(i*size,0);ctx.scale(size,size);ctx.fillStyle=css(C.PULSE_ICON_COLORS[i]);ctx.strokeStyle=css(C.PULSE_ICON_OUTLINE);ctx.lineWidth=.045;ctx.lineJoin='round';ctx.lineCap='round';
   if(i===0){ctx.beginPath();for(let n=0;n<10;n++){const a=n*Math.PI/5-Math.PI/2,r=n%2?.2:.43;ctx[n?'lineTo':'moveTo'](.5+Math.cos(a)*r,.5+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
   if(i===1){ctx.beginPath();ctx.ellipse(.28,.74,.16,.105,-.25,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(.4,.73);ctx.lineTo(.4,.19);ctx.lineTo(.8,.1);ctx.lineTo(.8,.6);ctx.stroke();ctx.beginPath();ctx.ellipse(.68,.64,.16,.105,-.25,0,Math.PI*2);ctx.fill();ctx.stroke();}
   if(i===2){ctx.beginPath();ctx.arc(.5,.5,.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(.24,.39);ctx.lineTo(.4,.43);ctx.moveTo(.6,.43);ctx.lineTo(.76,.39);ctx.moveTo(.26,.68);ctx.bezierCurveTo(.4,.51,.56,.85,.73,.61);ctx.stroke();}
   ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 }
 fire(plan,definition){
  if(this.items.length>=C.PULSE_LIMIT)return;
  const range=Math.max(...plan.paths.map(p=>p.distance)),life=plan.profile.style==='horn'?range/C.PULSE_SPEED+C.PULSE_BANDS*C.PULSE_BAND_DELAY+C.PULSE_TAIL:C.PULSE_SECONDS;
  this.items.push({id:definition.id,mode:definition.mode,profile:plan.profile,origin:plan.origin.clone(),direction:plan.direction.clone(),paths:plan.paths.map(p=>({end:p.end.clone(),hit:p.hit,distance:p.distance})),blockedMuzzle:plan.blockedMuzzle,age:0,life});
  this.draw();
 }
 update(dt,statuses){
  this.time+=dt;for(const p of this.items)p.age+=dt;
  for(const p of this.items)if(p.age>=p.life)this.cue(p.mode+'-end',p.origin);
  this.items=this.items.filter(p=>p.age<p.life);this.draw();this.drawMarks(statuses);
 }
 place(mesh,position,scale,color,quaternion){
  if(mesh.count>=mesh.instanceMatrix.count)return;
  this.dummy.position.copy(position);this.dummy.scale.copy(scale);this.dummy.quaternion.copy(quaternion);this.dummy.updateMatrix();
  mesh.setMatrixAt(mesh.count,this.dummy.matrix);if(color!==undefined)mesh.setColorAt(mesh.count,new THREE.Color(color));mesh.count++;
 }
 tube(mesh,a,b,r,color){
  const d=b.clone().sub(a),length=d.length();if(length<=C.FLOW_SKIN)return;
  this.place(mesh,a.clone().addScaledVector(d,.5),new THREE.Vector3(r,length,r),color,new THREE.Quaternion().setFromUnitVectors(this.up,d.normalize()));
 }
 finish(mesh){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 draw(){
  for(const m of [this.segments,this.cores,this.rings,this.contacts])m.count=0;
  for(const p of this.items){
   const first=p.paths[0],fade=Math.max(0,1-p.age/p.life),color=p.profile.color;
   if(p.profile.style==='horn'){
    for(const path of p.paths)for(let band=0;band<C.PULSE_BANDS;band++){
     const distance=(p.age-band*C.PULSE_BAND_DELAY)*C.PULSE_SPEED;if(distance<0||distance>path.distance)continue;
     const delta=path.end.clone().sub(p.origin).normalize(),r=Math.min(C.PULSE_RING_MAX,C.PULSE_RING_MIN+distance*C.PULSE_RING_SPREAD,path.hit?Math.max(C.FLOW_SKIN,path.distance-distance):Infinity);
     this.place(this.rings,p.origin.clone().addScaledVector(delta,distance),new THREE.Vector3(r,r,r),color,new THREE.Quaternion().setFromUnitVectors(this.forward,delta));
    }
   }else{
    const right=new THREE.Vector3(p.direction.z,0,-p.direction.x);if(!right.lengthSq())right.set(1,0,0);right.normalize();
    const point=f=>p.origin.clone().lerp(first.end,f).addScaledVector(right,p.profile.style==='sick'?Math.sin(f*Math.PI*C.PULSE_WAVES+p.age*C.PULSE_WAVE_RATE)*Math.sin(f*Math.PI)*C.PULSE_WAVE_AMPLITUDE:0);
    for(let i=0;i<C.PULSE_SEGMENTS;i++)this.tube(this.segments,point(i/C.PULSE_SEGMENTS),point((i+1)/C.PULSE_SEGMENTS),C.PULSE_RADIUS*fade,p.profile.style==='disco'?C.PULSE_PALETTE[(i+Math.floor(this.time*C.PULSE_COLOR_RATE))%C.PULSE_PALETTE.length]:color);
    this.tube(this.cores,p.origin,first.end,C.PULSE_CORE_RADIUS*fade,C.FLOW_CORE_COLOR);
   }
   if(first.hit){const r=(C.PULSE_CONTACT_SIZE+p.age*C.PULSE_CONTACT_GROWTH)*fade;this.place(this.contacts,first.end,new THREE.Vector3(r,r,r),color,new THREE.Quaternion());}
  }
  for(const m of [this.segments,this.cores,this.rings,this.contacts])this.finish(m);
 }
 drawMarks(statuses){
  this.marks.count=0;
  for(const s of statuses.values()){
   const icon=C.PULSE_MARK_KINDS.indexOf(s.kind);if(icon<0)continue;
   const count=s.kind==='sick'?1:C.PULSE_BANDS;
   for(let i=0;i<count&&this.marks.count<C.PULSE_MARKS;i++){
    const a=this.time*C.PULSE_ICON_SPEED+i*Math.PI*2/count,position=s.visual.position.clone();
    position.x+=Math.cos(a)*C.PULSE_ICON_ORBIT;position.z+=Math.sin(a)*C.PULSE_ICON_ORBIT;position.y+=Math.sin(a)*C.PULSE_ICON_BOB;
    this.icons.setX(this.marks.count,icon);this.place(this.marks,position,new THREE.Vector3().setScalar(C.PULSE_ICON_SIZE),undefined,new THREE.Quaternion());
   }
  }this.icons.needsUpdate=true;this.finish(this.marks);
 }
 stop(){this.items=[];for(const m of this.meshes){m.count=0;m.visible=false;}}
 reset(){this.stop();this.time=0;}
 snapshot(){return{count:this.items.length,marks:this.marks.count,items:this.items.map(p=>({id:p.id,origin:p.origin.toArray(),paths:p.paths.map(q=>({end:q.end.toArray(),hit:q.hit})),blockedMuzzle:p.blockedMuzzle,age:p.age}))};}
}
