import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutosave,recoveryCandidates,RECOVERY_KEY} from '../app/src/main/assets/site/autosave.js';
function storage(){const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)||null};}
test('refresh recovers newest change before the async database write completes',async()=>{
 const s=storage();let value={version:2,objects:[{x:1}]},db;const a=createAutosave({getData:()=>value,write:async v=>{db=v;},storage:s,onStatus:()=>{},delay:10000});a.enable();a.schedule();value.objects[0].x=73;a.schedule();assert.equal(recoveryCandidates({version:2,objects:[{x:0}]},s)[0].objects[0].x,73);await a.flush();assert.equal(db.objects[0].x,73);
});
test('writes serialize so a slow older save cannot overwrite newer work',async()=>{
 const s=storage();let value={n:1},release;const seen=[];const a=createAutosave({getData:()=>value,storage:s,onStatus:()=>{},write:async v=>{if(v.n===1)await new Promise(r=>release=r);seen.push(v.n);},delay:10000});a.enable();const first=a.flush();await Promise.resolve();value={n:2};a.schedule();release();await first;assert.deepEqual(seen,[1,2]);await a.flush();
});
test('corrupt recovery data falls back to database and save failures retain recovery',async()=>{
 const s=storage();s.setItem(RECOVERY_KEY,'bad');assert.deepEqual(recoveryCandidates({n:4},s),[{n:4}]);const statuses=[];const a=createAutosave({getData:()=>({n:5}),storage:s,onStatus:s=>statuses.push(s),write:async()=>{throw Error('disk full');}});a.enable();await assert.rejects(a.flush());assert.equal(recoveryCandidates(null,s)[0].n,5);assert.ok(statuses.includes('error'));
});
