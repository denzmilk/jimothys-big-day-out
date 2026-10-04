import{test,expect}from'@playwright/test';import{boot}from'./helpers.mjs';

test('occupied civilian cars cannot consume the two reserved patrol driver seats',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await boot(page);await page.waitForFunction(()=>__game.police.ready);
 const r=await page.evaluate(()=>{const g=__game,s=g.streetLife,d=g.driving;d.syncDrivers();
  // Traffic can retain an occupied stopped car while new cars enter the
  // streaming window. Keep that pressure instead of clearing civilian seats.
  for(let i=0;i<2;i++)s.spawn(`civilian-capacity-${i}`,'car',{x:15+i*12,z:2,seed:i,key:null},true);
  d.syncDrivers();const candidates=[...d.cars.values()].filter(p=>p.driving&&p.responseRole!=='police').length;
  g.police.spawn();g.police.spawn();d.syncDrivers();const ids=new Set(g.police.units.map(u=>u.car.id)),seats=[...d.drivers.keys()];return{candidates,patrols:ids.size,officers:g.pursuers.police.length,police:seats.filter(id=>ids.has(id)).length,civilians:seats.filter(id=>!ids.has(id)).length,total:seats.length};
 });console.log('POLICE_CAPACITY',JSON.stringify(r));expect(r.candidates).toBeGreaterThanOrEqual(10);expect(r.patrols).toBe(2);expect(r.police).toBe(2);expect(r.officers).toBe(2);expect(r.civilians).toBeLessThanOrEqual(8);expect(r.total).toBeLessThanOrEqual(10);expect(errors).toEqual([]);
});
