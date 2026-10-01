import * as THREE from 'three';
import { WORLD, COLORS, HIDE_SPOTS, TERRAIN, HORIZON, ATMOSPHERE as A } from '../core/Constants.js';
import * as Terrain from './Terrain.js';
import * as Masterplan from './CityPlanner.js';
import { eventBus, Events } from '../core/EventBus.js';

// Static block dressing: the sea, hide-spot bushes, and the perimeter curbs
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
      uniforms: { ...common, cloudColor: {value:new THREE.Color(A.CLOUD)}, cloudSpeed:{value:A.CLOUD_SPEED}, cloudScale:{value:A.CLOUD_SCALE} },
      vertexShader: `varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 direction; uniform float uTime,cloudSpeed,cloudScale; uniform vec3 topColor,horizonColor,cloudColor,sunDir;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){vec3 d=normalize(direction);float height=max(0.,d.y);vec3 c=mix(horizonColor,topColor,pow(height,.45));
          vec2 p=d.xz/(height+.25)*cloudScale+vec2(uTime*cloudSpeed,0.);float n=noise(p)*.6+noise(p*2.1)*.3+noise(p*4.3)*.1;
          float cloud=smoothstep(.53,.72,n)*smoothstep(.02,.22,height);c=mix(c,cloudColor,cloud*.75);
          float sun=max(0.,dot(d,sunDir));c+=vec3(1.,.68,.32)*(pow(sun,500.)*.8+pow(sun,24.)*.12);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder=-10;
    scene.add(this.sky);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.BOUNDS * 4, WORLD.BOUNDS * 4, 128, 128),new THREE.ShaderMaterial({
      transparent:true, depthWrite:false,
      uniforms:{ ...common, deepColor:{value:new THREE.Color(A.WATER_DEEP)},shallowColor:{value:new THREE.Color(A.WATER_SHALLOW)}, highlightColor:{value:new THREE.Color(A.WATER_HIGHLIGHT)},waveSpeed:{value:A.WAVE_SPEED},waveScale:{value:A.WAVE_SCALE},waveHeight:{value:A.WAVE_HEIGHT} },
      vertexShader:`uniform float uTime,waveSpeed,waveScale,waveHeight;varying vec3 wp;void main(){vec4 p=modelMatrix*vec4(position,1.);p.y+=waveHeight*sin(p.x*waveScale+uTime*waveSpeed)*sin(p.z*waveScale*.7-uTime*waveSpeed);wp=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform float uTime,waveSpeed,waveScale;uniform vec3 deepColor,shallowColor,highlightColor,sunDir,topColor,horizonColor;varying vec3 wp;
      void main(){float t=uTime*waveSpeed;vec2 p=wp.xz*waveScale;vec3 n=normalize(vec3(cos(p.x*1.7+t)*.12+sin(p.y*2.4-t)*.08,1.,sin(p.y*1.8+t)*.14+cos(p.x*2.3+t)*.07));
      n=normalize(mix(vec3(0.,1.,0.),n,exp(-length(cameraPosition-wp)*.002)));vec3 view=normalize(cameraPosition-wp);float fres=pow(1.-max(dot(view,n),0.),3.);vec3 reflection=reflect(-view,n);vec3 sky=mix(horizonColor,topColor,max(0.,reflection.y));
      float glitter=pow(max(0.,dot(reflect(-sunDir,n),view)),90.);float pattern=sin(p.x*.31+p.y*.43+t*.3)*.5+.5;
      vec3 c=mix(deepColor,shallowColor,pattern*.28);c=mix(c,sky,fres*.7);c+=highlightColor*glitter*.8;gl_FragColor=vec4(c,.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    }));
    this.sea.rotation.x=-Math.PI/2;
    this.sea.position.y=TERRAIN.SEA_LEVEL;
    this.sea.renderOrder=1;
    scene.add(this.sea);
    scene.add(new THREE.HemisphereLight(A.SKY_TOP,A.GROUND_LIGHT,A.HEMISPHERE));

    this.buildHorizon();

    // Bushes mark the hide spots; translucent so Jimothy reads through them.
    const bushGeo = new THREE.SphereGeometry(HIDE_SPOTS.RADIUS, 12, 8);
    const bushMat = new THREE.MeshStandardMaterial({
      color: COLORS.BUSH,
      transparent: true,
      opacity: 0.75,
    });
    for (const [x, z] of HIDE_SPOTS.POSITIONS) {
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.scale.y = 0.7;
      // On the hillside it stands on, not at a height that used to mean grade.
      const ground = voxels ? voxels.terrainHeightAt(x, z) : 0;
      bush.position.set(x, ground + HIDE_SPOTS.RADIUS * 0.45, z);
      scene.add(bush);
    }

    this.wallMat = new THREE.MeshStandardMaterial({ color: COLORS.WALL });
    this.walls = [];
    this.buildWalls();

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'WORLD' && key === 'BOUNDS') this.buildWalls();
    });
  }

  /** The whole island, once, at low resolution.
   *
   *  Built from the SAME baked height field the voxels are generated from, so
   *  it cannot disagree with them about where a hill is — it is the same
   *  function sampled coarsely. Sits `HORIZON.DROP` below the true surface, so
   *  the real voxel ground always wins the depth test where it exists and this
   *  is only ever seen past the streaming boundary.
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
    this.horizon.renderOrder = -1;
    this.scene.add(this.horizon);
  }

  update(delta, camera) {
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
