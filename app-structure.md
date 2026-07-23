# Task Master — App Structure

Plan for the backend + AI-prompt architecture. Scope for this pass: **create, retrieve, and update tasks**, both via a plain REST API and via a natural-language prompt endpoint that uses Claude tool-calling to decide what to do. No deleting or AI-driven status transitions yet, and no email/calendar tools yet — those are called out as the shape the tool-calling loop is built to grow into, not built now.

## 1. Data model (Firestore)

Following the existing `colinadams-api` convention (`circuits.ts`): task-master data lives under `/users/{uid}/tasks/{taskId}`, namespaced by app just like `/users/{uid}/circuits/{circuitId}`.

```
/users/{uid}/tasks/{taskId}
  id: string              # == doc id, denormalized like circuits.ts does
  title: string
  status: "todo" | "in_progress" | "done"   # kanban columns
  notes: string | null   # markdown
  createdAt: Timestamp
  updatedAt: Timestamp
```

Kept deliberately small. No due dates, priorities, or tags yet — add fields when the frontend actually needs them rather than speculatively.

`notes` holds markdown text and can be much larger than a title — a Firestore string field is fine for this up to the ~1MB per-document limit, but two things to set up once the collection exists: exclude `notes` from single-field indexing in the Firestore console (Firestore auto-indexes every field by default, truncating strings at ~1,500 bytes for the index — wasted write cost for a free-text field nothing will ever query by exact value), and don't treat the field as unbounded (it's for task notes, not for pasting whole documents/logs into).

`firestore.rules` already covers this for free: `/users/{userId}/**` is restricted to `request.auth.uid == userId`, so no rule changes are needed to onboard the `tasks` subcollection.

## 2. REST API (`colinadams-api/functions/src/routes/tasks.ts`)

New Express router, mounted as `app.use("/tasks", tasksRouter)` in `app.ts` — same shape as `circuitsRouter`. Protected by the existing `validateFirebaseIdToken` middleware (already applied globally before route mounting).

| Method | Path | Body | Behavior |
|---|---|---|---|
| `GET` | `/tasks` | — | List all tasks for `req.user.uid`, ordered by `updatedAt desc` |
| `GET` | `/tasks/:id` | — | Fetch one task |
| `POST` | `/tasks` | `{ title, status?, notes? }` | Create a task (`status` defaults to `"todo"`) |
| `PUT` | `/tasks/:id` | `{ title?, status?, notes? }` | Update a task — needed by the Kanban board for drag-and-drop status changes and for editing the markdown notes, even though the latter isn't part of the AI tool surface yet |

This mirrors `circuits.ts` almost exactly (create with server timestamps, 404 on missing doc, `try/catch` → 500). The frontend Kanban board talks to these endpoints directly — it does not need to go through the AI at all for normal use.

`DELETE /tasks/:id` is left out for now since it's not part of the requested scope; add it alongside the board's delete affordance when that's built.

## 3. AI prompt endpoint (`POST /tasks/prompt`)

This is the "new task, paint the kitchen wall" / "what tasks do I have" entry point. It lives in the same `tasks.ts` router since it operates on the same resource.

### Request / response shape

```
POST /tasks/prompt
{ "message": "new task, paint the kitchen wall" }

→ 200 { "reply": "Created \"Paint the kitchen wall\".", "taskIds": ["abc123"] }
```

`reply` is a short natural-language confirmation for the frontend to show. `taskIds` is optional/best-effort — populated with the id(s) touched by any `create_task` or `update_task` tool call, so the UI can highlight the affected card without a full refetch.

### Why a manual tool-use loop, not the Tool Runner or Managed Agents

- **Managed Agents** is the wrong tier here — no sandboxed container, bash, or file access is needed, and standing up agent/environment/session objects for "call a Firestore function and reply" is pure overhead.
- The **beta Tool Runner** (`client.beta.messages.toolRunner`) is a reasonable choice long-term, but a **manual loop** is simpler to reason about for a small, fixed tool set inside an Express handler and avoids a beta dependency in a backend that otherwise has none (`llm.ts` uses the plain `client.messages.create`). Revisit once the tool count grows past what's comfortable to hand-loop.
- Model: reuse `llm.ts`'s existing default, **`claude-sonnet-5`**, for consistency with the rest of the API rather than introducing a second model default. Task classification/routing doesn't need Opus-tier reasoning.

### The loop

```
1. POST /tasks/prompt { message }
2. Build messages = [{ role: "user", content: message }]
3. Call client.messages.create({ model, max_tokens, system, tools, messages })
4. If stop_reason == "tool_use":
     - execute each tool_use block against Firestore (functions defined below)
     - append the assistant turn (response.content) to messages
     - append a user turn with one tool_result per tool_use block
     - go to 3
5. If stop_reason == "end_turn":
     - return the final text block as `reply`, plus any taskIds collected along the way
```

Capped at a small `max_iterations` (e.g. 4) to avoid a runaway loop. Most requests resolve in 1–2 tool calls (`create_task`, or `list_tasks` to answer a question); a request that updates a task by topic rather than id — e.g. "note that I want navy blue paint for the kitchen task" — takes 2, `list_tasks` (or `get_task` once the id is known) to find the task and its current notes, then `update_task` with the merged text.

### System prompt (sketch)

```
You are Task Master's assistant. The user is talking to a task-tracking app.
Use create_task to add new tasks, list_tasks / get_task to answer questions
about existing ones, and update_task to change an existing task's title,
status, or notes. Task titles should be a short imperative phrase —
trim filler words like "new task," from what the user says.

The user will often refer to a task by topic rather than by id (e.g. "the
kitchen task"). Before calling update_task, call list_tasks (or get_task if
you already have the id) to find the matching task and its current notes.
If more than one task plausibly matches, ask the user to clarify instead of
guessing.

When asked to add or note something on an existing task, treat it as an
addition, not a replacement: pass update_task a notes value equal to the
task's current notes with the new note appended (as a new line or bullet),
not just the new note by itself. If the task has no notes yet, the new note
becomes the whole notes field.

After acting, reply with a brief one-sentence confirmation of what you did,
not a restatement of the tool output.
```

### Tools for this pass

```json
[
  {
    "name": "create_task",
    "description": "Create a new task for the user. Call this when the user describes something they want to track or asks to add/create a task.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "description": "Short imperative task title, e.g. 'Paint the kitchen wall'" },
        "notes": { "type": "string", "description": "Optional extra detail the user gave, as markdown" }
      },
      "required": ["title"]
    }
  },
  {
    "name": "list_tasks",
    "description": "List the user's current tasks, optionally filtered by status. Call this when the user asks what they have to do or asks about existing tasks.",
    "input_schema": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["todo", "in_progress", "done"], "description": "Optional filter" }
      }
    }
  },
  {
    "name": "get_task",
    "description": "Get the full detail of a single task by id, including its current notes. Call this before update_task if you need to see the existing notes to append to it.",
    "input_schema": {
      "type": "object",
      "properties": { "id": { "type": "string" } },
      "required": ["id"]
    }
  },
  {
    "name": "update_task",
    "description": "Update an existing task's title, status, and/or notes. Requires the task's id — call list_tasks or get_task first if you only know it by name/topic. When adding a note to a task, pass the full new notes value (existing content plus the addition), not just the new text.",
    "input_schema": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "The task's id, from a prior list_tasks or get_task call" },
        "title": { "type": "string", "description": "New title, if it's changing" },
        "status": { "type": "string", "enum": ["todo", "in_progress", "done"], "description": "New status, if it's changing" },
        "notes": { "type": "string", "description": "New full markdown notes, if it's changing — replaces the existing value" }
      },
      "required": ["id"]
    }
  }
]
```

Each tool function is a thin wrapper around the same Firestore calls the REST handlers use — `create_task`, `list_tasks`/`get_task`, and `update_task` should literally call the same helper functions as `POST /tasks`, `GET /tasks`/`GET /tasks/:id`, and `PUT /tasks/:id`, not duplicate the Firestore logic. `req.user.uid` from the authenticated request is threaded into every tool call — the model never sees or chooses a `uid`, and every tool must verify the task it's fetching/updating actually belongs to that uid (which falls out for free since tasks live at `/users/{uid}/tasks/{taskId}` — there's no cross-user id to leak).

### Where this grows later (not built now)

The user's second example — *"check my email, when is my car insurance expiry"* — is explicitly out of scope for this pass but shapes the design: it's a request that doesn't resolve in one tool call. It needs a `search_email` (or similar) tool whose result gets handed back into the same loop for another round of reasoning before Claude has enough to answer. The loop structure above already supports that (step 4 already re-enters the model with tool results); adding it later is a matter of:

- adding more tool definitions (Gmail search, calendar lookup, etc.) to the `tools` array,
- possibly routing some tool results through a second, cheaper model call if a tool's raw output is too large to hand back directly (e.g. summarize a long email thread before it re-enters the main loop) — noted in the prompt as "a tool's response handler may need to call another AI to get the next tool call to process the results," which the current single-loop design accommodates by just doing that summarization *inside* the tool's execution function before returning the `tool_result`, rather than as a separate architectural layer.

No email/calendar credentials, scopes, or tool implementations are being built in this pass — this section exists so the endpoint shape and loop aren't designed into a corner.

## 4. Frontend

### `src/api.ts` (new, mirrors `circuit-visualiser/src/api.ts`)

```ts
listTasks(): Promise<Task[]>
getTask(id: string): Promise<Task>
createTask(title: string, notes?: string): Promise<{ id: string }>
updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes'>>): Promise<void>
sendPrompt(message: string): Promise<{ reply: string; taskIds?: string[] }>
```

Same `apiFetch` pattern already used elsewhere in the suite: bearer token from `getIdToken(auth.currentUser)`, `VITE_API_URL` base.

### Kanban board

Three columns (`todo` / `in_progress` / `done`) driven by `listTasks()`. Drag-and-drop between columns calls `updateTask(id, { status })` — a plain REST call, no AI involved. A prompt input (e.g. a small bar above the board, "Tell Task Master what to do") calls `sendPrompt()` and refetches the task list on response.

`notes` is markdown, so the card detail view needs a renderer — pull in `react-markdown`, which `video-planner` already depends on, rather than adding a second markdown library to the suite. The edit form itself is a plain textarea; only the read view renders markdown.

Not building drag-and-drop library choice or visual design here — that's an implementation detail for when the board is actually built, not part of this structural plan.

## 5. Summary of new/changed files

**`colinadams-api`**
- `functions/src/routes/tasks.ts` — new: REST CRUD (minus delete) + `/tasks/prompt`
- `functions/src/app.ts` — mount `app.use("/tasks", tasksRouter)`
- No `firestore.rules` change needed (existing `/users/{userId}/**` rule covers it)

**`task-master`**
- `src/api.ts` — new: REST client mirroring `circuit-visualiser/src/api.ts`
- `src/types.ts` — new: `Task` interface
- Kanban board components — new, built against `api.ts` once this structure is agreed
