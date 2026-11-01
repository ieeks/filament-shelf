import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, createRoll, createWish } from '../js/core.js';
import { CloudRepository, encodeCloud, decodeCloud } from '../js/cloud-storage.js';
import { publicShelf, validatePublicShelf, newShareId, validShareId } from '../js/sharing.js';
function fixture() {
  const f={material:'PLA Basic',colorName:'Pumpkin Orange',colorCode:'10301',colors:['#FF9016'],notes:'PRIVATE NOTE',purchasePrice:24.99,purchaseDate:'2026-10-31'};
  const s=createState([createRoll(f,'PRIVATE-ID'),createRoll({...f,archived:true},'ARCHIVED-ID')]);
  s.wishlist=[createWish(f,'PRIVATE-WISH')]; return s;
}
function repository(initial=fixture()) {
  let document=encodeCloud(initial), fail=false;
  const transport={async read(){return structuredClone(document);},async transact(fn){if(fail)throw new Error('offline');document=fn(structuredClone(document));},watch(){return()=>{};}};
  const repo=new CloudRepository(transport,{setItem(){},getItem(){return null;}},'private-user');
  return {repo,transport,document:()=>document,fail:()=>{fail=true;}};
}
test('public projection contains exactly the approved fields, no private or archived data',()=>{
  const shared=publicShelf(fixture()); assert.equal(shared.rolls.length,1);
  assert.deepEqual(Object.keys(shared).sort(),['format','revision','rolls','updatedAt']);
  assert.deepEqual(Object.keys(shared.rolls[0]).sort(),['colorCode','colorName','colors','initialWeight','kind','material','remainingWeight','status']);
  const text=JSON.stringify(shared);
  for(const privateValue of ['PRIVATE','ARCHIVED','24.99','purchase','usage','wishlist','owner'])assert.equal(text.includes(privateValue),false,privateValue);
  assert.deepEqual(validatePublicShelf(shared),shared);
});
test('public reader validates weights and colors, and discards unknown fields',()=>{
  const shared=publicShelf(fixture()); shared.owner='private-user'; shared.rolls[0].notes='private';
  assert.equal('owner' in validatePublicShelf(shared),false); assert.equal('notes' in validatePublicShelf(shared).rolls[0],false);
  shared.rolls[0].remainingWeight=-1; assert.throws(()=>validatePublicShelf(shared));
  shared.rolls[0].remainingWeight=1000;shared.rolls[0].colors=['red;url(javascript:alert(1))'];assert.throws(()=>validatePublicShelf(shared));
});
test('share tokens contain 256 random bits and reject malformed paths',()=>{
  const ids=Array.from({length:100},newShareId);assert.equal(new Set(ids).size,100);assert.ok(ids.every(validShareId));
  for(const v of ['',null,'../inventory','a'.repeat(63),'A'.repeat(64)])assert.equal(validShareId(v),false);
});
test('sharing toggles increment revision but do not change stock or backup data',async()=>{
  const {repo,document}=repository(), initial=await repo.load();
  const enabled=await repo.setSharing(true), first=repo.shareId;
  assert.ok(validShareId(first));assert.equal(document().shareId,first);assert.deepEqual(enabled.rolls,initial.rolls);assert.deepEqual(enabled.wishlist,initial.wishlist);
  assert.equal('shareId' in JSON.parse(repo.raw),false);
  const disabled=await repo.setSharing(false);assert.equal(repo.shareId,null);assert.equal('shareId' in document(),false);assert.equal(disabled.revision,2);
  await repo.setSharing(true);assert.notEqual(repo.shareId,first);
});
test('normal saves preserve an active share and old envelopes without sharing remain supported',async()=>{
  const {repo,document}=repository();await repo.load();const enabled=await repo.setSharing(true), id=repo.shareId;
  await repo.save({...enabled,rolls:[]});assert.equal(document().shareId,id);assert.equal(decodeCloud(document()).rolls.length,0);
  const legacy=fixture(); assert.deepEqual(decodeCloud(encodeCloud(legacy)),legacy);
});
test('failed sharing mutation cannot change the link, revision or stock',async()=>{
  const f=repository();await f.repo.load();const raw=f.repo.raw;f.fail();
  await assert.rejects(f.repo.setSharing(true),/offline/);assert.equal(f.repo.raw,raw);assert.equal(f.repo.shareId,null);
});
test('stale device cannot re-enable a revoked share',async()=>{
  const f=repository();await f.repo.load();await f.repo.setSharing(true);
  const stale=new CloudRepository(f.transport,{setItem(){}},'private-user');await stale.load();
  await f.repo.setSharing(false);await assert.rejects(stale.setSharing(true),/anderen Gerät/);
  assert.equal('shareId' in f.document(),false);
});
