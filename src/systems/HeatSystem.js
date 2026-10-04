import { HEAT as C, VOXEL } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class HeatSystem {
  constructor(){
    this.reset();eventBus.on(Events.GAME_RESTART,()=>this.reset());
    eventBus.on(Events.CAN_TIPPED,()=>this.minor(C.PER_CAN_TIPPED));
    eventBus.on(Events.TOOL_CHAOS,({points})=>this.minor(points,true));
    eventBus.on(Events.LOCAL_SCARED,({id})=>{
      if(!gameState.game.isPlaying)return;
      if((this.scared.get(id)||0)>this.clock)return;
      if(this.scared.size>=C.SCARE_MEMORY)this.scared.delete(this.scared.keys().next().value);
      this.scared.set(id,this.clock+C.SCARE_REPEAT_SECONDS);this.minor(C.PER_SCARED_LOCAL);
    });
    eventBus.on(Events.WORLD_DEMOLISHED,({voxels,groundOnly=false,groundVoxels=0,instigator})=>{
      if(!gameState.game.isPlaying||instigator!=='player')return;
      const h=gameState.heat,ground=Math.max(0,Math.min(voxels,groundOnly?voxels:groundVoxels))*VOXEL.SIZE**3,structure=Math.max(0,voxels*VOXEL.SIZE**3-ground);
      h.groundVolume+=ground;h.structureVolume+=structure;
      h.points+=ground*C.PER_GROUND_DEMOLITION+structure*C.PER_DEMOLITION;this._retier();
    });
    eventBus.on(Events.PROPERTY_DESTROYED,({kind,instigator})=>{
      if(!gameState.game.isPlaying||instigator!=='player'||kind!=='car')return;
      gameState.heat.cars++;gameState.heat.points+=C.PER_CAR_WRECK;this._retier();
    });
  }
  reset(){this.clock=0;this.scared=new Map();this.toolBudget=C.TOOL_NUISANCE_BURST;}
  minor(points,metered=false){
    if(!gameState.game.isPlaying||!Number.isFinite(points)||points<=0)return;
    const h=gameState.heat,credit=Math.max(0,Math.min(points,C.NUISANCE_CAP-h.nuisance,metered?this.toolBudget:Infinity));
    if(metered)this.toolBudget-=credit;h.nuisance+=credit;h.points+=credit;this._retier();
  }
  _retier(dt=0){
    const h=gameState.heat,previous=h.tier;let target=0;
    while(target<C.MAX_TIER&&h.points>=C.TIER_THRESHOLDS[target+1])target++;
    h.target=target;
    // Early attention is immediate; a large damage batch must not dispatch
    // the entire response ladder in the same event callback (M58/JIM-35).
    if(target<=h.tier||target<C.HIGH_TIER){h.tier=target;h.escalation=0;}
    else{
      h.tier=Math.max(h.tier,Math.min(target,C.HIGH_TIER-1));
      if(gameState.player.hidden)h.escalation=0;
      else{
        h.escalation+=dt;
        while(h.tier<target&&h.escalation>=C.HIGH_TIER_DELAY){h.escalation-=C.HIGH_TIER_DELAY;h.tier++;}
        if(h.tier===target)h.escalation=0;
      }
    }
    if(h.tier!==previous)eventBus.emit(Events.HEAT_CHANGED,{points:h.points,tier:h.tier});
  }
  update(dt){
    if(!gameState.game.isPlaying)return;
    this.clock+=dt;this.toolBudget=Math.min(C.TOOL_NUISANCE_BURST,this.toolBudget+dt*C.TOOL_NUISANCE_RATE);
    for(const [id,until]of this.scared)if(until<=this.clock)this.scared.delete(id);
    const h=gameState.heat;
    if(gameState.player.hidden&&h.points>0){
      h.points=Math.max(0,h.points-Math.max(C.DECAY_PER_SECOND_HIDDEN,h.points*C.HIDDEN_DECAY_FRACTION)*dt);h.nuisance=Math.min(h.nuisance,h.points);
    }
    this._retier(dt);
  }
}
