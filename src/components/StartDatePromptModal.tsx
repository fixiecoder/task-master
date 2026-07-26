import { useState, type FormEvent } from 'react';
import { todayKey } from '../taskDates';

interface StartDatePromptModalProps {
  taskTitle: string;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void> | void;
}

export function StartDatePromptModal({ taskTitle, onClose, onConfirm }: StartDatePromptModalProps) {
  const [date, setDate] = useState(todayKey());
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date || isSaving) return;
    setIsSaving(true);
    try {
      await onConfirm(date);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="start-date-prompt-backdrop" onClick={onClose}>
      <form className="start-date-prompt" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <p className="start-date-prompt-label">
          When does <strong>{taskTitle}</strong> start?
        </p>
        <input
          type="date"
          autoFocus
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isSaving}
          required
        />
        <div className="start-date-prompt-actions">
          <button type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" disabled={isSaving || !date}>
            {isSaving ? 'Saving…' : 'Set start date'}
          </button>
        </div>
      </form>
    </div>
  );
}
