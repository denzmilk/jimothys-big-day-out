import {RADAR as C, SEWER, HEAT} from '../core/Constants.js';
import {eventBus, Events} from '../core/EventBus.js';
import {SightSampler} from '../core/Perception.js';
import {gameState} from '../core/GameState.js';
import * as Plan from '../level/CityPlanner.js';

export class Minimap {
  constructor() {
    this.panel=document.getElementById('tactical-radar');this.canvas=this.panel.querySelector('canvas');
    this.canvas.width=this.canvas.height=C.SIZE*C.PIXEL_RATIO;
    this.ctx=this.canvas.getContext('2d');this.ctx.scale(C.PIXEL_RATIO,C.PIXEL_RATIO);
    this.background=document.createElement('canvas');this.background.width=this.background.height=C.SIZE*C.PIXEL_RATIO;
    this.sights=new SightSampler();
    eventBus.on(Events.WORLD_DEMOLISHED,()=>this.sights.invalidate());
    eventBus.on(Events.WORLD_OCCLUSION_CHANGED,()=>this.sights.invalidate());
    this.status=document.getElementById('radar-status');this.scale=this.panel.querySelector('#radar-scale');this.reset();
    eventBus.on(Events.GAME_RESTART,()=>this.reset());
  }

  reset(){this.sights.reset();this.elapsed=C.INTERVAL;this.cache=null;this.data={contacts:[],waypoint:null,draws:0};this.ctx.clearRect(0,0,C.SIZE,C.SIZE);}

  rebuild(player,range,layer) {
    const half=range*C.CACHE_MARGIN,step=half*2/C.GRID,ctx=this.background.getContext('2d'),size=this.background.width;
    this.cache={x:player.x,z:player.z,half,range,layer};this.data.terrainSamples=0;this.data.buildings=0;this.data.tunnelSegments=0;
    ctx.clearRect(0,0,size,size);
    const pixel=(x,z)=>[(x-player.x+half)/(2*half)*size,(z-player.z+half)/(2*half)*size];
    if(layer==='underground'){
      ctx.fillStyle=C.UNDERGROUND;ctx.fillRect(0,0,size,size);ctx.strokeStyle=C.TUNNEL;ctx.lineWidth=SEWER.WIDTH/(half*2)*size;ctx.lineCap='round';
      // Only this local window is queried; the entire sewer graph is never
      // rescanned per frame and the map cannot force voxel generation.
      for(const n of Plan.sewerNodesIn(player.x-half,player.z-half,player.x+half,player.z+half))for(const [dx,dz]of n.links){ctx.beginPath();ctx.moveTo(...pixel(n.x,n.z));ctx.lineTo(...pixel(n.x+dx,n.z+dz));ctx.stroke();this.data.tunnelSegments++;}
    }else{
      for(let z=0;z<C.GRID;z++)for(let x=0;x<C.GRID;x++){
        ctx.fillStyle=C.MAP_COLORS[Plan.classAt(player.x-half+(x+.5)*step,player.z-half+(z+.5)*step)];
        ctx.fillRect(x/C.GRID*size,z/C.GRID*size,size/C.GRID+1,size/C.GRID+1);this.data.terrainSamples++;
      }
      ctx.fillStyle=C.BUILDING;ctx.strokeStyle=C.BUILDING_EDGE;
      for(const b of Plan.buildingsIn(player.x-half,player.z-half,player.x+half,player.z+half)){
        const [x,z]=pixel(b.x,b.z),w=b.w/(half*2)*size,d=b.d/(half*2)*size;ctx.fillRect(x,z,w,d);ctx.strokeRect(x,z,w,d);this.data.buildings++;
      }
    }
  }

  update(delta,player){
    this.sights.process();
    this.panel.hidden=!gameState.game.isPlaying;
    this.elapsed+=delta;if(this.elapsed<C.INTERVAL)return;this.elapsed%=C.INTERVAL;
    const range=Math.min(C.MAX_RANGE,Math.max(C.RANGE,player.radius*C.BODY_RANGE_GAIN));
    const layer=player.underground?'underground':'surface';
    if(!this.cache||this.cache.layer!==layer||Math.abs(this.cache.range-range)>C.RANGE_EPSILON||Math.hypot(player.x-this.cache.x,player.z-this.cache.z)>C.RECENTER)this.rebuild(player,range,layer);
    this.sights.begin();
    const packet={player,range,contacts:[],waypoint:null,sampleSight:(id,args)=>this.sights.request(id,args)};eventBus.emit(Events.TACTICAL_QUERY,packet);
    this.sights.end();
    this.data={...this.data,layer,range,heading:player.yaw,player:{x:player.x,z:player.z},contacts:packet.contacts.slice(0,C.MAX_CONTACTS),waypoint:packet.waypoint,draws:this.data.draws+1};
    this.draw(player);
  }

  draw(player){
    const ctx=this.ctx,size=C.SIZE,half=size/2,scale=half/this.data.range,cache=this.cache;
    const point=p=>[half+(p.x-player.x)*scale,half+(p.z-player.z)*scale];
    ctx.clearRect(0,0,size,size);ctx.save();ctx.beginPath();ctx.arc(half,half,half,0,Math.PI*2);ctx.clip();
    ctx.drawImage(this.background,half+(cache.x-player.x-cache.half)*scale,half+(cache.z-player.z-cache.half)*scale,cache.half*2*scale,cache.half*2*scale);
    ctx.strokeStyle=C.GRID_COLOR;ctx.lineWidth=C.LINE;ctx.beginPath();ctx.moveTo(half,0);ctx.lineTo(half,size);ctx.moveTo(0,half);ctx.lineTo(size,half);ctx.stroke();
    const circle=(p,r,color,dashed=false)=>{const [x,z]=point(p);ctx.beginPath();ctx.arc(x,z,r*scale,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=C.SEARCH_ALPHA;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.setLineDash(dashed?[C.MARKER,C.MARKER]:[]);ctx.stroke();ctx.setLineDash([]);};
    for(const p of this.data.contacts){
      const color=p.state==='chase'?C.CHASE:p.state==='noticing'?C.NOTICE:p.state==='patrol'?C.PATROL:C.SEARCH;
      if(p.search)circle(p.search,p.search.radius,C.SEARCH,true);
      if(p.strike)circle(p.strike,p.strike.radius,C.STRIKE);
      const [x,z]=point(p);
      for(const fan of [p.sight,p.nearSight])if(fan?.length){ctx.beginPath();ctx.moveTo(x,z);for(const v of fan)ctx.lineTo(...point(v));ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=C.CONE_ALPHA;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.stroke();}
      ctx.fillStyle=p.kind==='jet'||p.kind==='shell'?C.STRIKE:color;ctx.strokeStyle=C.UNDERGROUND;ctx.beginPath();
      if(p.kind==='animal-control'){ctx.rect(x-C.MARKER,z-C.MARKER,C.MARKER*2,C.MARKER*2);}
      else if(p.kind==='tank'||p.kind==='jet'||p.kind==='shell'){ctx.moveTo(x,z-C.MARKER*1.5);ctx.lineTo(x+C.MARKER*1.5,z);ctx.lineTo(x,z+C.MARKER*1.5);ctx.lineTo(x-C.MARKER*1.5,z);ctx.closePath();}
      else ctx.arc(x,z,C.MARKER,0,Math.PI*2);
      ctx.fill();ctx.stroke();
      if(p.state==='noticing'){ctx.beginPath();ctx.arc(x,z,C.MARKER*2,-Math.PI/2,-Math.PI/2+p.awareness*Math.PI*2);ctx.strokeStyle=C.NOTICE;ctx.lineWidth=C.LINE*2;ctx.stroke();ctx.lineWidth=C.LINE;}
    }
    if(this.data.waypoint){
      const [x,z]=point(this.data.waypoint),dx=x-half,dz=z-half,distance=Math.hypot(dx,dz),limit=half-C.PLAYER_SIZE;
      // A rectangular clamp would hide diagonal destinations outside the round map.
      const fraction=distance>limit?limit/distance:1;
      ctx.fillStyle=C.WAYPOINT;ctx.beginPath();ctx.arc(half+dx*fraction,half+dz*fraction,C.MARKER,0,Math.PI*2);ctx.fill();
    }
    ctx.translate(half,half);ctx.rotate(-player.yaw);ctx.beginPath();ctx.moveTo(0,C.PLAYER_SIZE);ctx.lineTo(-C.PLAYER_SIZE,-C.PLAYER_SIZE);ctx.lineTo(0,-C.PLAYER_SIZE/2);ctx.lineTo(C.PLAYER_SIZE,-C.PLAYER_SIZE);ctx.closePath();ctx.fillStyle=C.PLAYER;ctx.fill();ctx.strokeStyle=C.UNDERGROUND;ctx.stroke();ctx.restore();
    this.scale.textContent=`${this.data.layer==='underground'?'SEWER · ':''}${Math.round(this.data.range)} m`;
    const contacts=this.data.contacts,notice=contacts.find(p=>p.state==='noticing'),search=contacts.filter(p=>p.search);
    const label=contacts.some(p=>p.state==='chase')?'SPOTTED · BREAK SIGHT':notice?`BEING NOTICED · ${Math.round(notice.awareness*100)}%`:search.length?`${search.some(p=>p.state==='search')?'SEARCHING':'INVESTIGATING'} · ${Math.ceil(Math.max(...search.map(p=>p.searchRemaining)))}s`:contacts.some(p=>p.strike)?'STRIKE ZONE · KEEP MOVING':'NO VISUAL CONTACT';
    const h=gameState.heat,pending=h.target>h.tier&&!gameState.player.hidden;
    this.status.textContent=pending?`${label} · WANTED RISING ${Math.ceil(HEAT.HIGH_TIER_DELAY-h.escalation)}s`:label;this.status.dataset.state=contacts.some(p=>p.state==='chase')?'chase':notice?'noticing':search.length?'search':'clear';
    this.panel.setAttribute('aria-label',this.data.layer==='underground'?'Sewer search radar':'Enemy search radar');
  }

  snapshot(){return {...this.data,sightJobs:[...this.sights.entries.values()].filter(e=>e.job).length,sightRays:this.sights.lastRays};}
}
