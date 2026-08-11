import { useState } from 'react';
import type { ProjectDeleteMode } from '../api';

interface DeleteProjectModalProps {
  projectName: string;
  taskCount: number;
  onClose: () => void;
  onConfirm: (mode: ProjectDeleteMode) => Promise<void> | void;
}

export function DeleteProjectModal({ projectName, taskCount, onClose, onConfirm }: DeleteProjectModalProps) {
  const [isDeleting, setIsDeleting] = useState<ProjectDeleteMode | null>(null);

  async function handleConfirm(mode: ProjectDeleteMode) {
    if (isDeleting) return;
    setIsDeleting(mode);
    try {
      await onConfirm(mode);
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <div className="quick-add-backdrop" onClick={onClose}>
      <div className="quick-add delete-project-modal" onClick={(e) => e.stopPropagation()}>
        <p>
          Delete <strong>{projectName}</strong>? It has {taskCount} {taskCount === 1 ? 'task' : 'tasks'} assigned —
          what should happen to {taskCount === 1 ? 'it' : 'them'}?
        </p>
        <div className="delete-project-actions">
          <button type="button" onClick={onClose} disabled={isDeleting !== null}>
            Cancel
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => handleConfirm('unassign')}
            disabled={isDeleting !== null}
          >
            {isDeleting === 'unassign' ? 'Unassigning…' : 'Unassign tasks'}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleConfirm('cascade')}
            disabled={isDeleting !== null}
          >
            {isDeleting === 'cascade' ? 'Deleting…' : 'Delete tasks too'}
          </button>
        </div>
      </div>
    </div>
  );
}
