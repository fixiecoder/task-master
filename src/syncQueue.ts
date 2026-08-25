import { deleteOutboxEntry, getOutboxEntries, putOutboxEntry } from './db';

type Entry = {
  timer: ReturnType<typeof setTimeout> | null;
  run: () => void;
};

const queue = new Map<string, Entry>();

const MAX_BACKOFF_MS = 30_000;

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

function backoffDelay(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
}

export interface OutboxDescriptor {
  key: string;
  kind: string;
  payload: unknown;
}

// Runs `task` immediately and, on network failure, keeps retrying with
// backoff until it succeeds, is superseded by a newer call with the same
// key, or fails for a non-network reason (in which case `onGiveUp` fires
// once, immediately). This is what lets a checkbox tap survive bad signal:
// the caller applies its own optimistic UI state before calling this, and
// that state stays put — untouched by the retry loop — until the mutation
// either lands or is abandoned.
//
// `descriptor` is written to IndexedDB before the first attempt and removed
// once the mutation lands or is abandoned, so a pending mutation survives a
// reload or the PWA being killed while offline — see replayOutbox, which
// re-drives anything still pending at startup and on reconnect.
export function syncWithRetry(descriptor: OutboxDescriptor, task: () => Promise<void>, onGiveUp: () => void): void {
  const { key } = descriptor;
  const existing = queue.get(key);
  if (existing?.timer) clearTimeout(existing.timer);

  putOutboxEntry({ ...descriptor, createdAt: Date.now() }).catch(() => {});

  let attempts = 0;
  const entry: Entry = { timer: null, run: () => {} };
  entry.run = () => {
    task().then(
      () => {
        if (queue.get(key) === entry) queue.delete(key);
        deleteOutboxEntry(key).catch(() => {});
      },
      (err) => {
        if (queue.get(key) !== entry) return;
        if (!isNetworkError(err)) {
          queue.delete(key);
          deleteOutboxEntry(key).catch(() => {});
          onGiveUp();
          return;
        }
        attempts += 1;
        entry.timer = setTimeout(entry.run, backoffDelay(attempts));
      },
    );
  };

  queue.set(key, entry);
  entry.run();
}

// Re-drives every mutation still recorded in the outbox — offline edits
// that never made it to the network before the tab was reloaded or the PWA
// was killed. Called once at startup (after auth resolves) and again on
// every `online` event; entries already running in this session are
// skipped so this is safe to call repeatedly.
export async function replayOutbox(dispatch: (kind: string, payload: unknown) => Promise<void>): Promise<void> {
  const entries = await getOutboxEntries();
  for (const entry of entries) {
    if (queue.has(entry.key)) continue;
    syncWithRetry(entry, () => dispatch(entry.kind, entry.payload), () => {});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    for (const entry of queue.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      entry.run();
    }
  });
}
