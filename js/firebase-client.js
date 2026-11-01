import { firebaseConfig } from './firebase-config.js';
import { publicShelf, validShareId } from './sharing.js';
import { decodeCloud } from './cloud-storage.js';

// Loaded only when the user opens Sync or previously opted into cloud mode.
// Pinned official browser modules: no npm, bundler, or build pipeline required.
export async function createFirebaseClient() {
  const [appSDK, authSDK, dbSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')
  ]);
  const app = appSDK.initializeApp(firebaseConfig);
  const auth = authSDK.getAuth(app);
  const db = dbSDK.getFirestore(app);
  return {
    onAuth(callback) { return authSDK.onAuthStateChanged(auth, callback); },
    // Redirect with a firebaseapp.com helper breaks third-party storage rules on
    // Safari when the actual app is on GitHub Pages. Use a user-initiated popup.
    login() {
      const provider = new authSDK.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return authSDK.signInWithPopup(auth, provider);
    },
    logout() { return authSDK.signOut(auth); },
    transport(uid) { return firestoreTransport(dbSDK, db, uid); }
  };
}

export function firestoreTransport(dbSDK, db, uid) {
  const ref = dbSDK.doc(db, 'users', uid, 'shelf', 'inventory');
  return {
    async read() {
      const snapshot = await dbSDK.getDocFromServer(ref);
      return snapshot.exists() ? snapshot.data() : null;
    },
    transact(change) {
      return dbSDK.runTransaction(db, async tx => {
        const snapshot = await tx.get(ref);
        const next = change(snapshot.exists() ? snapshot.data() : null);
        const previousId = snapshot.exists() ? snapshot.data().shareId : null;
        if (next.shareId) {
          if (next.shareId !== previousId) tx.set(dbSDK.doc(db, 'shares', next.shareId), { owner:uid });
          tx.set(dbSDK.doc(db, 'shares', next.shareId, 'public', 'inventory'), publicShelf(decodeCloud(next)));
        }
        if (previousId && previousId !== next.shareId) tx.delete(dbSDK.doc(db, 'shares', previousId, 'public', 'inventory'));
        tx.set(ref, next);
      });
    },
    watch(callback, error) {
      return dbSDK.onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        callback(snapshot.exists() ? snapshot.data() : null);
      }, error);
    }
  };
}

export async function createShareReader(shareId, callback, error) {
  if (!validShareId(shareId)) throw new Error('Dieser Leselink ist ungültig oder unvollständig.');
  // No Firebase Auth SDK, sign-in, local inventory, or seed import for readers.
  const [appSDK, dbSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')
  ]);
  const app = appSDK.initializeApp(firebaseConfig);
  return watchPublicShelf(dbSDK, dbSDK.getFirestore(app), shareId, callback, error);
}
export function watchPublicShelf(sdk, db, shareId, callback, error) {
  if (!validShareId(shareId)) throw new Error('Ungültiger Leselink.');
  return sdk.onSnapshot(sdk.doc(db, 'shares', shareId, 'public', 'inventory'), { includeMetadataChanges:true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    callback(snapshot.exists() ? snapshot.data() : null);
  }, error);
}
