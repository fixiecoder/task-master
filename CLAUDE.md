# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server on port 3005
npm run build     # tsc -b + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

There are no tests.

## Architecture

**task-master** is a React + TypeScript single-page app, currently just the SSO login gate and a landing page — no task management features yet.

### Auth (SSO Hub)

Authentication goes exclusively through the shared SSO Hub (`colinadams-auth`), not local Firebase sign-in. See root `../CLAUDE.md` for the full flow.

- `src/firebase.ts` — initialises the Firebase app client from `VITE_FIREBASE_*` env vars
- `src/components/AuthGate.tsx` — wraps the app root in `main.tsx`; redirects to the Hub when signed out, exchanges `customToken` from the redirect URL via `signInWithCustomToken`
- `src/App.tsx` — landing page shown once authenticated, with a sign-out button

### Data

No Firestore or `colinadams-api` REST integration yet. When task data is added, follow `circuit-visualiser/src/api.ts` as the reference pattern: authenticated `fetch` calls to `VITE_API_URL` with a Firebase ID token bearer header, rather than reading Firestore directly from the frontend.

### Key Files

| File | Role |
|------|------|
| `src/main.tsx` | Wraps `<App>` in `<AuthGate>` |
| `src/components/AuthGate.tsx` | SSO custom-token exchange |
| `src/firebase.ts` | Firebase app/auth client |
| `src/App.tsx` | Landing page |
