import {VOXEL} from '../core/Constants.js';
import manifest from './landmarkManifest.json' with {type:'json'};
import * as City from './CityPlanner.js';
const templates=new Map(),columns=new Map();
export function landmarkRuns(id){return templates.get(id)||[];}
export async function loadLandmarkVoxels(){
 const response=await fetch(import.meta.env.BASE_URL+'assets/models/landmarks/voxels.bin');if(!response.ok)throw Error('Landmark voxel assets failed: '+response.status);
 const data=new Int16Array(await response.arrayBuffer());
 for(const m of manifest){const runs=[];for(let i=m.offset;i<m.offset+m.runs*5;i+=5)runs.push(data.subarray(i,i+5));templates.set(m.id,runs);}
 for(const s of City.landmarks())for(const r of landmarkRuns(s.id)){
  const x=s.vx+r[0],z=s.vz+r[1],key=`${Math.floor(x/VOXEL.CHUNK_XZ)},${Math.floor(z/VOXEL.CHUNK_XZ)}`;
  if(!columns.has(key))columns.set(key,[]);columns.get(key).push([x,z,s.vy+r[2],s.vy+r[3],r[4]]);
 }
}
// Offline runs make runtime work proportional to solid cells in THIS column.
// Scanning every primitive's whole volume per chunk hitches on tall landmarks.
export function* writeLandmarks(world,cx,cz){
 for(const [x,z,y0,y1,mat]of columns.get(`${cx},${cz}`)||[]){yield;for(let y=y0;y<=y1;y++)world.set(x,y,z,mat);}
}
