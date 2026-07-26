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

// Runs `task` immediately and, on network failure, keeps retrying with
// backoff until it succeeds, is superseded by a newer call with the same
// key, or fails for a non-network reason (in which case `onGiveUp` fires
// once, immediately). This is what lets a checkbox tap survive bad signal:
// the caller applies its own optimistic UI state before calling this, and
// that state stays put — untouched by the retry loop — until the mutation
// either lands or is abandoned.
export function syncWithRetry(key: string, task: () => Promise<void>, onGiveUp: () => void): void {
  const existing = queue.get(key);
  if (existing?.timer) clearTimeout(existing.timer);

  let attempts = 0;
  const entry: Entry = { timer: null, run: () => {} };
  entry.run = () => {
    task().then(
      () => {
        if (queue.get(key) === entry) queue.delete(key);
      },
      (err) => {
        if (queue.get(key) !== entry) return;
        if (!isNetworkError(err)) {
          queue.delete(key);
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    for (const entry of queue.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      entry.run();
    }
  });
}
