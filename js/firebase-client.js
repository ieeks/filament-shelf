import { firebaseConfig } from './firebase-config.js';

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
