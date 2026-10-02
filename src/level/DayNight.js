import * as THREE from 'three';
import {DAY_NIGHT as C,SEWER} from '../core/Constants.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';
export class DayNight {
 constructor(scene,renderer,level,sun,ambient,jimothy){
  this.scene=scene;this.renderer=renderer;this.level=level;this.sun=sun;this.ambient=ambient;this.jimothy=jimothy;
  this.hour=C.START_HOUR;this.shadowClock=C.SHADOW_INTERVAL;this.direction=new THREE.Vector3();this.color=new THREE.Color();
  this.moon=new THREE.DirectionalLight(C.MOON_COLOR,C.MOON_INTENSITY);scene.add(this.moon,this.moon.target,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.setScalar(C.SHADOW_SIZE);sun.shadow.camera.left=sun.shadow.camera.bottom=-C.SHADOW_RADIUS;sun.shadow.camera.right=sun.shadow.camera.top=C.SHADOW_RADIUS;
  sun.shadow.camera.near=C.SHADOW_NEAR;sun.shadow.camera.far=C.SHADOW_FAR;sun.shadow.bias=C.SHADOW_BIAS;sun.shadow.normalBias=C.SHADOW_NORMAL_BIAS;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  eventBus.on(Events.DEV_SET_TIME,({hour})=>this.setHour(hour));this.update(0,false);
 }
 setHour(hour){this.hour=((hour%24)+24)%24;this.shadowClock=C.SHADOW_INTERVAL;}
 update(dt,underground){
  if(gameState.game.isPlaying)this.hour=(this.hour+dt*24/C.PERIOD)%24;
  const angle=(this.hour-6)/24*Math.PI*2,elevation=Math.sin(angle),day=THREE.MathUtils.smoothstep(elevation,C.TWILIGHT_LOW,C.TWILIGHT_HIGH),high=THREE.MathUtils.smoothstep(elevation,0,C.NOON_BLEND);
  this.direction.set(Math.cos(angle),elevation,C.SUN_AZIMUTH).normalize();const j=this.jimothy.group.position;
  this.sun.position.copy(j).addScaledVector(this.direction,C.LIGHT_DISTANCE);this.sun.target.position.copy(j);
  this.moon.position.copy(j).addScaledVector(this.direction,-C.LIGHT_DISTANCE);this.moon.target.position.copy(j);
  this.sun.color.set(C.SUNSET_COLOR).lerp(this.color.set(C.NOON_COLOR),high);this.sun.intensity=underground?C.UNDERGROUND_SUN:C.SUN_INTENSITY*day;
  this.moon.intensity=underground?0:C.MOON_INTENSITY*(1-day);
  this.ambient.color.set(C.AMBIENT_NIGHT).lerp(this.color.set(C.AMBIENT_DAY),day);this.ambient.intensity=underground?C.UNDERGROUND_AMBIENT:THREE.MathUtils.lerp(C.AMBIENT_MIN,C.AMBIENT_MAX,day);
  this.level.hemisphere.intensity=underground?0:THREE.MathUtils.lerp(C.HEMI_MIN,C.HEMI_MAX,day);
  const u=this.level.sky.material.uniforms;
  u.sunDir.value.copy(this.direction);u.topColor.value.set(C.NIGHT_TOP).lerp(this.color.set(C.DAY_TOP),day);
  u.horizonColor.value.set(C.NIGHT_HORIZON).lerp(this.color.set(C.SUNSET_HORIZON).lerp(new THREE.Color(C.DAY_HORIZON),high),day);
  u.cloudColor.value.set(C.NIGHT_CLOUD).lerp(this.color.set(C.DAY_CLOUD),day);u.night.value=1-day;
  this.renderer.toneMappingExposure=underground?C.UNDERGROUND_EXPOSURE:THREE.MathUtils.lerp(C.NIGHT_EXPOSURE,C.DAY_EXPOSURE,day);
  this.scene.environmentIntensity=underground?C.UNDERGROUND_ENV:THREE.MathUtils.lerp(C.NIGHT_ENV,C.DAY_ENV,day);
  this.scene.fog.color.copy(underground?this.color.set(SEWER.FOG_COLOR):u.horizonColor.value);
  this.scene.background.copy(underground?this.color.set(SEWER.FOG_COLOR):u.horizonColor.value);
  this.shadowClock+=dt;if(this.shadowClock>=C.SHADOW_INTERVAL){this.renderer.shadowMap.needsUpdate=true;this.shadowClock=0;}
  gameState.world.hour=this.hour;gameState.world.daylight=day;
  this.daylight=day;
 }
 reset(){this.setHour(C.START_HOUR);}
 snapshot(){return {hour:+this.hour.toFixed(4),daylight:+this.daylight.toFixed(3),sun:this.sun.intensity,moon:this.moon.intensity,period:C.PERIOD};}
}
