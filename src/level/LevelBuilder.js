import * as THREE from 'three';
import {InstanceBatches} from '../core/InstanceBatches.js';
import { WORLD, COLORS, HIDE_SPOTS, TERRAIN, HORIZON, VOXEL, ATMOSPHERE as A, STREET } from '../core/Constants.js';
import * as Terrain from './Terrain.js';
import * as Masterplan from './CityPlanner.js';
import { gameState } from '../core/GameState.js';
import { eventBus, Events } from '../core/EventBus.js';

// Static block dressing: the sky, hide-spot bushes, and the perimeter curbs
// matching the physics walls in PhysicsSystem.
export class LevelBuilder {
  constructor(scene, voxels = null) {
    this.scene = scene;
    this.voxels = voxels;
    this.time = 0;
    const time = { value: 0 };
    this.atmosphereTime = time;
    const common = {
      uTime: time, sunDir: { value: new THREE.Vector3(...A.SUN_DIRECTION).normalize() },
      horizonColor: { value: new THREE.Color(A.SKY_HORIZON) },
      topColor: { value: new THREE.Color(A.SKY_TOP) },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(A.SKY_RADIUS, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { ...common, night:{value:0}, cloudColor: {value:new THREE.Color(A.CLOUD)}, cloudSpeed:{value:A.CLOUD_SPEED}, cloudScale:{value:A.CLOUD_SCALE} },
      vertexShader: `varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 direction; uniform float uTime,cloudSpeed,cloudScale,night; uniform vec3 topColor,horizonColor,cloudColor,sunDir;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){vec3 d=normalize(direction);float height=max(0.,d.y);vec3 c=mix(horizonColor,topColor,pow(height,.45));
          vec2 p=d.xz/(height+.25)*cloudScale+vec2(uTime*cloudSpeed,0.);float n=noise(p)*.6+noise(p*2.1)*.3+noise(p*4.3)*.1;
          float cloud=smoothstep(.53,.72,n)*smoothstep(.02,.22,height);c=mix(c,cloudColor,cloud*.75);
          float sun=max(0.,dot(d,sunDir));c+=vec3(1.,.68,.32)*(pow(sun,500.)*.8+pow(sun,24.)*.12);
          float moon=max(0.,dot(d,-sunDir));c+=vec3(.62,.75,1.)*pow(moon,1800.)*night;
          vec2 stars=floor(d.xz/max(.08,d.y)*340.);float star=step(.997,hash(stars))*pow(max(0.,d.y),.5)*night;
          c+=vec3(star)*(.55+.45*sin(uTime*.8+hash(stars)*6.28));
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder=-10;
    scene.add(this.sky);
    this.hemisphere=new THREE.HemisphereLight(A.SKY_TOP,A.GROUND_LIGHT,A.HEMISPHERE);scene.add(this.hemisphere);

    this.buildHorizon();

    // Bushes mark the hide spots; translucent so Jimothy reads through them.
    const bushGeo = new THREE.SphereGeometry(HIDE_SPOTS.RADIUS, 12, 8);
    const bushMat = new THREE.MeshStandardMaterial({
      color: COLORS.BUSH,
      transparent: true,
      opacity: 0.75,
    });
    this.bushes=[];this.bushBatches=new InstanceBatches(scene,HIDE_SPOTS.POSITIONS.length);
    for (const [x, z] of HIDE_SPOTS.POSITIONS) {
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.scale.y = STREET.BUSH_HEIGHT;
      // On the hillside it stands on, not at a height that used to mean grade.
      const ground = voxels ? voxels.terrainHeightAt(x, z) : 0;
      bush.position.set(x, ground + HIDE_SPOTS.RADIUS * STREET.BUSH_BURIED, z);
      scene.add(bush);
      this.bushes.push({id:`bush-${this.bushes.length}`,mesh:bush,origin:bush.position.clone(),x,z,size:HIDE_SPOTS.RADIUS*2,kind:'bush',half:[HIDE_SPOTS.RADIUS,HIDE_SPOTS.RADIUS*STREET.BUSH_HEIGHT,HIDE_SPOTS.RADIUS],mass:STREET.BUSH_MASS,loose:false,attached:false});
    }

    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.bushes.find(p=>p.id===id);if(p){p.attached=true;if(p.loose)eventBus.emit(Events.PROP_SUSPEND,{id});gameState.world.disabledHideSpots.add(`${p.x},${p.z}`);}});
    eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.bushes.find(p=>p.id===id);if(p){p.attached=false;p.mesh.position.set(position.x,ground+p.half[1],position.z);if(!p.loose){p.loose=true;eventBus.emit(Events.PROP_CREATE,p);}else eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
    eventBus.on(Events.WORLD_IMPACT,({x,y,z,radius})=>{for(const p of this.bushes){if(p.attached||p.mesh.position.distanceTo(new THREE.Vector3(x,y,z))>radius+p.size/2)continue;gameState.world.disabledHideSpots.add(`${p.x},${p.z}`);if(!p.loose){p.loose=true;eventBus.emit(Events.PROP_CREATE,p);}const dx=p.mesh.position.x-x,dz=p.mesh.position.z-z,d=Math.hypot(dx,dz)||1;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[dx/d*STREET.IMPULSE,STREET.LIFT,dz/d*STREET.IMPULSE],spin:STREET.SPIN});}});
    this.wallMat = new THREE.MeshStandardMaterial({ color: COLORS.WALL });
    this.walls = [];
    this.buildWalls();

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'WORLD' && key === 'BOUNDS') this.buildWalls();
    });
  }

  /** The whole island, once, at low resolution.
   *
   *  A coarse island cannot represent street cuts or player craters. A small
   *  column mask hides it wherever real voxel geometry has been built (M28).
   *
   *  One draw call for 2 km of island. Adding one more ring of voxel columns to
   *  see 35 m further costs far more than this does to see all of it (JIM-34). */
  buildHorizon() {
    const B = Terrain.BOUNDS;
    const step = HORIZON.STEP;
    const n = Math.floor((B * 2) / step) + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -B + i * step;
        const z = -B + j * step;
        const h = Terrain.surfaceHeight(x, z);
        const k = (j * n + i) * 3;
        pos[k] = x;
        pos[k + 1] = h - HORIZON.DROP;
        pos[k + 2] = z;
        // Roads read from the air — it is most of what makes a district legible
        // from up there — and the shoreline needs to be sand rather than a hard
        // green-to-blue edge.
        if (h < TERRAIN.SEA_LEVEL) c.setHex(HORIZON.DEEP);
        else if (h < TERRAIN.SEA_LEVEL + 1.6) c.setHex(HORIZON.SAND);
        else c.setHex(Masterplan.isRoad(x, z) ? HORIZON.ROAD : HORIZON.LAND);
        // A touch of height shading, so hills have relief at a distance the
        // directional sun cannot give a mesh this coarse.
        const lift = 1 + Math.max(0, h) * 0.004;
        col[k] = Math.min(1, c.r * lift);
        col[k + 1] = Math.min(1, c.g * lift);
        col[k + 2] = Math.min(1, c.b * lift);
      }
    }
    const index = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        index.push(a, a + n, a + n + 1, a, a + n + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    this.horizon = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    );
    const columnSize=VOXEL.SIZE*VOXEL.CHUNK_XZ,origin=Math.floor(-B/columnSize),size=Math.floor(B/columnSize)-origin+1;
    const data=new Uint8Array(size*size),texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
    this.horizonCoverage={origin,size,columnSize,data,texture,key:null};
    this.horizon.material.onBeforeCompile=shader=>{
      shader.uniforms.columnCoverage={value:texture};
      shader.uniforms.coverageGrid={value:new THREE.Vector3(origin,size,columnSize)};
      shader.vertexShader='varying vec2 horizonXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhorizonXZ=position.xz;');
      shader.fragmentShader='varying vec2 horizonXZ;uniform sampler2D columnCoverage;uniform vec3 coverageGrid;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        vec2 coverageUV=(floor(horizonXZ/coverageGrid.z)-coverageGrid.x+.5)/coverageGrid.y;
        if(all(greaterThanEqual(coverageUV,vec2(0.)))&&all(lessThan(coverageUV,vec2(1.)))&&texture2D(columnCoverage,coverageUV).r>.5)discard;`);
    };
    this.horizon.material.customProgramCacheKey=()=> 'horizon-column-coverage';
    this.updateHorizonCoverage();
    this.horizon.renderOrder = -1;
    this.scene.add(this.horizon);
  }

  updateHorizonCoverage(){
    if(!this.voxels)return;
    const coverage=this.horizonCoverage;
    // Keep coverage while replacement geometry is pending. Otherwise the coarse
    // island rises through intact streets whenever a nearby chunk is dirty.
    const ready=[...this.voxels.generated].filter(key=>coverage.ready?.has(key)||[...(this.voxels.columnChunks.get(key)||[])].every(k=>this.voxels.chunks.get(k)?.meshed));
    coverage.ready=new Set(ready);
    const key=ready.join(';');if(key===coverage.key)return;
    coverage.key=key;coverage.data.fill(0);
    for(const column of ready){
      const [x,z]=column.split(',').map(Number),i=x-coverage.origin,j=z-coverage.origin;
      if(i>=0&&j>=0&&i<coverage.size&&j<coverage.size)coverage.data[j*coverage.size+i]=255;
    }
    coverage.texture.needsUpdate=true;
  }

  registerEntities(){for(const p of this.bushes)eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:p.kind,size:p.size});}
  resetObjects(){
    this.bushBatches.clear();
    for(const p of this.bushes){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});if(p.loose)eventBus.emit(Events.PROP_REMOVE,{id:p.id});this.scene.add(p.mesh);p.mesh.position.copy(p.origin);p.mesh.quaternion.identity();p.attached=false;p.loose=false;}
    this.registerEntities();
  }

  update(delta, camera) {
    this.updateHorizonCoverage();
    this.bushBatches.update(this.bushes.map(p=>({key:'bush',root:p.mesh})));
    this.time += delta;
    this.atmosphereTime.value = this.time;
    this.sky.position.copy(camera.position);
  }

  buildWalls() {
    for (const wall of this.walls) {
      this.scene.remove(wall);
      wall.geometry.dispose();
    }
    this.walls = [];
    const B = WORLD.BOUNDS;
    const t = 1;
    for (const [x, z, sx, sz] of [
      [0, -B - t, B + t * 2, t], [0, B + t, B + t * 2, t],
      [-B - t, 0, t, B + t * 2], [B + t, 0, t, B + t * 2],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx * 2, 1.2, sz * 2), this.wallMat);
      wall.position.set(x, 0.6, z);
      this.scene.add(wall);
      this.walls.push(wall);
    }
  }
}
