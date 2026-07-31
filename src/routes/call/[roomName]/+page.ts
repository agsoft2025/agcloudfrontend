// Disable SSR for the call page — livekit-client uses browser-only APIs
// (WebRTC, MediaStream, etc.) that are not available in the Node.js SSR
// environment. Without this, the server and client render different DOM,
// causing a Svelte hydration failure at root.svelte.
export const ssr = false;
