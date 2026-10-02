import {WATER as C,TERRAIN} from './Constants.js';
export function waveHeight(x,z,time){
 let y=TERRAIN.SEA_LEVEL;
 for(const [dx,dz,length,amplitude,phase] of C.WAVES){const k=Math.PI*2/length;y+=amplitude*Math.sin(k*(x*dx+z*dz)-Math.sqrt(C.GRAVITY*k)*time+phase);}
 return y;
}
export function waveShader(){return `float waves(vec2 p,float t){return ${TERRAIN.SEA_LEVEL.toFixed(8)}${C.WAVES.map(([x,z,l,a,p])=>`+${a.toFixed(8)}*sin(${(Math.PI*2/l).toFixed(8)}*dot(p,vec2(${x.toFixed(8)},${z.toFixed(8)}))-${Math.sqrt(C.GRAVITY*Math.PI*2/l).toFixed(8)}*t+${p.toFixed(8)})`).join('')};}`;}

// Local damped wave equation. Fixed steps obey the 2D CFL bound; a moving
// window keeps surviving samples at the same world coordinates (M31).
export class RippleField {
 constructor(ground){this.ground=ground;this.size=C.RIPPLE_SIZE;this.cell=C.RIPPLE_CELL;this.current=new Float32Array(this.size**2);this.velocity=new Float32Array(this.size**2);this.next=new Float32Array(this.size**2);this.mask=new Uint8Array(this.size**2);this.x=Infinity;this.z=Infinity;this.accumulator=0;this.activity=0;}
 centerAt(x,z){
  const ox=Math.floor(x/this.cell)-this.size/2,oz=Math.floor(z/this.cell)-this.size/2;if(ox===this.x&&oz===this.z)return;
  const dx=ox-this.x,dz=oz-this.z,old=this.current.slice(),velocity=this.velocity.slice(),N=this.size;
  this.x=ox;this.z=oz;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const k=j*N+i,a=i+dx,b=j+dz,keep=a>=0&&b>=0&&a<N&&b<N;
   this.current[k]=keep?old[b*N+a]:0;this.velocity[k]=keep?velocity[b*N+a]:0;
   this.mask[k]=this.ground((ox+i)*this.cell,(oz+j)*this.cell)<TERRAIN.SEA_LEVEL?1:0;
   if(!this.mask[k])this.current[k]=this.velocity[k]=0;
  }
 }
 disturb(x,z,strength){
  const cx=Math.round(x/this.cell-this.x),cz=Math.round(z/this.cell-this.z),N=this.size;
  for(let j=-C.SPLAT_RADIUS;j<=C.SPLAT_RADIUS;j++)for(let i=-C.SPLAT_RADIUS;i<=C.SPLAT_RADIUS;i++){
   const a=cx+i,b=cz+j,k=b*N+a;if(a<1||b<1||a>=N-1||b>=N-1||!this.mask[k])continue;
   this.current[k]=Math.max(-C.RIPPLE_MAX,Math.min(C.RIPPLE_MAX,this.current[k]+strength*Math.exp(-(i*i+j*j))));
  }this.activity=C.RIPPLE_LIFETIME;
 }
 update(dt){
  if(this.activity<=0)return;this.activity=Math.max(0,this.activity-dt);this.accumulator+=dt;
  const N=this.size,h=C.RIPPLE_STEP,c=C.RIPPLE_SPEED**2/(this.cell**2),damp=Math.exp(-C.RIPPLE_DAMPING*h);
  while(this.accumulator>=h){
   for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
    const k=j*N+i;if(!this.mask[k]){this.next[k]=0;continue;}
    const lap=this.current[k-1]+this.current[k+1]+this.current[k-N]+this.current[k+N]-4*this.current[k];
    this.velocity[k]=(this.velocity[k]+c*lap*h)*damp;
    this.next[k]=Math.max(-C.RIPPLE_MAX,Math.min(C.RIPPLE_MAX,this.current[k]+this.velocity[k]*h));
   }
   this.current.set(this.next);this.accumulator-=h;
  }
  if(!this.activity){this.current.fill(0);this.velocity.fill(0);}
 }
 sample(x,z){
  const fx=x/this.cell-this.x,fz=z/this.cell-this.z,i=Math.floor(fx),j=Math.floor(fz),N=this.size;if(i<0||j<0||i>=N-1||j>=N-1)return 0;
  const tx=fx-i,tz=fz-j,k=j*N+i,a=this.current;return (a[k]*(1-tx)+a[k+1]*tx)*(1-tz)+(a[k+N]*(1-tx)+a[k+N+1]*tx)*tz;
 }
 energy(){return this.current.reduce((n,h)=>n+h*h,0);}
 reset(){this.current.fill(0);this.velocity.fill(0);this.next.fill(0);this.activity=0;this.accumulator=0;}
}
