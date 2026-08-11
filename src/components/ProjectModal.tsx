import { useState, type FormEvent } from 'react';
import type { Project } from '../types';

const PRESET_COLORS = ['#b4402a', '#c1862e', '#4b7a5e', '#3f6f8f', '#7a5ea8', '#8a6d4b'];

interface ProjectModalProps {
  project?: Project;
  onClose: () => void;
  onSave: (name: string, color: string | null) => Promise<void> | void;
}

export function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState<string | null>(project?.color ?? null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmed, color);
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
          placeholder="Project name…"
          disabled={isSaving}
        />
        <div className="project-modal-colors">
          <button
            type="button"
            className={`project-color-swatch project-color-none ${color === null ? 'active' : ''}`}
            onClick={() => setColor(null)}
            aria-label="No color"
            title="No color"
          />
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`project-color-swatch ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
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
