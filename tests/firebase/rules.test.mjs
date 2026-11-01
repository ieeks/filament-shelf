import { readFile } from 'node:fs/promises';
import { test, before, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
let env;
const data = revision => ({format:1,revision,payload:'{"example":"private owner data"}'});
before(async () => {
  env = await initializeTestEnvironment({projectId:'demo-filament-shelf',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
});
after(async () => env?.cleanup());
const google = uid => env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
const ref = (db,uid) => doc(db,'users',uid,'shelf','inventory');
test('only the matching Google user may read and create its shelf', async () => {
  const owner = google('owner'), other = google('other'), anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(ref(owner,'owner'),data(0)));
  await assertSucceeds(getDoc(ref(owner,'owner')));
  await assertFails(getDoc(ref(other,'owner')));
  await assertFails(setDoc(ref(other,'owner'),data(1)));
  await assertFails(getDoc(ref(anon,'owner')));
  await assertFails(setDoc(ref(anon,'visitor'),data(0)));
});
test('owner cannot overwrite a revision, skip a revision, delete, or list other shelves',async () => {
  const db=google('revisions'), target=ref(db,'revisions');
  await assertSucceeds(setDoc(target,data(0)));
  await assertFails(setDoc(target,data(0)));
  await assertFails(setDoc(target,data(2)));
  await assertSucceeds(setDoc(target,data(1)));
  await assertFails(deleteDoc(target));
  await assertFails(getDocs(collection(db,'users')));
});
test('invalid fields, provider and oversized snapshot are denied',async () => {
  const db=google('shape'), target=ref(db,'shape');
  await assertFails(setDoc(target,{...data(0),extra:true}));
  await assertFails(setDoc(target,{...data(0),payload:123}));
  await assertFails(setDoc(target,{...data(0),payload:''}));
  await assertFails(setDoc(target,{...data(0),payload:'x'.repeat(900001)}));
  await assertFails(setDoc(target,{...data(0),format:2}));
  await assertFails(setDoc(target,data(1)));
  const password = env.authenticatedContext('shape',{firebase:{sign_in_provider:'password'}}).firestore();
  await assertFails(setDoc(ref(password,'shape'),data(0)));
  await assertFails(setDoc(doc(db,'unrelated','data'),data(0)));
});

test('real Firestore transport commits stock and wishes together and rejects a racing save',async () => {
  const { CloudRepository } = await import('../../js/cloud-storage.js');
  const { firestoreTransport } = await import('../../js/firebase-client.js');
  const { createState, createRoll, createWish, purchaseWish } = await import('../../js/core.js');
  const sdk = await import('firebase/firestore');
  const storage = {getItem(){return null;},setItem(){}};
  const uid='transaction-owner', db=google(uid);
  const a=new CloudRepository(firestoreTransport(sdk,db,uid),storage,uid);
  const b=new CloudRepository(firestoreTransport(sdk,db,uid),storage,uid);
  const fields={material:'PLA Basic',colorName:'Pumpkin Orange',colorCode:'10301',colors:['#FF9016']};
  const initial=createState([createRoll(fields,'existing')]); initial.wishlist=[createWish({...fields,quantity:1},'wish')];
  await a.initialize(initial); const originalA=await a.load(), originalB=await b.load();
  const results=await Promise.allSettled([a.save(purchaseWish(originalA,'wish',fields)),b.save({...originalB,rolls:[],wishlist:[]})]);
  if (results.filter(r=>r.status==='fulfilled').length!==1) throw new Error('Exactly one concurrent save must succeed');
  const final=await a.load();
  if (final.revision!==1 || final.wishlist.length!==0 || ![0,2].includes(final.rolls.length)) throw new Error('Atomic inventory/wishlist snapshot expected');
});
