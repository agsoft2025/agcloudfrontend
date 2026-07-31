# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite HMR)
npm run build      # production build
npm run preview    # preview production build locally
npm run check      # svelte-kit sync + svelte-check + TypeScript type-check
```

There is no lint or test script configured in `package.json` yet. The status report (`documents/Frontend-Status-Report.md`) references Vitest unit tests and Playwright E2E tests that exist on the `dev` branch but are not yet wired into this scaffold.

`.npmrc` sets `engine-strict=true` — ensure your Node version satisfies the engine field before installing.

## Architecture

**Stack:** SvelteKit 2 · Svelte 5 · TypeScript 5 (strict) · Vite 8 · `@sveltejs/adapter-auto`

This is the `main` branch scaffold. The `dev` branch (`agsoft2025/agcloudfrontend`) contains the in-progress application. Read `documents/Frontend-Status-Report.md` for a detailed map of what is built, what is broken, and sprint priorities before adding features.

### Planned structure (from dev branch / status report)

```
src/
  routes/
    (auth)/         # /signin /signup /forgot-password /reset-password
    (app)/          # /home /contacts /calls /settings (most missing — see report)
  lib/
    components/
      atoms/        # Button, Input, Avatar, Badge, Skeleton, Spinner, etc.
      molecules/    # Modal, Toast, VideoTile, CallControls, IncomingCallOverlay, etc.
      call/         # CallWorkspace, CallSession, AcceptCallForm, ParticipantTile, etc.
    livekit/
      LiveKitClient.ts   # singleton room manager — the canonical LiveKit layer
    service/
      livekit.ts    # DEAD CODE — duplicates LiveKitClient.ts, delete when merging
    stores/         # auth.store, call.store, theme.store, toast.store, user.store
    api/            # client.ts (axios), auth.api.ts, calls.api.ts (user.api.ts missing)
```

### Key architectural decisions and known issues

- **Auth token mismatch (critical blocker):** Backend sets an httpOnly cookie; frontend reads `accessToken` from localStorage. Must agree on cookie (`withCredentials: true`, drop Authorization header injection) vs body token before any API call works.
- **Toast system:** `toast.store.ts` is wired but `Toast.svelte` is never mounted in `+layout.svelte` — toasts are silently dropped.
- **LiveKit:** `adaptiveStream` and `dynacast` are hardcoded `false` in `CallWorkspace.svelte` — must be enabled for production quality.
- **Incoming calls:** `IncomingCallOverlay` is built but has no trigger — no WebSocket/SSE/push channel exists yet.
- **API client:** Uses `axios` (runtime dep) instead of the spec's native fetch wrapper — acceptable but adds ~13 KB to bundle.
- **Environment variables:** `VITE_API_BASE_URL` (backend) and `VITE_LIVEKIT_URL` (must be `ws://`, not `http://`).
- **`.bak` files:** Stale backup files exist under `src/routes/(app)/` and `src/routes/(auth)/` on dev branch — delete them.

### SvelteKit path alias

`$lib` resolves to `src/lib` (standard SvelteKit convention, enforced by `.svelte-kit/tsconfig.json`).
