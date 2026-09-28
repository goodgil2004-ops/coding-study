import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../dist/vendor/three.module.js';
import {deskItems,buildDeskItem,placeOnDesk} from '../dist/desk-items.js';
test('all desk items have nonempty finite geometry and unique saved types',()=>{
 assert.equal(new Set(deskItems.map(x=>x.type)).size,deskItems.length);
 for(const item of deskItems){
  const g=new THREE.Group();
  const add=(geo,x,y,z)=>{const m=new THREE.Mesh(geo);m.position.set(x,y,z);g.add(m);return m;};
  const box=(w,h,d,c,x=0,y=h/2,z=0)=>add(new THREE.BoxGeometry(w,h,d),x,y,z);
  const cyl=(a,b,h,c,x,y,z)=>add(new THREE.CylinderGeometry(a,b,h,24),x,y,z);
  assert.equal(buildDeskItem(item.type,{box,cyl},item.color),true);
  const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());
  for(const v of [size.x,size.y,size.z])assert.ok(Number.isFinite(v)&&v>0,item.type);
  g.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});
 }
});
test('accessories follow a rotated elevated desk while drawers stay on floor',()=>{
 const desk={x:100,z:-20,y:8,h:75,w:150,d:65,rotation:90};
 const item=deskItems.find(x=>x.type==='pc'),p=placeOnDesk(item,desk);
 assert.equal(p.y,83);assert.equal(p.rotation,90);assert.ok(Math.abs(p.x-100)<1e-8);assert.ok(p.z<desk.z);
 assert.deepEqual(placeOnDesk(deskItems.find(x=>x.type==='drawers'),desk),{});assert.deepEqual(placeOnDesk(item,null),{});
});
