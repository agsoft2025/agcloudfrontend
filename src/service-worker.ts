/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

// ── Cache names ───────────────────────────────────────────────────────────────

/** Versioned shell cache — rotated on every deploy. */
const SHELL_CACHE = `agcloud-shell-${version}`;

/** Long-lived static asset cache — keyed by content hash, not version. */
const STATIC_CACHE = `agcloud-static-${version}`;

const OFFLINE_URL = '/offline';

// ── Precache manifest ─────────────────────────────────────────────────────────

/**
 * Assets that must be cached during install so they are always available,
 * even on the first offline visit.
 *
 * build       — hashed JS/CSS chunks produced by Vite
 * files       — contents of /static (images, fonts, manifest, favicon …)
 * prerendered — any statically rendered SvelteKit pages
 * /offline    — offline fallback page (MUST be here)
 */
const PRECACHE_URLS = new Set([
  ...build,
  ...files,
  ...prerendered,
  '/manifest.webmanifest',
  '/favicon.png',
  OFFLINE_URL
]);

// ── Static-asset extensions (cache-first) ─────────────────────────────────────

const STATIC_EXTS = new Set([
  '.js', '.mjs', '.cjs',
  '.css',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.mp4', '.webm', '.mp3', '.ogg',
  '.json'
]);

function hasStaticExtension(pathname: string): boolean {
  const dot = pathname.lastIndexOf('.');
  if (dot === -1) return false;
  return STATIC_EXTS.has(pathname.slice(dot));
}

/**
 * Returns true for requests that should NEVER be cached:
 *   - Authenticated API calls to the backend origin
 *   - LiveKit / third-party WebSocket upgrade requests
 *   - Any non-GET request
 */
function isApiRequest(url: URL): boolean {
  const p = url.pathname;
  return (
    p.startsWith('/auth/') ||
    p.startsWith('/users/') ||
    p.startsWith('/calls/') ||
    p.startsWith('/livekit/') ||
    p.startsWith('/socket.io/') ||
    p.startsWith('/api/')
  );
}

// ── Install — precache everything ─────────────────────────────────────────────

self.addEventListener('install', (event: ExtendableEvent) => {
  // Activate immediately; old SW is replaced without waiting for tabs to close.
  self.skipWaiting();

  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll is atomic: if any URL fails, the install fails and the SW is
      // discarded. /offline must never 404 or the whole install aborts.
      cache.addAll(Array.from(PRECACHE_URLS))
    )
  );
});

// ── Activate — evict stale versioned caches ───────────────────────────────────

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch — main routing logic ────────────────────────────────────────────────

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Only intercept GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (backend API, LiveKit server, CDN assets …).
  // Those URLs never match self.location.origin so they flow through unchanged.
  if (url.origin !== self.location.origin) return;

  // During local development the SW should be transparent so HMR works.
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]'
  ) {
    return;
  }

  // ── Strategy A: API / authenticated data — Network Only ──────────────────
  // Never serve stale user data from cache; if offline let the app handle it.
  if (isApiRequest(url)) {
    return; // fall through to browser fetch — app error handling takes over
  }

  // ── Strategy B: Navigation requests — Network First, /offline fallback ───
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // ── Strategy C: Precached shell assets — Cache First ─────────────────────
  if (PRECACHE_URLS.has(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // ── Strategy D: Static assets by extension — Cache First (long-lived) ────
  if (hasStaticExtension(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Strategy E: Everything else — Network First ───────────────────────────
  event.respondWith(networkFirst(request));
});

// ── Strategy implementations ──────────────────────────────────────────────────

/**
 * Navigation (HTML page) handler.
 *
 * 1. Try the network — get the freshest version of the page.
 * 2. If the network succeeds, cache and return it.
 * 3. If the network fails (offline / timeout), look in the shell cache.
 * 4. If even the cache misses, serve the offline page.
 */
async function navigationHandler(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);

    // Cache successful navigation responses so subsequent offline visits work.
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    // Network failed — try the shell cache first.
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Final fallback: return the offline page.
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    // This should never happen (offline page is always precached),
    // but return a bare HTML response rather than letting the request fail.
    return new Response(
      '<!doctype html><title>Offline</title><p>You are offline.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Cache First — ideal for versioned/hashed static assets.
 * Serves from cache instantly; populates the cache on a cache miss.
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Asset unavailable offline; return an empty 503.
    return new Response(null, { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network First — ideal for pages that change frequently.
 * Falls back to cache on failure; does not serve the offline page
 * (that is handled exclusively by navigationHandler).
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(null, { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Push notifications ────────────────────────────────────────────────────────────────────────────────

/**
 * Metadata carried by an incoming-call push notification.
 *
 * Backends may send the payload in two shapes:
 *   • Flat:  { title, body, callId, callerName, … }
 *   • FCM:   { notification: { title, body }, data: { callId, callerName, … } }
 * Both are normalised into this type before the notification is shown.
 */
interface CallPushData {
  /** Notification title (e.g. "Incoming call from Alice"). */
  title?: string;
  /** Notification body (e.g. "Alice is calling you"). */
  body?: string;
  /** Opaque call ID — passed to accept/reject API endpoints. */
  callId?: string;
  /** Unique identity of the caller. */
  callerId?: string;
  /** Display name shown prominently in the notification. */
  callerName?: string;
  /** 'audio' | 'video' */
  callType?: string;
  /** LiveKit room name — used to build the /call/:roomName URL on click. */
  roomName?: string;
  /** Direct URL to open when the user taps the notification (optional). */
  meetingUrl?: string;
  /** Deduplication tag — prevents stacking multiple call notifications. */
  tag?: string;
  /** Icon URL override (falls back to /favicon.png). */
  icon?: string;
  /** Resolved URL opened on notification click — computed in handlePush. */
  url?: string;
}

/** Safely coerce an unknown value to string; returns undefined for nullish. */
function safeString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/**
 * Parse an incoming push payload into a CallPushData object.
 *
 * Accepts both flat and FCM-style ({ notification, data }) payloads.
 * Always returns a valid object — never throws.
 */
function parsePushPayload(raw: Record<string, unknown>): CallPushData {
  // FCM wraps notification fields under "notification" and custom data under "data".
  const notif =
    raw['notification'] !== null &&
    typeof raw['notification'] === 'object'
      ? (raw['notification'] as Record<string, unknown>)
      : {};

  const data =
    raw['data'] !== null &&
    typeof raw['data'] === 'object'
      ? (raw['data'] as Record<string, unknown>)
      : raw; // flat payload — treat the whole object as data

  return {
    title:      safeString(notif['title']      ?? data['title']),
    body:       safeString(notif['body']       ?? data['body']),
    callId:     safeString(data['callId']),
    callerId:   safeString(data['callerId']),
    callerName: safeString(data['callerName']),
    callType:   safeString(data['callType']),
    roomName:   safeString(data['roomName']),
    meetingUrl: safeString(data['meetingUrl']),
    tag:        safeString(data['tag']),
    icon:       safeString(data['icon']),
  };
}

/**
 * Handle an incoming push event:
 *   1. Parse the payload (safely — bad payloads show a generic notification).
 *   2. Build notification options from the call metadata.
 *   3. Show the notification via self.registration.showNotification().
 */
async function handlePush(event: PushEvent): Promise<void> {
  let payload: CallPushData = {};

  try {
    if (event.data) {
      const raw = event.data.json() as Record<string, unknown>;
      payload = parsePushPayload(raw);
    }
  } catch (err) {
    // Malformed JSON — log for debugging but still show a generic notification.
    console.error('[SW] Failed to parse push payload:', err);
  }

  const callerName = payload.callerName || 'Someone';
  const callType   = payload.callType === 'video' ? 'Video' : 'Audio';
  const title      = payload.title || `${callType} call from ${callerName}`;
  const body       = payload.body  || `${callerName} is calling you`;
  const tag        = payload.tag   || `incoming-call-${payload.callId ?? Date.now()}`;
  const icon       = payload.icon  || '/favicon.png';

  // Resolve the URL that notificationclick will open.
  const url =
    payload.meetingUrl ??
    (payload.roomName ? `/call/${encodeURIComponent(payload.roomName)}` : '/');

  // Store all call metadata in data so notificationclick can forward it to
  // the app client (e.g. to trigger the in-app IncomingCallOverlay).
  const notificationData: CallPushData = { ...payload, url };

  await self.registration.showNotification(title, {
    body,
    icon,
    badge:              '/favicon.png',
    tag,
    renotify:           true,  // re-alert even if a notification with the same tag exists
    requireInteraction: true,  // keep the notification on-screen until the user acts
    vibrate:            [200, 100, 200, 100, 200], // three pulses — standard call pattern
    timestamp:          Date.now(),
    data:               notificationData,
  } as NotificationOptions);
}

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(handlePush(event));
});

// ── Notification click ────────────────────────────────────────────────────────────────────────────────

/**
 * Handle a click on a push notification:
 *   1. Close the notification immediately.
 *   2. Focus an existing app window and forward the call metadata, OR
 *   3. Open a new window at the call/app URL if no window is open.
 */
async function handleNotificationClick(notification: Notification): Promise<void> {
  notification.close();

  const data = notification.data as CallPushData | null;
  const url  = data?.url ?? '/';

  // Look for any open window controlled by this service worker.
  const windowClients = await self.clients.matchAll({
    type:                'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    // Forward the call metadata so the app can display IncomingCallOverlay.
    client.postMessage({ type: 'incoming-call-notification', data });

    if ('focus' in client) {
      await (client as WindowClient).focus();
      return;
    }
  }

  // No open window — open the app at the call URL.
  await self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.waitUntil(handleNotificationClick(event.notification));
});
