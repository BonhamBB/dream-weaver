/**
 * Firebase Auth + Firestore cloud sync module for Dream Weaver
 *
 * Set the following environment variables in your .env file:
 *   VITE_FIREBASE_API_KEY=your-api-key
 *   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
 *   VITE_FIREBASE_PROJECT_ID=your-project-id
 *   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
 *   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
 *   VITE_FIREBASE_APP_ID=your-app-id
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FirebaseUser = Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'>;

export interface Identifiable {
  id: string;
  createdAt: string | number;
}

// ---------------------------------------------------------------------------
// Firebase configuration
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'PLACEHOLDER_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'PLACEHOLDER.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'PLACEHOLDER_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'PLACEHOLDER.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? 'PLACEHOLDER_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'PLACEHOLDER_APP_ID',
};

/**
 * Returns true when the Firebase API key is set to a real value (i.e. not the
 * placeholder). Use this to gate any Firebase-dependent UI or logic.
 */
export function isFirebaseConfigured(): boolean {
  return (
    typeof firebaseConfig.apiKey === 'string' &&
    firebaseConfig.apiKey.length > 0 &&
    firebaseConfig.apiKey !== 'PLACEHOLDER_API_KEY'
  );
}

// ---------------------------------------------------------------------------
// Lazy initialisation – only create the app / auth / db when actually needed
// and only when Firebase is configured.
// ---------------------------------------------------------------------------

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

function auth() {
  return getAuth(getApp());
}

function db() {
  return getFirestore(getApp());
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Sign in with a Google popup. Returns the Firebase User on success, or null
 * if the sign-in was cancelled / failed.
 */
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth(), provider);
    return toFirebaseUser(result.user);
  } catch (error) {
    console.error('[Dream Weaver] Google sign-in failed:', error);
    return null;
  }
}

/**
 * Sign in anonymously. Useful as a fallback so users can still save data
 * without creating an account.
 */
export async function signInAnonymously(): Promise<FirebaseUser | null> {
  try {
    const result = await firebaseSignInAnonymously(auth());
    return toFirebaseUser(result.user);
  } catch (error) {
    console.error('[Dream Weaver] Anonymous sign-in failed:', error);
    return null;
  }
}

/**
 * Sign the current user out.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth());
  } catch (error) {
    console.error('[Dream Weaver] Sign-out failed:', error);
  }
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth(), (user) => {
    callback(user ? toFirebaseUser(user) : null);
  });
}

/**
 * Returns the current user synchronously, or null if not signed in.
 */
export function getCurrentUser(): FirebaseUser | null {
  const user = auth().currentUser;
  return user ? toFirebaseUser(user) : null;
}

// ---------------------------------------------------------------------------
// Firestore sync – Stories
// ---------------------------------------------------------------------------

/**
 * Save the user's stories array to Firestore.
 * Path: users/{userId}/data/stories
 */
export async function syncStoriesToCloud(userId: string, stories: unknown[]): Promise<void> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'stories');
    await setDoc(ref, { items: stories, updatedAt: Date.now() });
  } catch (error) {
    console.error('[Dream Weaver] Failed to sync stories to cloud:', error);
  }
}

/**
 * Load the user's stories array from Firestore.
 * Returns an empty array when no data exists or on failure.
 */
export async function loadStoriesFromCloud(userId: string): Promise<unknown[]> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'stories');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return (snap.data().items as unknown[]) ?? [];
    }
    return [];
  } catch (error) {
    console.error('[Dream Weaver] Failed to load stories from cloud:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Firestore sync – Favorites
// ---------------------------------------------------------------------------

/**
 * Save the user's favorite story IDs to Firestore.
 * Path: users/{userId}/data/favorites
 */
export async function syncFavoritesToCloud(userId: string, favoriteIds: string[]): Promise<void> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'favorites');
    await setDoc(ref, { ids: favoriteIds, updatedAt: Date.now() });
  } catch (error) {
    console.error('[Dream Weaver] Failed to sync favorites to cloud:', error);
  }
}

/**
 * Load the user's favorite story IDs from Firestore.
 * Returns an empty array when no data exists or on failure.
 */
export async function loadFavoritesFromCloud(userId: string): Promise<string[]> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'favorites');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return (snap.data().ids as string[]) ?? [];
    }
    return [];
  } catch (error) {
    console.error('[Dream Weaver] Failed to load favorites from cloud:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Firestore sync – Ratings
// ---------------------------------------------------------------------------

/**
 * Save the user's story ratings to Firestore.
 * Path: users/{userId}/data/ratings
 */
export async function syncRatingsToCloud(
  userId: string,
  ratings: Record<string, number>,
): Promise<void> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'ratings');
    await setDoc(ref, { ratings, updatedAt: Date.now() });
  } catch (error) {
    console.error('[Dream Weaver] Failed to sync ratings to cloud:', error);
  }
}

/**
 * Load the user's story ratings from Firestore.
 * Returns an empty object when no data exists or on failure.
 */
export async function loadRatingsFromCloud(userId: string): Promise<Record<string, number>> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'ratings');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return (snap.data().ratings as Record<string, number>) ?? {};
    }
    return {};
  } catch (error) {
    console.error('[Dream Weaver] Failed to load ratings from cloud:', error);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Firestore sync – Child Profiles
// ---------------------------------------------------------------------------

/**
 * Save the user's child profiles to Firestore.
 * Path: users/{userId}/data/profiles
 */
export async function syncChildProfilesToCloud(
  userId: string,
  profiles: unknown[],
): Promise<void> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'profiles');
    await setDoc(ref, { items: profiles, updatedAt: Date.now() });
  } catch (error) {
    console.error('[Dream Weaver] Failed to sync child profiles to cloud:', error);
  }
}

/**
 * Load the user's child profiles from Firestore.
 * Returns an empty array when no data exists or on failure.
 */
export async function loadChildProfilesFromCloud(userId: string): Promise<unknown[]> {
  try {
    const ref = doc(db(), 'users', userId, 'data', 'profiles');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return (snap.data().items as unknown[]) ?? [];
    }
    return [];
  } catch (error) {
    console.error('[Dream Weaver] Failed to load child profiles from cloud:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/**
 * Merge local and cloud arrays of items that have `id` and `createdAt` fields.
 * When an item exists in both sets the version with the newest `createdAt` wins.
 * Items that only exist in one set are included as-is.
 */
export function mergeLocalAndCloud<T extends Identifiable>(local: T[], cloud: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of cloud) {
    merged.set(item.id, item);
  }

  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing || toTimestamp(item.createdAt) >= toTimestamp(existing.createdAt)) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toFirebaseUser(user: User): FirebaseUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function toTimestamp(value: string | number): number {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
