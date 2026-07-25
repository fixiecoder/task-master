import type { Task, TaskDateEntry } from '../types';
import { DATE_TYPE_LABELS, formatDuration } from '../taskDates';

interface DayDetailEntry {
  task: Task;
  entry: TaskDateEntry;
}

interface DayDetailModalProps {
  dateKey: string;
  entries: DayDetailEntry[];
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onAddTask: () => void;
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function DayDetailModal({ dateKey, entries, onClose, onSelectTask, onAddTask }: DayDetailModalProps) {
  return (
    <div className="day-detail-backdrop" onClick={onClose}>
      <div className="day-detail" onClick={(e) => e.stopPropagation()}>
        <header className="day-detail-header">
          <h3>{DAY_LABEL_FORMATTER.format(parseDateKey(dateKey))}</h3>
          <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {entries.length === 0 ? (
          <p className="day-detail-empty">No tasks on this day.</p>
        ) : (
          <ul className="day-detail-list">
            {entries.map(({ task, entry }) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`day-detail-item day-detail-item-${entry.type}`}
                  onClick={() => onSelectTask(task.id)}
                >
                  <span className="day-detail-item-title">{task.title}</span>
                  <span className="day-detail-item-meta">
                    {DATE_TYPE_LABELS[entry.type]}
                    {entry.durationMinutes ? ` · ${formatDuration(entry.durationMinutes)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="day-detail-add" onClick={onAddTask}>+ Add task</button>
      </div>
    </div>
  );
}
