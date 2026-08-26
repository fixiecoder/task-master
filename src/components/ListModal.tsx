import { useState, type FormEvent } from 'react';
import type { ListType } from '../types';

const CREATABLE_TYPES: { type: ListType; label: string; hint: string }[] = [
  { type: 'shopping', label: 'Shopping', hint: 'Items to buy — a paired Stock list is created automatically' },
  { type: 'todo', label: 'To-do', hint: 'A plain checklist of tasks or steps' },
  { type: 'checklist', label: 'Checklist', hint: 'Same as To-do, but never gets a paired Stock list' },
];

interface ListModalProps {
  onClose: () => void;
  onSave: (name: string, type: ListType) => Promise<void> | void;
}

export function ListModal({ onClose, onSave }: ListModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ListType>('shopping');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmed, type);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="quick-add-backdrop" onClick={onClose}>
      <form className="quick-add project-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="List name…"
          disabled={isSaving}
        />
        <div className="list-modal-types">
          {CREATABLE_TYPES.map((option) => (
            <button
              key={option.type}
              type="button"
              className={`list-modal-type ${type === option.type ? 'active' : ''}`}
              onClick={() => setType(option.type)}
              disabled={isSaving}
            >
              <span className="list-modal-type-label">{option.label}</span>
              <span className="list-modal-type-hint">{option.hint}</span>
            </button>
          ))}
        </div>
        <div className="quick-add-actions">
          <button type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
