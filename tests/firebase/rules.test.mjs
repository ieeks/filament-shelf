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

test('anonymous reader sees only the public projection, never account metadata or private stock',async()=>{
  const {CloudRepository}=await import('../../js/cloud-storage.js');
  const {firestoreTransport}=await import('../../js/firebase-client.js');
  const {createState,createRoll}=await import('../../js/core.js');
  const sdk=await import('firebase/firestore'); const uid='sharing-owner';
  const owner=google(uid), anon=env.unauthenticatedContext().firestore(), other=google('sharing-intruder');
  const repo=new CloudRepository(firestoreTransport(sdk,owner,uid),{setItem(){}},uid);
  const state=createState([createRoll({material:'PLA',colorName:'Purple',colorCode:'10700',colors:['#5E43B7'],notes:'PRIVATE SECRET',purchasePrice:99},'private-roll')]);
  await repo.initialize(state);await repo.setSharing(true);const id=repo.shareId;
  const publicRef=doc(anon,'shares',id,'public','inventory');
  const publicData=(await assertSucceeds(getDoc(publicRef))).data();
  if(JSON.stringify(publicData).includes('PRIVATE') || JSON.stringify(publicData).includes(uid) || publicData.rolls[0].purchasePrice!==undefined)throw new Error('Private data leaked');
  await assertFails(getDoc(doc(anon,'shares',id)));
  await assertFails(getDoc(doc(other,'shares',id)));
  await assertFails(getDoc(ref(anon,uid)));
  await assertFails(getDocs(collection(anon,'shares')));
  await assertFails(getDocs(collection(anon,'shares',id,'public')));
  await assertFails(setDoc(publicRef,publicData));
  await assertFails(setDoc(doc(other,'shares',id,'public','inventory'),publicData));
  await assertFails(deleteDoc(doc(other,'shares',id,'public','inventory')));
  // A foreign account cannot claim a known token, even if revisions match.
  const thiefUid='sharing-intruder';
  const thief=new CloudRepository(firestoreTransport(sdk,other,thiefUid),{setItem(){}},thiefUid);
  await thief.initialize(createState([]));
  const stolen={...data(1),shareId:id};
  await assertFails(setDoc(ref(other,thiefUid),stolen));
  await assertFails(setDoc(doc(other,'shares',id),{owner:thiefUid}));
});

test('public updates and revocation are atomic; old clients cannot leave stale public data',async()=>{
  const {CloudRepository}=await import('../../js/cloud-storage.js');
  const {firestoreTransport}=await import('../../js/firebase-client.js');
  const {createState,createRoll}=await import('../../js/core.js');
  const sdk=await import('firebase/firestore'), uid='revoking-owner';
  const owner=google(uid), anon=env.unauthenticatedContext().firestore();
  const repo=new CloudRepository(firestoreTransport(sdk,owner,uid),{setItem(){}},uid);
  await repo.initialize(createState([createRoll({material:'PLA',colorName:'Red',colorCode:'10200',colors:['#FF0000']},'roll')]));
  let state=await repo.setSharing(true);const id=repo.shareId, publicRef=doc(anon,'shares',id,'public','inventory');
  // Updating private stock without matching public revision must be denied.
  await assertFails(setDoc(ref(owner,uid),{...data(2),shareId:id}));
  // An old app omitting shareId must delete the public document in the same transaction.
  await assertFails(setDoc(ref(owner,uid),data(2)));
  await repo.save({...state,rolls:[]});
  const updated=(await getDoc(publicRef)).data();if(updated.rolls.length!==0||updated.revision!==2)throw new Error('Public stock did not update');
  await repo.setSharing(false);
  if((await getDoc(publicRef)).exists())throw new Error('Revoked link is still readable');
  await assertFails(getDoc(doc(anon,'shares',id)));
  await repo.setSharing(true);if(repo.shareId===id)throw new Error('Revoked token was reused');
  if((await getDoc(publicRef)).exists())throw new Error('Old token was reactivated');
});

test('anonymous live reader receives changes and clears on revocation',async()=>{
  const {CloudRepository}=await import('../../js/cloud-storage.js');
  const {firestoreTransport,watchPublicShelf}=await import('../../js/firebase-client.js');
  const {createState}=await import('../../js/core.js');
  const sdk=await import('firebase/firestore'), uid='live-reader-owner';
  const repo=new CloudRepository(firestoreTransport(sdk,google(uid),uid),{setItem(){}},uid);
  await repo.initialize(createState([]));await repo.setSharing(true);
  const anon=env.unauthenticatedContext().firestore();
  let resolveNext,rejectNext;const pending=[];
  const next=()=>pending.length?Promise.resolve(pending.shift()):new Promise((resolve,reject)=>{resolveNext=resolve;rejectNext=reject;});
  const stop=watchPublicShelf(sdk,anon,repo.shareId,value=>{if(resolveNext){const done=resolveNext;resolveNext=null;done(value);}else pending.push(value);},e=>rejectNext?.(e));
  try {
    const first=await next();if(first.revision!==1)throw new Error('Initial public snapshot missing');
    await repo.setSharing(false);const revoked=await next();if(revoked!==null)throw new Error('Reader did not receive revocation');
  }finally{stop();}
});
