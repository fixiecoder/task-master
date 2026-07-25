import { useState, type FormEvent } from 'react';

interface QuickAddTaskModalProps {
  onClose: () => void;
  onSave: (title: string) => Promise<void> | void;
}

export function QuickAddTaskModal({ onClose, onSave }: QuickAddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="quick-add-backdrop" onClick={onClose}>
      <form className="quick-add" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title…"
          disabled={isSaving}
        />
        <div className="quick-add-actions">
          <button type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
