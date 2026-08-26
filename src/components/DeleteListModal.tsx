import { useState } from 'react';
import type { List } from '../types';

interface DeleteListModalProps {
  list: List;
  taskCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DeleteListModal({ list, taskCount, onClose, onConfirm }: DeleteListModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="quick-add-backdrop" onClick={onClose}>
      <div className="quick-add delete-project-modal" onClick={(e) => e.stopPropagation()}>
        <p>
          Delete <strong>{list.name}</strong>?
          {taskCount > 0 && ` ${taskCount} ${taskCount === 1 ? 'task links' : 'tasks link'} to it — ${taskCount === 1 ? 'it' : 'they'} will be unlinked, not deleted.`}
          {list.pairedListId && ' Its paired list will also be deleted.'}
        </p>
        <div className="delete-project-actions">
          <button type="button" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
