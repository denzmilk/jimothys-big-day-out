import * as THREE from 'three';
import {CAR_EXPLOSION as C,STREET} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';

export class CarExplosions {
  constructor(scene,camera){
    this.camera=camera;this.bursts=[];this.total=0;
    const pixels=new Uint8Array(C.TEXTURE_SIZE*C.TEXTURE_SIZE*4);
    for(let y=0;y<C.TEXTURE_SIZE;y++)for(let x=0;x<C.TEXTURE_SIZE;x++){
      const r=Math.hypot((x+.5)/C.TEXTURE_SIZE*2-1,(y+.5)/C.TEXTURE_SIZE*2-1),i=(x+y*C.TEXTURE_SIZE)*4;
      pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r*r)**2);
    }
    this.texture=new THREE.DataTexture(pixels,C.TEXTURE_SIZE,C.TEXTURE_SIZE);this.texture.needsUpdate=true;
    this.layers={};
    for(const [name,count,color,additive] of [['fire',C.FIRE_COUNT,C.FIRE_COLOR,true],['smoke',C.SMOKE_COUNT,C.SMOKE_COLOR,false],['sparks',C.SPARK_COUNT,C.SPARK_COLOR,true]]){
      const geometry=new THREE.PlaneGeometry(1,1),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count*C.MAX),1);
      geometry.setAttribute('particleAlpha',alpha);
      const material=new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
      material.onBeforeCompile=shader=>{
        shader.vertexShader='attribute float particleAlpha; varying float vParticleAlpha;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');
        shader.fragmentShader='varying float vParticleAlpha;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vParticleAlpha;');
      };
      const mesh=new THREE.InstancedMesh(geometry,material,count*C.MAX);mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=additive?2:1;
      for(let i=0;i<count*C.MAX;i++)mesh.setColorAt(i,new THREE.Color(color));
      scene.add(mesh);this.layers[name]={mesh,alpha,count,color:new THREE.Color(color)};
    }
    this.light=new THREE.PointLight(C.FIRE_COLOR,0,C.LIGHT_DISTANCE);this.light.visible=false;scene.add(this.light);
    this.dummy=new THREE.Object3D();this.rotation=new THREE.Quaternion();this.color=new THREE.Color();
    eventBus.on(Events.CAR_EXPLODED,e=>this.spawn(e));
  }
  spawn({x,y,z,radius}){
    if(this.bursts.length>=C.MAX)this.bursts.shift();
    this.bursts.push({x,y:y+C.HEIGHT,z,age:0,power:Math.min(C.POWER_CAP,Math.max(1,radius/STREET.CAR.EXPLODE_RADIUS))});
    this.total++;this.update(0);
  }
  update(dt){
    for(const b of this.bursts)b.age+=dt;
    this.bursts=this.bursts.filter(b=>b.age<C.SMOKE_LIFE);
    this.camera.getWorldQuaternion(this.rotation);
    for(const [name,layer] of Object.entries(this.layers)){
      let index=0;
      for(const b of this.bursts){
        const life=name==='fire'?C.FIRE_LIFE:name==='smoke'?C.SMOKE_LIFE:C.SPARK_LIFE,t=b.age/life;
        if(t>=1)continue;
        for(let i=0;i<layer.count;i++){
          const f=(i+.5)/layer.count,angle=i*Math.PI*(3-Math.sqrt(5)),age=b.age;
          let spread,size,rise,opacity;
          if(name==='fire'){
            spread=C.FIRE_SPREAD*(C.FIRE_START+t)*Math.sqrt(f);rise=spread*f;
            size=C.FIRE_SIZE*(C.FIRE_START+Math.sin(t*Math.PI))*(1-f/2);opacity=(1-t)**2;
            this.color.copy(layer.color).lerp(new THREE.Color(C.CORE_COLOR),(1-t)*(1-f));
          }else if(name==='smoke'){
            spread=C.SMOKE_DRIFT*age*Math.sqrt(f);rise=C.SMOKE_RISE*age*(1+f/2);
            size=C.SMOKE_SIZE+C.SMOKE_GROWTH*age;opacity=C.SMOKE_OPACITY*(1-t)*Math.min(1,C.FIRE_START+t*layer.count);
            this.color.copy(layer.color);
          }else{
            spread=C.SPARK_SPEED*age*Math.sqrt(f);rise=C.SPARK_LIFT*age*(1+f)-C.SPARK_GRAVITY*age*age/2;
            size=C.SPARK_SIZE;opacity=1-t;this.color.copy(layer.color);
          }
          this.dummy.position.set(b.x+Math.cos(angle)*spread*b.power,b.y+rise*b.power,b.z+Math.sin(angle)*spread*b.power);
          this.dummy.quaternion.copy(this.rotation);this.dummy.scale.setScalar(size*b.power);this.dummy.updateMatrix();
          layer.mesh.setMatrixAt(index,this.dummy.matrix);layer.mesh.setColorAt(index,this.color);layer.alpha.setX(index,opacity);index++;
        }
      }
      layer.mesh.count=index;layer.mesh.instanceMatrix.needsUpdate=true;layer.mesh.instanceColor.needsUpdate=true;layer.alpha.needsUpdate=true;
    }
    // One unshadowed flash keeps a crowded chain of explosions bounded.
    const flash=this.bursts.findLast(b=>b.age<C.FIRE_LIFE);
    this.light.visible=!!flash;
    if(flash){this.light.position.set(flash.x,flash.y,flash.z);this.light.intensity=C.LIGHT_INTENSITY*(1-flash.age/C.FIRE_LIFE)**2;}
  }
  reset(){this.bursts=[];this.total=0;this.update(0);}
  snapshot(){return {active:this.bursts.length,total:this.total,fire:this.layers.fire.mesh.count,smoke:this.layers.smoke.mesh.count,sparks:this.layers.sparks.mesh.count};}
}
