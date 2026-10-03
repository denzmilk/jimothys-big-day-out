import * as THREE from 'three';

// JIM-48: collection rays must not inspect every triangle for every object.
// The topology is stable across growth; only the bounds need refitting.
export class TriangleIndex {
 constructor(geometry,leafSize){
  this.geometry=geometry;this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.c=new THREE.Vector3();this.point=new THREE.Vector3();
  const count=(geometry.index?.count??geometry.attributes.position.count)/3;
  const centers=Array.from({length:count},(_,i)=>{this.vertices(i);return this.a.clone().add(this.b).add(this.c).multiplyScalar(1/3);});
  const build=ids=>{
   const node={box:new THREE.Box3()};
   if(ids.length<=leafSize)node.ids=ids;
   else{
    const box=new THREE.Box3();for(const i of ids)box.expandByPoint(centers[i]);
    const extent=box.getSize(new THREE.Vector3()),axis=extent.x>=extent.y&&extent.x>=extent.z?'x':extent.y>=extent.z?'y':'z';
    ids.sort((a,b)=>centers[a][axis]-centers[b][axis]);const half=Math.floor(ids.length/2);
    node.left=build(ids.slice(0,half));node.right=build(ids.slice(half));
   }return node;
  };
  this.root=build(Array.from({length:count},(_,i)=>i));this.refit();
 }
 ids(i){const index=this.geometry.index;return index?[index.getX(i*3),index.getX(i*3+1),index.getX(i*3+2)]:[i*3,i*3+1,i*3+2];}
 vertices(i){const ids=this.ids(i),p=this.geometry.attributes.position;this.a.fromBufferAttribute(p,ids[0]);this.b.fromBufferAttribute(p,ids[1]);this.c.fromBufferAttribute(p,ids[2]);return ids;}
 refit(){
  const visit=node=>{node.box.makeEmpty();if(node.ids){for(const i of node.ids){this.vertices(i);node.box.expandByPoint(this.a).expandByPoint(this.b).expandByPoint(this.c);}}
   else{visit(node.left);visit(node.right);node.box.union(node.left.box).union(node.right.box);}};visit(this.root);
 }
 intersect(ray){
  let closest=null,distance=Infinity;const stack=[this.root];this.visited=0;
  while(stack.length){const node=stack.pop();if(!ray.intersectsBox(node.box))continue;
   if(!node.ids){stack.push(node.right,node.left);continue;}
   for(const i of node.ids){const ids=this.vertices(i);this.visited++;if(!ray.intersectTriangle(this.a,this.b,this.c,false,this.point))continue;
    const d=ray.origin.distanceToSquared(this.point);if(d>=distance)continue;distance=d;closest={ids,point:this.point.clone()};
   }
  }return closest;
 }
}
