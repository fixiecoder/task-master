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

**task-master** is a React + TypeScript single-page app with task management, a shopping list, projects, calendar scheduling, and AI-assisted task creation/chat, backed by Firestore via `colinadams-api`.

### Auth (SSO Hub)

Authentication goes exclusively through the shared SSO Hub (`colinadams-auth`), not local Firebase sign-in. See root `../CLAUDE.md` for the full flow.

- `src/firebase.ts` — initialises the Firebase app client from `VITE_FIREBASE_*` env vars
- `src/components/AuthGate.tsx` — wraps the app root in `main.tsx`; redirects to the Hub when signed out, exchanges `customToken` from the redirect URL via `signInWithCustomToken`
- `src/App.tsx` — routes to the board, calendar, shopping, projects, and settings views once authenticated

### Data

Writes go through `colinadams-api` REST routes (`src/api.ts`'s `apiFetch`, authenticated `fetch` calls to `VITE_API_URL` with a Firebase ID token bearer header), following `circuit-visualiser/src/api.ts`'s reference pattern. Reads for tasks/shopping items/projects sync live via direct Firestore `onSnapshot` listeners (`subscribeToTasks`, `subscribeToShoppingItems`, `subscribeToProjects` in `src/api.ts`) — writes always go through the REST API, but any change lands in Firestore and the listeners pick it up immediately across devices.

Data models (`src/types.ts`):
- **Task** — the core unit: title, status (`todo`/`in_progress`/`done`), notes, `dates` (start/due/planned-work/completed entries), `estimatedMinutes`, and `projectId` (optional FK to a Project).
- **Project** — a lightweight grouping of tasks (name, optional accent `color`). A task belongs to at most one project. Deleting a project requires choosing `unassign` (tasks kept, `projectId` cleared) or `cascade` (tasks deleted too) — see `DELETE /projects/:id?onDelete=`.
- **ShoppingItem** — belongs to a task (`taskId`), denormalizes `taskTitle`, has a category and purchased state.
- **NotificationDoc**/**NotificationSettings** — morning-digest push notifications.

Offline support: `src/db.ts` caches tasks and projects in IndexedDB; `src/useTasks.ts`/`src/useProjects.ts` fall back to the cache when offline and re-subscribe live when back online.

### Key Files

| File | Role |
|------|------|
| `src/main.tsx` | Wraps `<App>` in `<AuthGate>` |
| `src/components/AuthGate.tsx` | SSO custom-token exchange |
| `src/firebase.ts` | Firebase app/auth client |
| `src/App.tsx` | Routes: board, calendar, shopping, projects, settings |
| `src/api.ts` | REST CRUD + Firestore live-sync for tasks/projects/shopping items |
| `src/db.ts` | IndexedDB offline cache (tasks, projects) |
| `src/useTasks.ts` / `src/useProjects.ts` | Data hooks: live subscription + offline fallback + optimistic updates |
| `src/components/KanbanBoard.tsx` | Main board view; drag-and-drop between status columns |
| `src/components/TaskDetail.tsx` | Task edit panel — status, dates, notes, project assignment, AI chat |
| `src/components/ProjectsView.tsx` | Project list — create/rename/delete (with unassign-or-cascade prompt) |
| `src/components/ShoppingView.tsx` | Aggregate shopping list across tasks |
