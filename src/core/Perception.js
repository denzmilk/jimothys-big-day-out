import {RADAR, VISION, SEWER} from './Constants.js';

// The radar is a plan view of the same voxel ray contract as perception.
// Heights follow grade so a street sloping away does not look wall-blocked.
export function* sightFanSteps(voxels, position, yaw, range, halfAngle, underground, eyeHeight=VISION.EYE_HEIGHT, targetHeight=VISION.TARGET_HEIGHT) {
  for(let i=0;i<=RADAR.CONE_STEPS;i++) {
    const angle=yaw-halfAngle+i/RADAR.CONE_STEPS*halfAngle*2;
    const steps=Math.min(RADAR.SIGHT_MAX_STEPS,Math.ceil(range/RADAR.SIGHT_STEP));
    let visible=0;
    for(let step=1;step<=steps;step++){
      const distance=range*step/steps,dx=Math.sin(angle)*distance,dz=Math.cos(angle)*distance;
      const ty=underground?position.y:surfaceAt(voxels,position.x+dx,position.z+dz,position.y);
      const dy=ty+targetHeight-position.y-eyeHeight,length=Math.hypot(dx,dy,dz);
      const hit=voxels?.raycast(position.x,position.y+eyeHeight,position.z,dx/length,dy/length,dz/length,length);
      if(hit){
        // A far downhill target can be occluded while the nearer pavement is
        // plainly visible. Keep distances already proved clear along this ray.
        let high=distance;
        for(let refine=0;refine<RADAR.SLOPE_REFINE;refine++){
          const mid=(visible+high)/2,mx=Math.sin(angle)*mid,mz=Math.cos(angle)*mid;
          const my=(underground?position.y:surfaceAt(voxels,position.x+mx,position.z+mz,position.y))+targetHeight-position.y-eyeHeight;
          const ml=Math.hypot(mx,my,mz);
          if(voxels.raycast(position.x,position.y+eyeHeight,position.z,mx/ml,my/ml,mz/ml,ml))high=mid;
          else visible=mid;
        }
        break;
      }
      visible=distance;
    }
    yield {x:position.x+Math.sin(angle)*visible,z:position.z+Math.cos(angle)*visible};
  }
}

export function surfaceAt(voxels,x,z,fallback=0){
  return (voxels?.terrainHeightAt(x,z)??fallback)+(voxels?.channels?.sample(x,z)||0);
}
export function belowGround(voxels,position){
  return !!voxels&&surfaceAt(voxels,position.x,position.z)-position.y>SEWER.BELOW;
}

export function sightFan(...args){return [...sightFanSteps(...args)];}

// Radar sampling must not bunch every enemy's voxel marches into the same
// display frame. One ray is the smallest work unit; old completed fans stay
// visible while the next pose is sampled. Perception itself remains live.
export class SightSampler {
  constructor(){this.entries=new Map();this.revision=0;this.lastRays=0;}
  reset(){this.entries.clear();this.revision++;this.lastRays=0;}
  invalidate(){this.revision++;}
  begin(){for(const entry of this.entries.values())entry.used=false;}
  end(){for(const [id,entry]of this.entries)if(!entry.used)this.entries.delete(id);}
  request(id,args){
    let entry=this.entries.get(id);
    if(!entry){entry={result:null,used:true};this.entries.set(id,entry);}
    entry.used=true;
    const old=entry.args,pos=args[1];
    const changed=!old||entry.revision!==this.revision||
      Math.hypot(pos.x-old[1].x,pos.y-old[1].y,pos.z-old[1].z)>RADAR.SIGHT_POSITION_EPS||
      Math.abs(Math.atan2(Math.sin(args[2]-old[2]),Math.cos(args[2]-old[2])))>RADAR.SIGHT_ANGLE_EPS||
      Math.abs(args[3]-old[3])>RADAR.SIGHT_RANGE_EPS||args[5]!==old[5]||args[7]!==old[7];
    if(!entry.job&&changed){entry.args=[...args];entry.args[1]={x:pos.x,y:pos.y,z:pos.z};entry.revision=this.revision;entry.points=[];entry.job=sightFanSteps(...entry.args);}
    return entry.result;
  }
  process(){
    const start=performance.now(),jobs=[...this.entries.values()].filter(e=>e.job);let rays=0;
    while(jobs.length&&rays<RADAR.SIGHT_RAYS_PER_FRAME&&performance.now()-start<RADAR.SIGHT_BUDGET_MS){
      const entry=jobs.shift(),next=entry.job.next();rays++;
      if(next.done){entry.result=entry.points;entry.job=null;}
      else{entry.points.push(next.value);jobs.push(entry);}
    }
    this.lastRays=rays;
  }
}
