import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogData } from '../js/catalog-data.js';
import { normalizeCatalog, findByCode, normalizeCode, normalizeHex, createRoll, consume, stats, createState, parseImport, planImport, validateRoll, validateState, colorFamily, family } from '../js/core.js';
import { createSeed, seedCatalog } from '../js/seed.js';
import { LocalStorageRepository, STORAGE_KEY, RECOVERY_KEY } from '../js/storage.js';
const catalog = normalizeCatalog(catalogData);
const seed = () => createSeed(catalog);
const state = () => createState(seed());
const memory = () => {
  const data = new Map();
  return { data, getItem:k => data.has(k) ? data.get(k) : null, setItem:(k,v) => data.set(k,v) };
};
test('10301 recognizes official Pumpkin Orange, PLA Basic and #FF9016FF',() => {
  assert.equal(catalog.length,318);
  const matches = findByCode(catalog,' 10301 ');
  assert.equal(matches.length,1);
  assert.deepEqual(matches[0],{manufacturer:'Bambu Lab',colorCode:'10301',material:'PLA Basic',colorName:'Pumpkin Orange',colorNameDE:'Kürbis-Orange',colors:['#FF9016FF'],source:'official'});
});
test('all 16 user-confirmed seed rows keep names, types, gift and unique identities',() => {
  const rolls = seed(); assert.equal(rolls.length,16); assert.equal(new Set(rolls.map(r => r.id)).size,16);
  assert.equal(rolls.filter(r => r.kind === 'refill').length,1); assert.equal(rolls[0].colorCode,'10700');
  assert.equal(rolls.find(r => r.colorCode === '30604').notes,'Geschenk');
  assert.equal(rolls.find(r => r.colorCode === '30604').purchasePrice,0);
  assert.ok(rolls.every(r => r.initialWeight === 1000 && r.remainingWeight === 1000 && r.status === 'new'));
  const s = stats(rolls); assert.equal(s.remaining,16000); assert.equal(s.byFamily.get('PLA'),12000); assert.equal(s.byFamily.get('PETG'),4000); assert.equal(s.byMaterial.size,6);
});
test('missing seed catalog records fall back without losing inventory',() => { assert.equal(seedCatalog([]).length,16); assert.equal(createSeed([]).length,16); assert.equal(createSeed([])[2].colors[0],'#FF9016'); });
test('unknown and malformed color codes stay distinct; no partial matching',() => {
  assert.deepEqual(findByCode(catalog,'99999'),[]);
  for (const value of ['1030','103010','10301x','',null,'10 301','<img>','1e004']) assert.throws(() => normalizeCode(value));
  assert.equal(normalizeCode(10301),'10301');
});
test('multiple catalog variants preserved; exact duplicate entries removed',() => {
  const entry = catalogData.data[0];
  const variants = normalizeCatalog({data:[entry,entry,{...entry,fila_type:'PLA Matte'}]});
  assert.equal(findByCode(variants,entry.fila_color_code).length,2);
});
test('HEX validation keeps transparency, gradients; CSS injection rejected',() => {
  assert.equal(normalizeHex('#abcdef80'),'#ABCDEF80'); assert.equal(normalizeHex('#ff9016'),'#FF9016');
  for (const c of ['red','#FFF','url(https://evil.test)','#fff;display:none','#000000ZZ']) assert.throws(() => normalizeHex(c));
  assert.ok(catalog.some(c => c.colors.length > 1));
});
test('manual unknown code can become a valid roll',() => { assert.equal(createRoll({material:'PLA Custom',colorName:'Test',colorCode:'99999',colors:['#123456']}).colorCode,'99999'); });
test('consumption computes weights, history and transitions without mutating original',() => {
  const original = seed()[0]; const opened = consume(original,125.5,'Projekt');
  assert.equal(original.remainingWeight,1000); assert.equal(opened.remainingWeight,874.5); assert.equal(opened.status,'opened'); assert.equal(opened.usage[0].note,'Projekt');
  const empty = consume(opened,874.5); assert.equal(empty.remainingWeight,0); assert.equal(empty.status,'empty'); assert.equal(empty.usage.length,2); assert.equal(stats([empty]).consumed,1000);
});
test('consumption rejects negative, nonfinite, zero and excessive grams',() => { for (const n of [-1,0,1000.01,NaN,Infinity,'50']) assert.throws(() => consume(seed()[0],n)); });
test('decimal consumption rounds at hundredths',() => { const r = createRoll({...seed()[0],initialWeight:1,remainingWeight:1}); assert.equal(consume(consume(r,.1),.2).remainingWeight,.7); });
test('cannot consume archived rolls',() => assert.throws(() => consume({...seed()[0],archived:true},1)));
test('two real rolls of one color have unique IDs and are counted separately',() => { const fields = {...seed()[0]}; delete fields.id; const a = createRoll(fields), b = createRoll(fields); assert.notEqual(a.id,b.id); assert.equal(stats([a,b]).remaining,2000); assert.equal(stats([a,b]).colorCount,1); });
test('status/weight consistency enforced and opened full roll allowed',() => {
  assert.doesNotThrow(() => validateRoll({...seed()[0],status:'opened'}));
  for (const fields of [{remainingWeight:-1},{remainingWeight:1001},{remainingWeight:0},{remainingWeight:500},{status:'empty'},{initialWeight:0},{remainingWeight:'500'}]) assert.throws(() => validateRoll({...seed()[0],...fields}));
});
test('export-import roundtrip retains optional fields, archive, history and duplicates by color',() => {
  const s = state(); s.rolls[0] = {...consume(s.rolls[0],50,'Test'),archived:true,purchaseDate:'2026-10-31',purchasePrice:23.99};
  assert.deepEqual(parseImport(JSON.stringify({...s,exportedAt:new Date().toISOString()})),s);
});
test('invalid import shape, version, JSON, oversize and duplicate IDs rejected',() => {
  for (const value of ['garbage','null','[]','{}',JSON.stringify({...state(),version:2}),JSON.stringify({...state(),revision:-1}),JSON.stringify({...state(),rolls:[seed()[0],seed()[0]]})]) assert.throws(() => parseImport(value));
  assert.throws(() => parseImport(' '.repeat(5*1024*1024+1)));
});
test('import validates dates, prices, colors, ids, booleans and history',() => {
  for (const bad of [{purchaseDate:'2026-02-30'},{purchasePrice:-1},{colors:['url(x)']},{id:''},{archived:'false'},{usage:[{id:'a',grams:-1,date:new Date().toISOString(),note:''}]},{notes:123},{createdAt:'foo'}]) assert.throws(() => validateState({...state(),rolls:[{...seed()[0],...bad}]}));
});
test('import discards unknown keys and keeps input as inert text',() => { const s = state(); s.rolls[0].colorName='<img src=x onerror=alert(1)>'; const result=parseImport(JSON.stringify({...s,unknown:'ignored'})); assert.equal(result.unknown,undefined); assert.equal(result.rolls[0].colorName,s.rolls[0].colorName); });
test('merging same backup is idempotent and existing version wins',() => {
  const current = state(), incoming = structuredClone(current); incoming.rolls[0] = consume(incoming.rolls[0],100);
  const merged = planImport(current,incoming,'merge'); assert.equal(merged.rolls.length,16); assert.equal(merged.duplicates,16); assert.equal(merged.rolls[0].remainingWeight,1000);
  const extra = createRoll({...incoming.rolls[0],id:undefined}); incoming.rolls.push(extra);
  const first = planImport(current,incoming,'merge'); assert.equal(first.total,17);
  const second = planImport({...current,rolls:first.rolls},incoming,'merge'); assert.equal(second.total,17); assert.equal(second.added,0);
});
test('replace copies exact backup including intentionally empty inventory',() => { assert.equal(planImport(state(),createState([]),'replace').total,0); assert.equal(planImport(state(),state(),'replace').total,16); assert.throws(() => planImport(state(),state(),'oops')); });
test('first start seeds once and reload preserves consumption',async () => {
  const storage=memory(); let calls=0;
  const repo = new LocalStorageRepository(storage); const original=await repo.load(() => { calls++; return seed(); });
  original.rolls[0]=consume(original.rolls[0],77); await repo.save(original);
  const again = await new LocalStorageRepository(storage).load(() => { calls++; return seed(); });
  assert.equal(calls,1); assert.equal(again.rolls.length,16); assert.equal(again.rolls[0].remainingWeight,923);
});
test('empty stored inventory never re-seeds after reload',async () => { const storage=memory(), repo=new LocalStorageRepository(storage); const s=await repo.load(seed); await repo.save({...s,rolls:[]}); const r=await new LocalStorageRepository(storage).load(() => { throw new Error('must not seed'); }); assert.equal(r.rolls.length,0); });
test('corrupt existing data is never silently replaced',async () => { const storage=memory(); storage.setItem(STORAGE_KEY,'{broken'); const repo=new LocalStorageRepository(storage); await assert.rejects(repo.load(seed)); assert.equal(storage.getItem(STORAGE_KEY),'{broken'); });
test('storage quota failure leaves prior data and repo snapshot unchanged',async () => {
  const storage=memory(),repo=new LocalStorageRepository(storage),s=await repo.load(seed),before=repo.raw;
  storage.setItem=() => { throw new Error('QuotaExceededError'); };
  await assert.rejects(repo.save({...s,rolls:[]})); assert.equal(repo.raw,before); assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('stale tab cannot overwrite newer inventory; reload resolves conflict',async () => {
  const storage=memory(),a=new LocalStorageRepository(storage),b=new LocalStorageRepository(storage); const sa=await a.load(seed),sb=await b.load(seed);
  await a.save({...sa,rolls:[]}); await assert.rejects(b.save(sb),/anderen Tab/); const loaded=await b.load(seed); assert.equal(loaded.rolls.length,0);
});
test('before-import recovery persists old inventory and refuses failure to back up',async () => {
  const storage=memory(),repo=new LocalStorageRepository(storage),s=await repo.load(seed); await repo.save({...s,rolls:[]},{backup:true}); assert.equal(repo.recovery().rolls.length,16);
  const before=storage.getItem(STORAGE_KEY),set=storage.setItem; storage.setItem=(k,v) => { if(k===RECOVERY_KEY) throw new Error('disk full'); set(k,v); };
  await assert.rejects(repo.save(s,{backup:true})); assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('explicit recovery protects corrupt source and checks concurrent changes',async () => {
  const storage=memory(); storage.setItem(STORAGE_KEY,'invalid'); const repo=new LocalStorageRepository(storage); await assert.rejects(repo.load(seed));
  await assert.rejects(repo.recover(state(),'different'));
  const recovered=await repo.recover(state(),'invalid'); assert.equal(recovered.rolls.length,16); assert.equal(storage.getItem('filament-shelf:damaged-original:v1'),'invalid');
  await assert.rejects(repo.recover(state(),storage.getItem(STORAGE_KEY)));
});
test('statistics include archived weight and zero empty roles correctly',() => {
  const rolls=[seed()[0],{...consume(seed()[1],500),archived:true},consume(seed()[2],1000)];
  const s=stats(rolls); assert.equal(s.remaining,1500); assert.equal(s.consumed,1500); assert.equal(s.opened,1); assert.equal(s.empty,1); assert.equal(s.archived,1); assert.equal(s.colorCount,2);
});
test('family classification and color filters',() => { assert.equal(family('PLA Wood'),'PLA'); assert.equal(family('PETG HF'),'PETG'); assert.equal(family('ABS'),'Andere'); assert.equal(colorFamily('#000000'),'Schwarz'); assert.equal(colorFamily('#FFFFFF'),'Weiß'); assert.equal(colorFamily('#FF9016'),'Orange / Beige'); assert.equal(colorFamily('#0078BF'),'Blau'); });
test('opaque RGBA and RGB colors aggregate as one color',() => { const a=seed()[2],b={...seed()[2],id:'extra',colors:['#FF9016']}; assert.equal(stats([a,b]).colorCount,1); });
test('pastel pink, purple and wood keep intuitive filter families',() => { assert.equal(colorFamily('#F7CED7'),'Rosa'); assert.equal(colorFamily('#5E43B7'),'Violett'); assert.equal(colorFamily('#D6CCA3'),'Orange / Beige'); });
test('Sunflower Yellow is listed under yellow',() => assert.equal(colorFamily('#FEC600'),'Gelb'));
