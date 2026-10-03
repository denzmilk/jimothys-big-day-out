import * as THREE from 'three';
import {INTERIORS as C} from '../core/Constants.js';

// Door leaves share the voxel plan's dimensions; a decorative frame cannot
// disagree with the actual opening after the facade is rotated or broken.
export function doorTemplate(width,height,color){
 const root=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color,roughness:C.DOOR_ROUGHNESS});
 const panel=wood.clone();panel.color.multiplyScalar(C.DOOR_PANEL_LIGHT);
 const metal=new THREE.MeshStandardMaterial({color:C.DOOR_METAL_COLOR,roughness:C.DOOR_ROUGHNESS,metalness:C.DOOR_METALNESS});
 const box=(w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.updateMatrix();mesh.geometry.applyMatrix4(mesh.matrix);mesh.position.set(0,0,0);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);};
 box(width,height,C.DOOR_DEPTH,0,0,0,wood);
 for(const sign of [-1,1]){
  for(const level of C.DOOR_PANEL_Y)box(width-C.DOOR_PANEL_INSET*2,height*C.DOOR_PANEL_HEIGHT,C.DOOR_PANEL_DEPTH,0,height*(level-.5),sign*(C.DOOR_DEPTH+C.DOOR_PANEL_DEPTH)/2,panel);
  const [w,h,d]=C.DOOR_HANDLE_SIZE;box(w,h,d,width/2-C.DOOR_HANDLE_INSET,height*(C.DOOR_HANDLE_HEIGHT-.5),sign*(C.DOOR_DEPTH+d)/2,metal);
  const [mw,mh,md]=C.DOOR_MAIL_SIZE;box(mw,mh,md,0,height*(C.DOOR_MAIL_HEIGHT-.5),sign*(C.DOOR_DEPTH+md)/2,metal);
 }
 return {root,half:[width/2,height/2,C.DOOR_DEPTH/2+C.DOOR_HANDLE_SIZE[2]],size:Math.max(width,height)};
}

// The leaf blocks sight even though its hinge is animated outside the voxel
// grid. A segment slab test avoids triangle casts for every radar sample.
export function doorIntersection(p,line){
 const q=p.mesh.position,yaw=p.mesh.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw);
 const ax=line.ax-q.x,az=line.az-q.z,dx=line.bx-line.ax,dz=line.bz-line.az;
 let enter=0,leave=1;
 for(const [a,d,h]of[[ax*c-az*s,dx*c-dz*s,p.half[0]],[line.ay-q.y,line.by-line.ay,p.half[1]],[ax*s+az*c,dx*s+dz*c,C.DOOR_DEPTH/2]]){
  if(Math.abs(d)<Number.EPSILON){if(Math.abs(a)>h)return Infinity;continue;}
  const t0=(-h-a)/d,t1=(h-a)/d;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));if(enter>leave)return Infinity;
 }
 return enter;
}
