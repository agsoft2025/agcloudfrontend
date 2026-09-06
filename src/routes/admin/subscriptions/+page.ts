// Admin subscriptions page uses browser-only Razorpay-related UI — disable SSR
// to avoid unnecessary server rendering and browser-API leakage at SSR time.
export const ssr = false;
export const prerender = false;
