import fs from 'node:fs';
import {oceanSites,ruinPieces} from '../src/level/OceanLayout.js';

const layouts={};
for(const site of oceanSites())if(site.kind==='ruin'&&!layouts[site.family])layouts[site.family]=ruinPieces(site);
fs.writeFileSync(new URL('../assets/blender/ocean/ruin-layouts.json',import.meta.url),JSON.stringify(layouts,null,2)+'\n');
