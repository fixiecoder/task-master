import { useState, type FormEvent } from 'react';
import type { ListType } from '../types';
import { useProjects } from '../useProjects';

const CREATABLE_TYPES: { type: ListType; label: string; hint: string }[] = [
  { type: 'shopping', label: 'Shopping', hint: 'Items to buy — a paired Stock list is created automatically' },
  { type: 'todo', label: 'To-do', hint: 'A plain checklist of tasks or steps' },
  { type: 'checklist', label: 'Checklist', hint: 'Same as To-do, but never gets a paired Stock list' },
];

interface ListModalProps {
  onClose: () => void;
  onSave: (name: string, type: ListType, projectId: string | null) => Promise<void> | void;
  defaultProjectId?: string | null;
}

export function ListModal({ onClose, onSave, defaultProjectId }: ListModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ListType>('shopping');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const { projects } = useProjects();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmed, type, projectId);
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
        <div className="task-detail-project">
          <span className="task-detail-project-label">Project</span>
          <select
            className="task-detail-project-select"
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            disabled={isSaving}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
