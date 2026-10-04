import {chromium} from 'playwright';import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
try{const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_RIG__=true;window.__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 await page.waitForFunction(()=>window.__game?.streetLife.ready&&__game.pedestrians.ready&&__game.interiors.ready);await page.evaluate(()=>{advanceTime(.1);window.__STATE_ONLY_TEST__=true;});
 const result=await page.evaluate(()=>{const g=__game,w=g.voxels,records=[],seen=new WeakSet(),queue=w.queueSupport.bind(w);let now=0;
 w.queueSupport=(bounds,key)=>{const accepted=queue(bounds,key);if(accepted){const job=w.damageQueue.find(j=>j.kind==='support'&&j.key===key);if(seen.has(job))return accepted;seen.add(job);const task=job.task,row={key,bounds:job.bounds||bounds,start:now,slices:0,ms:0,maxMs:0};records.push(row);job.task={next(){const t=performance.now(),r=task.next(),ms=performance.now()-t;row.slices++;row.ms+=ms;row.maxMs=Math.max(row.maxMs,ms);if(r.done)row.end=now;return r;}};}return accepted;};
 setFatness(250);teleportJimothy(-2,-40);faceJimothy(0);g.military.update=()=>{};advanceTime(.2);
 const snapshots=[];g.input.codes.add('KeyC');for(let i=0;i<66;i++){now+=1/60;g.update(1/60);}g.input.codes.delete('KeyC');
 for(let i=0;i<1200;i++){now+=1/60;g.update(1/60);if([179,359,719,1199].includes(i))snapshots.push({t:now,jobs:w.damageQueue.map(j=>({kind:j.kind,key:j.key})),support:g.structuralSupport?.snapshot(),voxels:w.stats()});}
 return{records,snapshots};});await fs.writeFile('output/iterate/giant-support-profile.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify({records:result.records,snapshots:result.snapshots.map(s=>({t:s.t,jobs:s.jobs,support:s.support})),errors}));
}finally{await browser.close();}
