import {GROUND_CHANNEL as C,WORLD,VOXEL} from './Constants.js';

// A broad ground displacement needs one height per surface sample, not a
// saved air voxel for every centimetre of depth (JIM-70). The finite island
// bounds the allocation; the nearby upload window never grows with travel.
export class GroundChannelField {
 constructor(grade){
  this.grade=grade;this.cell=C.FIELD_CELL;this.size=Math.ceil(WORLD.BOUNDS*2/this.cell)+3;this.origin=-Math.ceil(WORLD.BOUNDS/this.cell)-1;
  this.values=new Float32Array(this.size**2);this.data=new Float32Array(C.FIELD_TEXTURE**2);this.pending=[];this.x=Infinity;this.z=Infinity;this.version=0;this.reset();
 }
 index(x,z){const i=x-this.origin,j=z-this.origin;return i<0||j<0||i>=this.size||j>=this.size?-1:j*this.size+i;}
 read(x,z){const i=this.index(x,z);return i<0?0:this.values[i];}
 sample(x,z){
  if(x<this.minX||x>this.maxX||z<this.minZ||z>this.maxZ)return 0;
  return this.interpolate(x/this.cell,z/this.cell,(i,j)=>this.read(i,j));
 }
 interpolate(x,z,read){const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j;return (read(i,j)*(1-u)+read(i+1,j)*u)*(1-v)+(read(i,j+1)*(1-u)+read(i+1,j+1)*u)*v;}
 renderSample(x,z){const N=C.FIELD_TEXTURE;return this.interpolate(x/this.cell-this.x,z/this.cell-this.z,(i,j)=>i<0||j<0||i>=N||j>=N?0:this.data[j*N+i]);}
 centerAt(x,z){
  const i=Math.floor(x/this.cell),j=Math.floor(z/this.cell),N=C.FIELD_TEXTURE;
  if(Math.abs(i-this.x-N/2)<C.FIELD_RECENTER&&Math.abs(j-this.z-N/2)<C.FIELD_RECENTER)return;
  this.x=i-N/2;this.z=j-N/2;this.data.fill(0);
  for(let z=0;z<N;z++){
   const from=this.index(Math.max(this.origin,this.x),this.z+z);if(from<0)continue;
   const left=Math.max(0,this.origin-this.x),right=Math.min(N,this.origin+this.size-this.x);
   if(right>left)this.data.set(this.values.subarray(from,from+right-left),z*N+left);
  }this.version++;
 }
 queue(from,to,radius,depth){
  if(this.pending.length>=C.MAX_SEGMENTS||!(radius>0&&depth>0))return false;
  const reach=radius*C.BANK_OUTER,x0=Math.floor((Math.min(from.x,to.x)-reach)/this.cell),x1=Math.ceil((Math.max(from.x,to.x)+reach)/this.cell),z0=Math.floor((Math.min(from.z,to.z)-reach)/this.cell),z1=Math.ceil((Math.max(from.z,to.z)+reach)/this.cell);
  this.pending.push({from:{...from},to:{...to},radius,depth:Math.min(C.MAX_DEPTH,depth),x0,x1,z0,z1,x:x0,z:z0});return true;
 }
 update(){
  this.work=0;this.removed=0;this.changed=[];this.bounds=null;
  while(this.pending.length&&this.work<C.FIELD_WORK){
   const q=this.pending[0],x=q.x*this.cell,z=q.z*this.cell,dx=q.to.x-q.from.x,dz=q.to.z-q.from.z,length2=dx*dx+dz*dz;
   const t=length2?Math.max(0,Math.min(1,((x-q.from.x)*dx+(z-q.from.z)*dz)/length2)):0,d=Math.hypot(x-q.from.x-dx*t,z-q.from.z-dz*t)/q.radius;
   const index=this.index(q.x,q.z);this.work++;
   if(index>=0&&d<C.BANK_OUTER){
    const grade=this.grade(x,z),feet=q.from.y+(q.to.y-q.from.y)*t;
    if(feet<=grade+C.CONTACT_SLOP&&feet>=grade-q.depth*(1+C.ROUGHNESS)-VOXEL.SIZE){
     const rough=1+C.ROUGHNESS*Math.sin(x*C.ROUGH_SCALE+Math.sin(z*C.ROUGH_SCALE))*Math.sin(z*C.ROUGH_SCALE);
     const amount=d<1?-q.depth*(1-d*d)*rough:q.depth*C.BANK_HEIGHT*Math.sin((d-1)/(C.BANK_OUTER-1)*Math.PI)*rough;
     const old=this.values[index],next=amount<0?Math.min(old,amount):old<0?old:Math.max(old,amount);
     if(next!==old){
      this.bounds??={min:[x,grade+next,z],max:[x,grade,z]};
      for(const [i,v] of [x,grade+next,z].entries())this.bounds.min[i]=Math.min(this.bounds.min[i],v);
      for(const [i,v] of [x,grade,z].entries())this.bounds.max[i]=Math.max(this.bounds.max[i],v);
      if(!old)this.cells++;this.values[index]=next;this.minX=Math.min(this.minX,x-this.cell);this.maxX=Math.max(this.maxX,x+this.cell);this.minZ=Math.min(this.minZ,z-this.cell);this.maxZ=Math.max(this.maxZ,z+this.cell);
      const i=q.x-this.x,j=q.z-this.z,N=C.FIELD_TEXTURE;if(i>=0&&j>=0&&i<N&&j<N)this.data[j*N+i]=next;
      this.version++;const volume=Math.max(0,Math.min(0,old)-Math.min(0,next))*this.cell**2;this.removed+=Math.round(volume/VOXEL.SIZE**3);
      if(this.changed.length<C.EFFECT_SAMPLES&&amount<0)this.changed.push({x,y:grade,z,mat:C.DIRT_MATERIAL,dx:x-q.from.x-dx*t,dz:z-q.from.z-dz*t,radius:q.radius});
     }
    }
   }
   if(++q.x>q.x1){q.x=q.x0;q.z++;}if(q.z>q.z1)this.pending.shift();
  }
 }
 reset(){this.values.fill(0);this.data.fill(0);this.pending=[];this.cells=0;this.work=0;this.removed=0;this.changed=[];this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;this.version++;}
}

export function groundChannelShader(){return `
 uniform sampler2D channelMap;uniform vec2 channelOrigin;
 float channelOffset(vec2 p){vec2 g=p/${C.FIELD_CELL.toFixed(8)}-channelOrigin,i=floor(g),f=fract(g);
 if(any(lessThan(i,vec2(0.)))||any(greaterThanEqual(i,vec2(${(C.FIELD_TEXTURE-1).toFixed(1)}))))return 0.;
 vec2 uv=(i+.5)/${C.FIELD_TEXTURE.toFixed(1)},d=vec2(1./${C.FIELD_TEXTURE.toFixed(1)},0.);
 return mix(mix(texture2D(channelMap,uv).r,texture2D(channelMap,uv+d.xy).r,f.x),mix(texture2D(channelMap,uv+d.yx).r,texture2D(channelMap,uv+d.xx).r,f.x),f.y);}
 `;}
