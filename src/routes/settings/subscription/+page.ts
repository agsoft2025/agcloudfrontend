// Subscription page uses browser-only Razorpay checkout script and has no
// meaningful server-rendered content — disable SSR to avoid unnecessary
// Node.js rendering and eliminate any risk of browser-API leakage at SSR time.
export const ssr = false;
export const prerender = false;
