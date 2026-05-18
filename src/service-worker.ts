/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered } from '$service-worker';

const CACHE = 'agcloud-cache-v1';

const ASSETS = [
  ...build,
  ...files,
  ...prerendered,
  '/',
  '/manifest.webmanifest',
  '/favicon.svg'
];

self.addEventListener('install', ((event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
}) as EventListener);

self.addEventListener('activate', ((event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
}) as EventListener);

self.addEventListener('fetch', ((event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (
          event.request.method === 'GET' &&
          response.status === 200
        ) {
          const responseClone = response.clone();

          caches.open(CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      });
    })
  );
}) as EventListener);
