import type { Task } from '../types';

interface UnscheduledTaskPickerModalProps {
  tasks: Task[];
  onClose: () => void;
  onAssignTask: (taskId: string) => void;
}

export function UnscheduledTaskPickerModal({ tasks, onClose, onAssignTask }: UnscheduledTaskPickerModalProps) {
  return (
    <div className="day-detail-backdrop" onClick={onClose}>
      <div className="day-detail" onClick={(e) => e.stopPropagation()}>
        <header className="day-detail-header">
          <h3>Unscheduled tasks</h3>
          <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {tasks.length === 0 ? (
          <p className="day-detail-empty">No unscheduled tasks.</p>
        ) : (
          <ul className="day-detail-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="day-detail-item day-detail-item-unscheduled"
                  onClick={() => onAssignTask(task.id)}
                >
                  <span className="day-detail-item-title">{task.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
