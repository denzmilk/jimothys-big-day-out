import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FOOD_MODELS as C,SNACKS,FOODS} from './Constants.js';

export class FoodLibrary {
 constructor(){
  this.templates=new Map();this.ready=false;
  const names=[...SNACKS.NAMES,...FOODS.FEAST.NAMES],loader=new GLTFLoader();
  this.catalog=C.IDS.map((id,i)=>({id,name:names[i],type:i<SNACKS.NAMES.length?'scrap':'feast'}));
  this.loading=Promise.all(this.catalog.map(async f=>{
   const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/food/${f.id}.glb`);
   gltf.scene.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
   this.templates.set(f.id,gltf.scene);
  })).then(()=>{this.ready=true;});
 }
 get(id){return this.catalog.find(f=>f.id===id);}
 clone(id){return this.templates.get(id)?.clone(true);}
}
