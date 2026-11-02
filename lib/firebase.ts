import { type Analytics, getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  type Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = getAuth(app);
/**
 * Firestore keeps a copy of the user's data in IndexedDB, so habits load with
 * no signal and taps made offline survive closing the app; queued writes
 * upload on their own once the device is back online. The multi-tab manager
 * lets several open tabs share that cache. On the server (no IndexedDB) and
 * on a hot reload (already initialised) it falls back to what exists.
 */
function createDb(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache:
        typeof window === "undefined"
          ? memoryLocalCache()
          : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = createDb();
export const googleProvider = new GoogleAuthProvider();

let analyticsPromise: Promise<Analytics | null> | null = null;

// Analytics requires the browser environment and isn't supported everywhere
// (e.g. SSR, some browsers), so it must be resolved lazily and asynchronously.
export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported().then((supported) =>
      supported ? getAnalytics(app) : null
    );
  }
  return analyticsPromise;
}
