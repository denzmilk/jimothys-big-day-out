import {WATER as C,TERRAIN} from './Constants.js';
export function waveHeight(x,z,time){
 let y=TERRAIN.SEA_LEVEL;
 for(const [dx,dz,length,amplitude,phase] of C.WAVES){const k=Math.PI*2/length;y+=amplitude*Math.sin(k*(x*dx+z*dz)-Math.sqrt(C.GRAVITY*k)*time+phase);}
 return y;
}
export function waveShader(){return `float waves(vec2 p,float t){return ${TERRAIN.SEA_LEVEL.toFixed(8)}${C.WAVES.map(([x,z,l,a,p])=>`+${a.toFixed(8)}*sin(${(Math.PI*2/l).toFixed(8)}*dot(p,vec2(${x.toFixed(8)},${z.toFixed(8)}))-${Math.sqrt(C.GRAVITY*Math.PI*2/l).toFixed(8)}*t+${p.toFixed(8)})`).join('')};}`;}

export function waterReaction(radius,speed,fallSpeed,entering){
 const r=Math.max(C.REACTION_RADIUS_MIN,Math.min(C.REACTION_RADIUS_MAX,radius)),size=Math.sqrt(r/C.REACTION_BASE_RADIUS);
 const strength=Math.max(C.REACTION_MIN,Math.min(C.REACTION_MAX,size*(entering?C.ENTRY_GAIN*Math.max(C.ENTRY_MIN_SPEED,fallSpeed):C.WAKE_GAIN*speed)));
 const scale=Math.max(C.SPLASH_SCALE_MIN,Math.min(C.SPLASH_SCALE_MAX,size*Math.min(C.SPLASH_IMPACT_MAX,1+fallSpeed*C.SPLASH_IMPACT_GAIN)));
 return {radius:r,strength,scale};
}

// Local damped wave equation. Fixed steps obey the 2D CFL bound; a moving
// window keeps surviving samples at the same world coordinates (M31).
export class RippleField {
 constructor(ground){this.ground=ground;this.size=C.RIPPLE_SIZE;this.cell=C.RIPPLE_CELL;this.current=new Float32Array(this.size**2);this.velocity=new Float32Array(this.size**2);this.next=new Float32Array(this.size**2);this.old=new Float32Array(this.size**2);this.oldVelocity=new Float32Array(this.size**2);this.mask=new Uint8Array(this.size**2);this.x=Infinity;this.z=Infinity;this.accumulator=0;this.activity=0;}
 centerAt(x,z,span=this.size*C.RIPPLE_CELL){
  const cell=Math.max(C.RIPPLE_CELL,Math.min(C.MAX_WINDOW,span)/this.size);
  const ox=Math.floor(x/cell)-this.size/2,oz=Math.floor(z/cell)-this.size/2;if(ox===this.x&&oz===this.z&&cell===this.cell)return;
  const old=this.old,velocity=this.oldVelocity,N=this.size,oldX=this.x,oldZ=this.z,oldCell=this.cell;
  old.set(this.current);velocity.set(this.velocity);this.x=ox;this.z=oz;this.cell=cell;
  // Reproject in world space when growing. Changing resolution must not move
  // yesterday's wake onto the animal or allocate a larger fluid simulation.
  const sample=(a,x,z)=>{const i=Math.floor(x),j=Math.floor(z);if(i<0||j<0||i>=N-1||j>=N-1||!Number.isFinite(i+j))return 0;const u=x-i,v=z-j,k=j*N+i;return (a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+N]*(1-u)+a[k+N+1]*u)*v;};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const k=j*N+i,a=(ox+i)*cell/oldCell-oldX,b=(oz+j)*cell/oldCell-oldZ;
   this.current[k]=sample(old,a,b);this.velocity[k]=sample(velocity,a,b);
   this.mask[k]=this.ground((ox+i)*this.cell,(oz+j)*this.cell)<TERRAIN.SEA_LEVEL?1:0;
   if(!this.mask[k])this.current[k]=this.velocity[k]=0;
  }
 }
 refreshGround({min,max}){
  const N=this.size,i0=Math.max(0,Math.floor(min[0]/this.cell-this.x)),i1=Math.min(N-1,Math.ceil(max[0]/this.cell-this.x)),j0=Math.max(0,Math.floor(min[2]/this.cell-this.z)),j1=Math.min(N-1,Math.ceil(max[2]/this.cell-this.z));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*N+i;this.mask[k]=this.ground((this.x+i)*this.cell,(this.z+j)*this.cell)<TERRAIN.SEA_LEVEL?1:0;if(!this.mask[k])this.current[k]=this.velocity[k]=0;}
 }
 disturb(x,z,strength,radius=this.cell){
  const cx=Math.round(x/this.cell-this.x),cz=Math.round(z/this.cell-this.z),N=this.size;
  const footprint=Math.max(this.cell,radius),reach=Math.min(N,Math.ceil(C.SPLAT_RADIUS*footprint/this.cell));
  for(let j=-reach;j<=reach;j++)for(let i=-reach;i<=reach;i++){
   const a=cx+i,b=cz+j,k=b*N+a;if(a<1||b<1||a>=N-1||b>=N-1||!this.mask[k])continue;
   this.current[k]=Math.max(-C.RIPPLE_MAX,Math.min(C.RIPPLE_MAX,this.current[k]+strength*Math.exp(-C.SPLAT_FALLOFF*(i*i+j*j)*this.cell**2/footprint**2)));
  }this.activity=C.RIPPLE_LIFETIME;
 }
 update(dt){
  if(this.activity<=0)return;this.activity=Math.max(0,this.activity-dt);this.accumulator+=dt;
  const N=this.size,h=C.RIPPLE_STEP,c=C.RIPPLE_SPEED**2/(this.cell*C.RIPPLE_CELL),damp=Math.exp(-C.RIPPLE_DAMPING*h);
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
