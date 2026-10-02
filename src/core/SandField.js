import {BEACH as C} from './Constants.js';

/** Sparse run-persistent compaction, with a fixed nearby upload window. Large
 * stamps are sliced so a giant landing cannot monopolise a frame. */
export class SandField {
  constructor(accept) {
    this.accept=accept;this.cell=C.CELL;this.cells=new Map();this.pending=[];
    this.data=new Float32Array(C.TEXTURE_SIZE**2);this.x=Infinity;this.z=Infinity;
    this.minX=Infinity;this.maxX=-Infinity;this.minZ=Infinity;this.maxZ=-Infinity;
    this.stamps=0;this.lastWork=0;this.dirty=true;this.settling=new Set();
  }
  centerAt(x,z) {
    const ix=Math.floor(x/this.cell),iz=Math.floor(z/this.cell),N=C.TEXTURE_SIZE;
    if(ix-this.x>C.RECENTER_MARGIN&&iz-this.z>C.RECENTER_MARGIN&&ix-this.x<N-C.RECENTER_MARGIN&&iz-this.z<N-C.RECENTER_MARGIN)return;
    this.x=ix-N/2;this.z=iz-N/2;this.dirty=true;this.sync();
  }
  stamp(x,z,radius,depth) {
    if(!this.accept(x,z)||this.pending.length>=C.MAX_JOBS)return false;
    const r=Math.min(radius,C.MAX_RADIUS),x0=Math.floor((x-r)/this.cell),x1=Math.ceil((x+r)/this.cell),z0=Math.floor((z-r)/this.cell),z1=Math.ceil((z+r)/this.cell);
    this.pending.push({x,z,r,depth:Math.min(depth,C.MAX_DEPTH),x0,x1,z0,z1,ix:x0,iz:z0});this.stamps++;return true;
  }
  update(dt) {
    this.lastWork=0;
    while(this.pending.length&&this.lastWork<C.WORK_CELLS){
      const q=this.pending[0],x=q.ix*this.cell,z=q.iz*this.cell,d=Math.hypot(x-q.x,z-q.z)/q.r;this.lastWork++;
      if(d<1&&this.accept(x,z)){
        const key=`${q.ix},${q.iz}`,old=this.cells.get(key);
        if(old||this.cells.size<C.MAX_CELLS){
          const c=old||{ix:q.ix,iz:q.iz,depth:0,rest:0},amount=q.depth*(1-d*d);
          c.depth=Math.max(-C.MAX_DEPTH,c.depth-amount);c.rest=Math.min(c.rest,c.depth*C.PERMANENCE);c.updated=this.time||0;
          this.cells.set(key,c);this.minX=Math.min(this.minX,q.ix);this.maxX=Math.max(this.maxX,q.ix);this.minZ=Math.min(this.minZ,q.iz);this.maxZ=Math.max(this.maxZ,q.iz);this.settling.add(key);this.touch(c);
        }
      }
      if(++q.ix>q.x1){q.ix=q.x0;q.iz++;}if(q.iz>q.z1)this.pending.shift();
    }
    // Rotate the work set. Every cell gets elapsed simulation time, even when
    // it waits several frames for its slice of the settling budget.
    this.time=(this.time||0)+dt;
    for(let n=0,limit=Math.min(C.SETTLE_CELLS,this.settling.size);n<limit;n++){
      const key=this.settling.values().next().value,c=this.cells.get(key);this.settling.delete(key);
      const elapsed=this.time-(c.updated??this.time-dt);c.updated=this.time;
      c.depth+=(c.rest-c.depth)*(1-Math.exp(-C.SETTLE_RATE*elapsed));this.touch(c);
      if(Math.abs(c.rest-c.depth)>1e-5)this.settling.add(key);
    }
    this.sync();
  }
  touch(c){const x=c.ix-this.x,z=c.iz-this.z,N=C.TEXTURE_SIZE;if(x>=0&&z>=0&&x<N&&z<N){this.data[z*N+x]=c.depth;this.version=(this.version||0)+1;}}
  sample(x,z) {if(x/this.cell<this.minX-1||x/this.cell>this.maxX+1||z/this.cell<this.minZ-1||z/this.cell>this.maxZ+1)return 0;return this.interpolate(x/this.cell,z/this.cell,(ix,iz)=>this.cells.get(`${ix},${iz}`)?.depth||0);}
  interpolate(x,z,read){const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;return (read(ix,iz)*(1-u)+read(ix+1,iz)*u)*(1-v)+(read(ix,iz+1)*(1-u)+read(ix+1,iz+1)*u)*v;}
  renderSample(x,z){const N=C.TEXTURE_SIZE;return this.interpolate(x/this.cell-this.x,z/this.cell-this.z,(i,j)=>i<0||j<0||i>=N||j>=N?0:this.data[j*N+i]);}
  sync(){
    if(!this.dirty||!Number.isFinite(this.x))return;
    const N=C.TEXTURE_SIZE;this.data.fill(0);
    // Sparse cells are cheaper than 65k Map lookups when only a few paws have
    // touched the beach. The persistence cap bounds the worst case too.
    for(const c of this.cells.values()){const x=c.ix-this.x,z=c.iz-this.z;if(x>=0&&z>=0&&x<N&&z<N)this.data[z*N+x]=c.depth;}
    this.dirty=false;this.version=(this.version||0)+1;
  }
  reset(){this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;this.cells.clear();this.pending=[];this.settling.clear();this.time=0;this.stamps=0;this.lastWork=0;this.dirty=true;this.sync();}
}

export function sandShader(){return `
 uniform sampler2D sandMap; uniform vec2 sandOrigin;
 float sandOffset(vec2 p){vec2 g=p/${C.CELL.toFixed(8)}-sandOrigin,i=floor(g),f=fract(g);
 if(any(lessThan(i,vec2(0.)))||any(greaterThanEqual(i,vec2(${(C.TEXTURE_SIZE-1).toFixed(1)}))))return 0.;
 vec2 uv=(i+.5)/${C.TEXTURE_SIZE.toFixed(1)},d=vec2(1./${C.TEXTURE_SIZE.toFixed(1)},0.);
 return mix(mix(texture2D(sandMap,uv).r,texture2D(sandMap,uv+d.xy).r,f.x),mix(texture2D(sandMap,uv+d.yx).r,texture2D(sandMap,uv+d.xx).r,f.x),f.y);}
 `;}
