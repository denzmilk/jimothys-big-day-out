import {test,expect} from '@playwright/test';
import {TrafficFlow} from '../src/core/TrafficFlow.js';
import {buildTrafficRoutes} from '../src/level/TrafficRoutes.js';
import * as City from '../src/level/CityPlanner.js';

test('each controlled junction has a visible pavement signal for every approach',()=>{
 const routes=buildTrafficRoutes(),j=routes.junctions.get('2:3:3');
 expect(routes.signals.filter(s=>s.junction===j.id).length).toBe(j.incoming.length);
 for(const junction of routes.junctions.values()){
  const heads=routes.signals.filter(s=>s.junction===junction.id);
  if(!heads.length)expect(new TrafficFlow(routes,()=>true).signal(junction,0)).toBe('yield');
  if(heads.length)expect(heads.length,junction.id).toBe(junction.incoming.length);
  for(const head of heads)expect(City.classAt(head.x,head.z),head.id).toBe(City.CLASS.FOOTPATH);
 }
});
