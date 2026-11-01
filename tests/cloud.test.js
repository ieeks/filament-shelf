import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudRepository, encodeCloud, decodeCloud, MAX_CLOUD_BYTES } from '../js/cloud-storage.js';
import { createState, createRoll, createWish, purchaseWish } from '../js/core.js';

class MemoryStorage {
  data = new Map(); fail = false;
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k,v) { if (this.fail) throw new Error('Storage full'); this.data.set(k,v); }
}
function fixture() {
  const state = createState([createRoll({ material:'PLA Basic', colorName:'Pumpkin Orange', colorCode:'10301', colors:['#FF9016'] },'roll-1')]);
  state.wishlist = [createWish({ material:'PLA Basic', colorName:'Pumpkin Orange', colorCode:'10301', colors:['#FF9016'], quantity:2 },'wish-1')];
  return state;
}
function server(initial = null) {
  let data = initial === null ? null : encodeCloud(initial);
  let listener, onError;
  return {
    writes: 0, offline: false,
    async read() { if (this.offline) throw new Error('offline'); return structuredClone(data); },
    async transact(fn) { if (this.offline) throw new Error('offline'); data = structuredClone(fn(structuredClone(data))); this.writes++; },
    watch(fn,err) { listener = fn; onError = err; return () => { listener = null; }; },
    emit(value) { listener?.(value); }, error(e) { onError?.(e); },
    value() { return structuredClone(data); }
  };
}

test('cloud roundtrip includes stock and wishlist',() => {
  const state = fixture(); assert.deepEqual(decodeCloud(encodeCloud(state)),state);
});
test('missing cloud inventory is not seeded',async () => {
  const remote = server(), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  assert.equal(await repo.load(),null); assert.equal(remote.writes,0); assert.equal(repo.raw,null);
});
test('explicit first adoption resets revision and leaves legacy local data untouched',async () => {
  const storage = new MemoryStorage(); storage.setItem('filament-shelf:v1','original');
  const remote = server(), repo = new CloudRepository(remote,storage,'u');
  const source = fixture(); source.revision = 17;
  const adopted = await repo.initialize(source);
  assert.equal(adopted.revision,0); assert.equal(source.revision,17);
  assert.equal(storage.getItem('filament-shelf:v1'),'original');
  assert.deepEqual(adopted.wishlist,source.wishlist);
});
test('first-use race cannot overwrite a shelf created on another device',async () => {
  const remote = server(), a = new CloudRepository(remote,new MemoryStorage(),'u'), b = new CloudRepository(remote,new MemoryStorage(),'u');
  await a.load(); await b.load(); await a.initialize(fixture());
  await assert.rejects(b.initialize(createState([])),/bereits vorhanden/);
  assert.equal(decodeCloud(remote.value()).rolls.length,1);
});
test('competing saves reject stale snapshot instead of losing usage',async () => {
  const remote = server(fixture()), a = new CloudRepository(remote,new MemoryStorage(),'u'), b = new CloudRepository(remote,new MemoryStorage(),'u');
  const first = await a.load(), stale = await b.load();
  first.rolls[0].notes = 'Device A'; await a.save(first);
  stale.rolls[0].notes = 'Device B'; await assert.rejects(b.save(stale),/anderen Gerät/);
  assert.equal(decodeCloud(remote.value()).rolls[0].notes,'Device A'); assert.equal(remote.writes,1);
});
test('saving a stale input is rejected even after repository has loaded a newer revision',async () => {
  const remote = server(fixture()), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  const stale = await repo.load(); await repo.save(stale);
  await assert.rejects(repo.save(stale),/anderen Gerät/);
});
test('wish purchase changes both lists in one cloud transaction',async () => {
  const remote = server(fixture()), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  const state = await repo.load(), next = purchaseWish(state,'wish-1',state.wishlist[0]);
  const saved = await repo.save(next);
  assert.equal(saved.rolls.length,2); assert.equal(saved.wishlist[0].quantity,1);
  assert.equal(remote.writes,1); assert.equal(saved.revision,1);
});
test('offline failure preserves remote snapshot, raw and cache',async () => {
  const remote = server(fixture()), storage = new MemoryStorage(), repo = new CloudRepository(remote,storage,'u');
  const state = await repo.load(), raw = repo.raw; remote.offline = true;
  await assert.rejects(repo.save({...state,rolls:[]}),/offline/);
  assert.equal(repo.raw,raw); assert.equal(storage.getItem(repo.key),raw); assert.equal(remote.writes,0);
});
test('realtime notifications do not silently change the save base of an open form',async () => {
  const remote = server(fixture()), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  const state = await repo.load(), raw = repo.raw; let notification;
  const stop = repo.subscribe(next => { notification = next; },assert.fail);
  remote.emit(encodeCloud({...state,revision:1,rolls:[]}));
  assert.equal(notification.rolls.length,0); assert.equal(repo.raw,raw);
  repo.adopt(notification); assert.equal(JSON.parse(repo.raw).revision,1); stop();
});
test('deleted or malformed remote inventory reports error and never reseeds',async () => {
  const remote = server(fixture()), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  await repo.load(); const errors = [];
  repo.subscribe(assert.fail,e => errors.push(e)); remote.emit(null); remote.emit({format:1,payload:'{}',revision:1});
  assert.equal(errors.length,2); assert.equal(remote.writes,0);
});
test('cache failure after committed write still returns the cloud success',async () => {
  const remote = server(fixture()), storage = new MemoryStorage(), repo = new CloudRepository(remote,storage,'u');
  const state = await repo.load(); storage.fail = true;
  const saved = await repo.save({...state,rolls:[]});
  assert.equal(saved.revision,1); assert.equal(repo.cacheWarning,true); assert.equal(decodeCloud(remote.value()).rolls.length,0);
});
test('backup failure aborts import before any server write',async () => {
  const remote = server(fixture()), storage = new MemoryStorage(), repo = new CloudRepository(remote,storage,'u');
  const state = await repo.load(); storage.fail = true;
  await assert.rejects(repo.save({...state,rolls:[]},{backup:true}),/Storage full/);
  assert.equal(remote.writes,0);
});
test('cloud import recovery keeps the full previous wishlist and inventory',async () => {
  const remote = server(fixture()), storage = new MemoryStorage(), repo = new CloudRepository(remote,storage,'u');
  const before = await repo.load(); await repo.save({...before,rolls:[],wishlist:[]},{backup:true});
  assert.deepEqual(repo.recovery(),before);
});
test('account caches and recovery snapshots are isolated by uid',async () => {
  const storage = new MemoryStorage(), a = new CloudRepository(server(fixture()),storage,'a'), b = new CloudRepository(server(createState([])),storage,'b');
  await a.load(); await b.load();
  assert.equal(JSON.parse(storage.getItem(a.key)).rolls.length,1); assert.equal(JSON.parse(storage.getItem(b.key)).rolls.length,0);
  assert.equal(a.recovery(),null); assert.equal(b.recovery(),null);
});
test('malformed cloud payload, revision mismatch and excessive size are rejected',() => {
  assert.throws(() => decodeCloud({format:1,revision:1,payload:JSON.stringify(fixture())}),/Datenversion/);
  assert.throws(() => decodeCloud({format:2,payload:'{}'}),/Ungültiger/);
  const state = createState([]); state.wishlist = Array.from({length:600},(_,i) => createWish({material:'PLA',colorName:'X',colorCode:'12345',colors:['#000000'],notes:'x'.repeat(2000)},`w-${i}`));
  assert.ok(JSON.stringify(state).length > MAX_CLOUD_BYTES); assert.throws(() => encodeCloud(state),/zu groß/);
});
test('empty cloud stock remains empty after load on another device',async () => {
  const remote = server(createState([])), repo = new CloudRepository(remote,new MemoryStorage(),'u');
  const state = await repo.load(); assert.equal(state.rolls.length,0); assert.equal(remote.writes,0);
});
