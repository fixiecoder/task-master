import { useMemo, useState } from 'react';
import type { Task, TaskDateEntry } from '../types';
import { useTasks } from '../useTasks';
import { createTask, updateTask } from '../api';
import { DATE_TYPE_LABELS, formatDuration, toDateKey, todayKey } from '../taskDates';
import { TaskDetail } from './TaskDetail';
import { DayDetailModal } from './DayDetailModal';
import { QuickAddTaskModal } from './QuickAddTaskModal';
import { UnscheduledTaskPickerModal } from './UnscheduledTaskPickerModal';
import './CalendarPage.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

interface CalendarEntry {
  task: Task;
  entry: TaskDateEntry;
}

function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);

  // Monday-first week: getDay() 0=Sun..6=Sat, shift so Monday=0.
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadingDays);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

export function CalendarPage() {
  const { tasks, setTasks, isLoading, error, setError, isOnline, refresh, saveTask, removeTask } = useTasks();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const task of tasks) {
      for (const entry of task.dates ?? []) {
        const list = map.get(entry.date) ?? [];
        list.push({ task, entry });
        map.set(entry.date, list);
      }
    }
    return map;
  }, [tasks]);

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const today = todayKey();

  function goToPrevMonth() {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goToToday() {
    const now = new Date();
    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  async function handleSaveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes'>>) {
    try {
      await saveTask(id, updates);
      setSelectedTaskId(null);
    } catch {
      // TaskDetail stays open so the user can retry the save.
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      await removeTask(id);
      setSelectedTaskId(null);
    } catch {
      // TaskDetail stays open so the user can retry the delete.
    }
  }

  async function handleQuickAddTask(title: string) {
    if (!selectedDayKey) return;
    try {
      const created = await createTask(title);
      const startEntry: TaskDateEntry = {
        id: crypto.randomUUID(),
        type: 'start',
        date: selectedDayKey,
        durationMinutes: null,
      };
      const withDate = await updateTask(created.id, { dates: [startEntry] });
      setTasks((prev) => [withDate, ...prev]);
      setIsQuickAddOpen(false);
    } catch {
      setError('Could not create that task — try again.');
    }
  }

  async function handleAssignExistingTask(taskId: string) {
    if (!selectedDayKey) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      const startEntry: TaskDateEntry = {
        id: crypto.randomUUID(),
        type: 'start',
        date: selectedDayKey,
        durationMinutes: null,
      };
      const updated = await updateTask(taskId, { dates: [...task.dates, startEntry] });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setIsAssignPickerOpen(false);
    } catch {
      setError('Could not assign that task — try again.');
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedDayEntries = selectedDayKey ? entriesByDate.get(selectedDayKey) ?? [] : [];
  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => (t.dates ?? []).length === 0),
    [tasks],
  );

  return (
    <div className="calendar-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved tasks.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      <div className="calendar-header">
        <h2>{MONTH_FORMATTER.format(monthDate)}</h2>
        <div className="calendar-nav">
          <button type="button" onClick={goToPrevMonth} aria-label="Previous month">‹</button>
          <button type="button" onClick={goToToday}>Today</button>
          <button type="button" onClick={goToNextMonth} aria-label="Next month">›</button>
        </div>
      </div>

      {isLoading ? (
        <p className="board-loading">Loading tasks…</p>
      ) : (
        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">{label}</div>
          ))}
          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = day.getMonth() === monthDate.getMonth();
            const isToday = key === today;
            const dayEntries = entriesByDate.get(key) ?? [];
            return (
              <div
                key={key}
                className={`calendar-day ${inMonth ? '' : 'calendar-day-outside'} ${isToday ? 'calendar-day-today' : ''}`}
                onClick={() => setSelectedDayKey(key)}
              >
                <span className="calendar-day-number">{day.getDate()}</span>
                <div className="calendar-day-entries">
                  {dayEntries.map(({ task, entry }) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`calendar-chip calendar-chip-${entry.type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(task.id);
                      }}
                      title={`${DATE_TYPE_LABELS[entry.type]}: ${task.title}${entry.durationMinutes ? ` (${formatDuration(entry.durationMinutes)})` : ''}`}
                    >
                      <span className="calendar-chip-title">{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDayKey && (
        <DayDetailModal
          dateKey={selectedDayKey}
          entries={selectedDayEntries}
          onClose={() => setSelectedDayKey(null)}
          onSelectTask={setSelectedTaskId}
          onAddTask={() => setIsQuickAddOpen(true)}
          onAssignExisting={() => setIsAssignPickerOpen(true)}
        />
      )}

      {isQuickAddOpen && (
        <QuickAddTaskModal
          onClose={() => setIsQuickAddOpen(false)}
          onSave={handleQuickAddTask}
        />
      )}

      {isAssignPickerOpen && (
        <UnscheduledTaskPickerModal
          tasks={unscheduledTasks}
          onClose={() => setIsAssignPickerOpen(false)}
          onAssignTask={handleAssignExistingTask}
        />
      )}

      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onTasksChanged={refresh}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}
