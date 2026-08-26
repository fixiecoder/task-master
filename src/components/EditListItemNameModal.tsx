import { useState, type FormEvent } from 'react';
import type { ListItem } from '../types';

interface EditListItemNameModalProps {
  item: ListItem;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function EditListItemNameModal({ item, onClose, onSave }: EditListItemNameModalProps) {
  const [name, setName] = useState(item.name);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="shopping-item-modal-backdrop" onClick={onClose}>
      <form className="shopping-item-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="shopping-item-modal-header">
          <h3>Edit item</h3>
          <button type="button" className="shopping-item-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <input
          type="text"
          className="shopping-item-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="shopping-item-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}
