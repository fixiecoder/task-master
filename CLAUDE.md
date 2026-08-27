# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file current.** After making changes, check whether they add a new capability, file, data model field, or architectural pattern, or change/remove something this file describes. If so, update the relevant section(s) in the same session — don't leave it for a later pass. Small internal refactors that don't change the shape described here don't need an update.

## Commands

```bash
npm run dev       # Start Vite dev server on port 3005
npm run build     # tsc -b + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

There are no tests.

## Architecture

**task-master** is a React 19 + TypeScript installable PWA with task management, standalone lists, projects, calendar scheduling, AI-assisted task creation/chat, and push notifications — backed by Firestore via `colinadams-api`, with an offline-first read/write path (IndexedDB cache + retrying outbox).

### Auth (SSO Hub)

Authentication goes exclusively through the shared SSO Hub (`colinadams-auth`), not local Firebase sign-in. See root `../CLAUDE.md` for the full flow.

- `src/firebase.ts` — initialises the Firebase app client from `VITE_FIREBASE_*` env vars
- `src/components/AuthGate.tsx` — wraps the app root in `main.tsx`; redirects to the Hub when signed out, exchanges `customToken` from the redirect URL via `signInWithCustomToken`
- `src/App.tsx` — `react-router-dom` routes to the board, calendar, lists, list detail, projects, and settings views once authenticated

### Data

Writes go through `colinadams-api` REST routes (`src/api.ts`'s `apiFetch`, authenticated `fetch` calls to `VITE_API_URL` with a Firebase ID token bearer header), following `circuit-visualiser/src/api.ts`'s reference pattern. Reads for tasks/lists/list items/projects sync live via direct Firestore `onSnapshot` listeners (`subscribeToTasks`, `subscribeToLists`, `subscribeToListItems`, `subscribeToProjects` in `src/api.ts`) — writes always go through the REST API, but any change lands in Firestore and the listeners pick it up immediately across devices.

Data models (`src/types.ts`):
- **Task** — the core unit: title, status (`todo`/`in_progress`/`done`), notes, `dates` (start/due/planned-work/completed entries), `estimatedMinutes`, `projectId` (optional FK to a Project), `listId` (optional FK to a List — explicit link, set from the task's detail page, not auto-created), and `source` — set (non-null) only when the task was created by another spoke app (e.g. `video-planner`) rather than in task-master itself, identifying the originating app/script/version/shot-block.
- **Project** — a lightweight grouping of tasks (name, optional accent `color`). A task belongs to at most one project. Deleting a project requires choosing `unassign` (tasks kept, `projectId` cleared) or `cascade` (tasks deleted too) — see `DELETE /projects/:id?onDelete=`.
- **List** — a standalone, first-class collection (`shopping` / `todo` / `checklist` / `stock`), independent of any task, with an optional `projectId` for grouping lists under a project (same unassign-style semantics as tasks, not tied to a task at all). A `shopping` list always has a paired `stock` list (`pairedListId`, symmetric), auto-created alongside it — checking off a shopping item moves it to the paired stock list rather than flipping a boolean. `todo`/`checklist` never pair; `checklist` is otherwise identical to `todo`. `stock` can't be created directly, only as a shopping list's pair.
- **ListItem** — belongs to a list (`listId`), has a `category` (shopping/stock only) and a `checked` boolean (todo/checklist only — shopping/stock items instead move between the paired lists).
- **NotificationDoc**/**NotificationSettings** — morning-digest push notifications, delivered via FCM (see Notifications below).

### AI assistance

Two separate AI surfaces, both backed by `colinadams-api`:
- **Global prompt bar** (`src/components/PromptBar.tsx`, always docked at the bottom while online) — free-text commands ("remind me to...", "add milk and eggs to shopping") sent via `sendPrompt` (`POST /tasks/prompt`) that can create/update tasks or list items; supports multi-turn `conversationId` threading and an `askDuration` follow-up (quick-pick hour buttons) when the assistant needs an estimate to finish the request.
- **Per-task chat** (`TaskDetail.tsx`, via `sendTaskChatMessage`/`listTaskConversations`/`getTaskConversation`) — a conversation thread scoped to one task, with a "smart mode" toggle and the ability to update the task's notes as a side effect of the reply.

### Offline support & sync

- `src/db.ts` — IndexedDB cache for tasks, projects, lists, list items, and the outbox (see below); `src/useTasks.ts`/`src/useProjects.ts`/`src/useLists.ts`/`src/useListItems.ts` fall back to this cache when offline and re-subscribe live when back online.
- `src/api.ts`'s `queue*` functions (`queueCreateTask`, `queueUpdateTask`, `queueAddListItems`, `queueCheckListItem`, etc.) apply an optimistic update to the cache immediately, generating a temp id for creates, then hand the network call to `src/syncQueue.ts`.
- `src/syncQueue.ts` (`syncWithRetry`/`replayOutbox`) retries a failed mutation with exponential backoff (capped at 30s) purely on network errors, persists it to the IndexedDB outbox until it lands, and re-drives anything still pending at startup or on the `online` event — so an offline edit survives a reload or the PWA being killed.
- `src/outbox.ts` (`dispatchMutation`) is the replay-side counterpart: it maps each queued mutation kind back to the real API call for `replayOutbox` to invoke.

### PWA & push notifications

Task-master is an installable PWA (`vite-plugin-pwa` + Workbox, configured in `vite.config.ts`). `src/sw.ts` is the custom service worker: it precaches the app shell, serves a navigation fallback for client-side routes when offline, and — via `firebase/messaging/sw` — shows OS-level notifications for FCM pushes received in the background. `src/notifications.ts` handles the foreground side (enabling/disabling push via `enablePushNotifications`/`disablePushNotifications`, which registers an FCM token under `users/{uid}/fcmTokens`), plus Firestore-backed in-app notifications (`NotificationDoc`) and per-user `NotificationSettings` (morning-digest reminder time/timezone/enabled). The morning digest itself is sent by a scheduled function in `colinadams-api`; `runDigestNow()` lets a user trigger it manually to test the pipeline.

### Key Files

| File | Role |
|------|------|
| `src/main.tsx` | Wraps `<App>` in `<AuthGate>` |
| `src/components/AuthGate.tsx` | SSO custom-token exchange |
| `src/firebase.ts` | Firebase app/auth client |
| `src/App.tsx` | Routes: board, calendar, lists, list detail, projects, settings |
| `src/api.ts` | REST CRUD, Firestore live-sync, and optimistic `queue*` mutation wrappers for tasks/projects/lists/list items/AI chat |
| `src/db.ts` | IndexedDB offline cache (tasks, projects, lists, list items, outbox) |
| `src/syncQueue.ts` / `src/outbox.ts` | Retry-with-backoff mutation queue and its replay dispatcher |
| `src/sw.ts` | Custom service worker: offline app-shell fallback + background push notifications |
| `src/notifications.ts` | FCM token registration, in-app notification feed, notification settings |
| `src/useTasks.ts` / `src/useProjects.ts` / `src/useLists.ts` / `src/useListItems.ts` / `src/useNotifications.ts` | Data hooks: live subscription + offline fallback + optimistic updates |
| `src/components/KanbanBoard.tsx` | Main board view; drag-and-drop between status columns; project filtering |
| `src/components/CalendarPage.tsx` | Calendar scheduling view — day detail, unscheduled-task picker, start-date prompts |
| `src/components/TaskDetail.tsx` | Task edit panel — status, dates, notes, project assignment, linked list, per-task AI chat |
| `src/components/PromptBar.tsx` | Global AI prompt bar — free-text task/list commands, multi-turn conversation |
| `src/components/ProjectsView.tsx` / `ProjectFilter.tsx` | Project list (create/rename/delete with unassign-or-cascade prompt) and board/list filtering by project |
| `src/components/ListsView.tsx` / `ListModal.tsx` / `DeleteListModal.tsx` | Top-level list-of-lists view — create/edit/delete lists, including project association |
| `src/components/ListDetailView.tsx` | Single list's items, at `/lists/:id` |
| `src/components/ListItemsPanel.tsx` | Shared list-items UI, used standalone and embedded in `TaskDetail` |
| `src/components/QuickAddTaskModal.tsx` | Deep-link-triggered quick-add modal for tasks/list items |
| `src/components/NotificationsTray.tsx` / `NotificationSettings.tsx` | In-app notification feed and morning-digest settings UI |
