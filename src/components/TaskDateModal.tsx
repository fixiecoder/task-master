import { useState } from 'react';
import type { TaskDateType } from '../types';
import { DATE_TYPE_LABELS, DATE_TYPES, buildMonthGrid, toDateKey, todayKey } from '../taskDates';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

interface TaskDateModalProps {
  onClose: () => void;
  onAdd: (type: TaskDateType, date: string, durationMinutes: number | null) => void;
  estimatedHoursInput: string;
  onEstimateChange: (hoursInput: string) => void;
}

export function TaskDateModal({ onClose, onAdd, estimatedHoursInput, onEstimateChange }: TaskDateModalProps) {
  const [type, setType] = useState<TaskDateType>('start');
  const [duration, setDuration] = useState('');
  const [estimateInput, setEstimateInput] = useState(estimatedHoursInput);
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const days = buildMonthGrid(monthDate);
  const today = todayKey();

  function handleSelectDay(dateKey: string) {
    const durationMinutes = type === 'planned_work' && duration ? Number(duration) * 60 : null;
    onAdd(type, dateKey, durationMinutes);
    onClose();
  }

  return (
    <div className="task-date-modal-backdrop" onClick={onClose}>
      <div className="task-date-modal" onClick={(e) => e.stopPropagation()}>
        <header className="task-date-modal-header">
          <h3>Add date</h3>
          <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="task-date-modal-types" role="radiogroup" aria-label="Date type">
          {DATE_TYPES.map((t) => (
            <label key={t} className={`task-date-modal-radio ${type === t ? 'active' : ''}`}>
              <input
                type="radio"
                name="task-date-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
              />
              {DATE_TYPE_LABELS[t]}
            </label>
          ))}
        </div>

        {type === 'planned_work' && (
          <label className="task-date-modal-duration">
            Duration (hours)
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 2"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              autoFocus
            />
          </label>
        )}

        <label className="task-date-modal-estimate">
          Estimated total time (hours)
          <input
            type="number"
            min="0"
            step="0.25"
            placeholder="e.g. 8"
            value={estimateInput}
            onChange={(e) => setEstimateInput(e.target.value)}
            onBlur={() => onEstimateChange(estimateInput)}
          />
        </label>

        <div className="task-date-modal-calendar">
          <div className="task-date-modal-calendar-header">
            <button
              type="button"
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span>{MONTH_FORMATTER.format(monthDate)}</span>
            <button
              type="button"
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="task-date-modal-grid">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="task-date-modal-weekday">{label}</div>
            ))}
            {days.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === monthDate.getMonth();
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  className={`task-date-modal-day ${inMonth ? '' : 'outside'} ${isToday ? 'today' : ''}`}
                  onClick={() => handleSelectDay(key)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
