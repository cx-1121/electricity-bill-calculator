/**
 * Shared storage on Firebase Firestore, so every device sees the same house.
 *
 * The whole app state (the same JSON store.js keeps) lives in one document:
 *   houses/{houseId}   { state: "<json>", updatedAt, writer }
 * houseId = SHA-256 of the house passcode, so the document can only be found
 * by someone who knows the passcode (security rules forbid listing).
 *
 * connect() returns a storage object with the localStorage shape store.js
 * expects (getItem / setItem), backed by an in-memory copy that is kept live
 * with onSnapshot and written back to Firestore on every change.
 */
(function (root) {
  'use strict';

  const SALT = 'dorm-electricity-split:v1:';
  const STORAGE_KEY = 'dormElectricitySplit.v1';
  let db = null;

  function isConfigured() {
    const c = root.FIREBASE_CONFIG;
    return !!(c && c.projectId && c.apiKey && root.firebase);
  }

  function getDb() {
    if (db) return db;
    root.firebase.initializeApp(root.FIREBASE_CONFIG);
    db = root.firebase.firestore();
    // Offline cache: the app still opens with the last synced data.
    db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* unsupported: fine */ });
    return db;
  }

  async function hashPasscode(passcode) {
    const bytes = new TextEncoder().encode(SALT + String(passcode).trim());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.prototype.map.call(new Uint8Array(digest), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function houseRef(houseId) {
    return getDb().collection('houses').doc(houseId);
  }

  function deviceId() {
    try {
      let id = localStorage.getItem('dormElectricitySplit.device');
      if (!id) {
        id = Math.random().toString(36).slice(2, 10);
        localStorage.setItem('dormElectricitySplit.device', id);
      }
      return id;
    } catch (e) { return 'unknown'; }
  }

  /** true / false, or throws on network / permission problems. */
  async function houseExists(houseId) {
    const snap = await houseRef(houseId).get();
    return snap.exists;
  }

  async function createHouse(houseId, initialStateJson) {
    await houseRef(houseId).set({
      state: initialStateJson || JSON.stringify({ residents: [], history: [] }),
      updatedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
      writer: deviceId(),
    });
  }

  /**
   * Resolve with { storage, stop } once the first snapshot arrives.
   * onRemote(): another device changed the data.
   * onStatus(status, error?): 'saving' | 'saved' | 'offline' | 'error'.
   */
  function connect(houseId, handlers) {
    const onRemote = handlers.onRemote || function () {};
    const onStatus = handlers.onStatus || function () {};
    const ref = houseRef(houseId);
    let cache = null;
    let pending = 0;

    const storage = {
      getItem: function (k) { return k === STORAGE_KEY ? cache : null; },
      setItem: function (k, v) {
        if (k !== STORAGE_KEY) return;
        cache = String(v);
        pending++;
        onStatus(navigator.onLine === false ? 'offline' : 'saving');
        ref.set({
          state: cache,
          updatedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
          writer: deviceId(),
        }).then(function () {
          pending--;
          if (pending === 0) onStatus('saved');
        }).catch(function (e) {
          pending--;
          onStatus('error', e);
        });
      },
      removeItem: function () {},
    };

    return new Promise(function (resolve, reject) {
      let first = true;
      const stop = ref.onSnapshot({ includeMetadataChanges: false }, function (snap) {
        if (snap.metadata.hasPendingWrites) return; // our own echo
        const next = snap.exists ? snap.data().state : null;
        if (first) {
          first = false;
          cache = next;
          onStatus(snap.metadata.fromCache ? 'offline' : 'saved');
          resolve({ storage: storage, stop: stop });
          return;
        }
        if (next !== cache) {
          cache = next;
          onRemote();
        }
        if (pending === 0) onStatus(snap.metadata.fromCache ? 'offline' : 'saved');
      }, function (e) {
        if (first) { first = false; reject(e); } else onStatus('error', e);
      });

      window.addEventListener('online', function () { if (pending === 0) onStatus('saved'); });
      window.addEventListener('offline', function () { onStatus('offline'); });
    });
  }

  root.CloudSync = {
    STORAGE_KEY: STORAGE_KEY,
    isConfigured: isConfigured,
    hashPasscode: hashPasscode,
    houseExists: houseExists,
    createHouse: createHouse,
    connect: connect,
  };
})(typeof self !== 'undefined' ? self : this);
