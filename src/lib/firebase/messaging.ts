/**
 * src/lib/firebase/messaging.ts
 *
 * Safe, lazy-initialised Firebase Cloud Messaging wrapper.
 * Imports directly from @firebase/app + @firebase/messaging (the canonical
 * underlying packages) because the firebase/* re-export subpackages have
 * missing type declaration paths in some install environments.
 *
 * Required env vars (set in .env / deployment secrets):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY   (Web Push certificate from Firebase Console)
 *
 * If any required var is missing the module degrades gracefully:
 *   isMessagingSupported() → false
 *   getMessagingToken()    → null
 */

import { browser } from '$app/environment';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
  type Messaging,
} from '@firebase/messaging';

// ── Config ─────────────────────────────────────────────────────────────────────

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function getFirebaseConfig(): FirebaseConfig | null {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
  } = import.meta.env;

  if (
    !VITE_FIREBASE_API_KEY ||
    !VITE_FIREBASE_AUTH_DOMAIN ||
    !VITE_FIREBASE_PROJECT_ID ||
    !VITE_FIREBASE_STORAGE_BUCKET ||
    !VITE_FIREBASE_MESSAGING_SENDER_ID ||
    !VITE_FIREBASE_APP_ID
  ) {
    return null;
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY as string,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: VITE_FIREBASE_APP_ID as string,
  };
}

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// ── Singleton state ────────────────────────────────────────────────────────────

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let initAttempted = false;

async function ensureInitialised(): Promise<Messaging | null> {
  if (initAttempted) return messaging;
  initAttempted = true;

  const config = getFirebaseConfig();
  if (!config) {
    console.warn('[Firebase] Missing env vars — push notifications unavailable.');
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Firebase] Cloud Messaging is not supported in this browser.');
      return null;
    }

    // Reuse an existing Firebase app if one was already initialised (e.g. HMR)
    app = getApps()[0] ?? initializeApp(config);
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error('[Firebase] Initialisation failed:', err);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Quick synchronous pre-flight check.
 * Returns true when running in a browser AND all required env vars are set.
 * The full async FCM-support check happens inside getMessagingToken().
 */
export function isMessagingSupported(): boolean {
  if (!browser) return false;
  return getFirebaseConfig() !== null;
}

/**
 * Request an FCM registration token.
 * Returns null if SSR / env vars missing / browser unsupported / permission denied.
 */
export async function getMessagingToken(): Promise<string | null> {
  if (!browser) return null;

  const m = await ensureInitialised();
  if (!m) return null;

  try {
    const token = await getToken(m, vapidKey ? { vapidKey } : undefined);
    return token || null;
  } catch (err) {
    // NotAllowedError when permission is denied — not a fatal crash
    console.error('[Firebase] getToken failed:', err);
    return null;
  }
}

/**
 * Delete the current FCM token so the backend stops pushing to this device.
 * Silent no-op if messaging is not initialised.
 */
export async function deleteMessagingToken(): Promise<void> {
  if (!browser) return;

  const m = await ensureInitialised();
  if (!m) return;

  try {
    await deleteToken(m);
  } catch (err) {
    console.error('[Firebase] deleteToken failed:', err);
  }
}
