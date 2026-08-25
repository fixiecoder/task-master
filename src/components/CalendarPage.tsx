import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Task, TaskDateEntry } from '../types';
import { useTasks } from '../useTasks';
import { queueCreateTask, queueUpdateTask } from '../api';
import { buildMonthGrid, buildWeekGrid, toDateKey, todayKey } from '../taskDates';
import { TaskDetail } from './TaskDetail';
import { DayDetailModal } from './DayDetailModal';
import { QuickAddTaskModal } from './QuickAddTaskModal';
import { UnscheduledTaskPickerModal } from './UnscheduledTaskPickerModal';
import { CalendarChip } from './CalendarChip';
import { ContextMenu } from './ContextMenu';
import './CalendarPage.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const WEEK_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const WEEK_DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function formatWeekRange(days: Date[]): string {
  const start = days[0];
  const end = days[days.length - 1];
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = WEEK_DAY_MONTH_FORMATTER.format(start);
  const endLabel = sameYear ? WEEK_DAY_MONTH_FORMATTER.format(end) : WEEK_DAY_MONTH_YEAR_FORMATTER.format(end);
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

type CalendarViewMode = 'month' | 'week';

interface CalendarEntry {
  task: Task;
  entry: TaskDateEntry;
}

export function CalendarPage() {
  const { tasks, setTasks, isLoading, error, setError, isOnline, refresh, saveTask, removeTask } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  }

  const viewParam = searchParams.get('view');
  const viewMode: CalendarViewMode = viewParam === 'week' ? 'week' : 'month';
  function setViewMode(mode: CalendarViewMode) {
    updateParams({ view: mode === 'month' ? null : mode });
  }

  const monthParam = searchParams.get('month');
  const monthDate = useMemo(() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [monthParam]);
  function setMonthDate(updater: (d: Date) => Date) {
    const next = updater(monthDate);
    const monthKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    updateParams({ month: monthKey });
  }

  const weekParam = searchParams.get('week');
  const weekDate = useMemo(() => {
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      const [year, month, day] = weekParam.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  }, [weekParam]);
  function setWeekDate(updater: (d: Date) => Date) {
    const next = updater(weekDate);
    updateParams({ week: toDateKey(next) });
  }

  const selectedTaskId = searchParams.get('task');
  function setSelectedTaskId(id: string | null) {
    updateParams({ task: id });
  }

  const selectedDayKey = searchParams.get('day');
  function setSelectedDayKey(key: string | null) {
    updateParams({ day: key });
  }

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false);
  const [draggedEntry, setDraggedEntry] = useState<TaskDateEntry | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const [touchDragOverDayKey, setTouchDragOverDayKey] = useState<string | null>(null);
  const [chipContextMenu, setChipContextMenu] = useState<{ task: Task; entry: TaskDateEntry; x: number; y: number } | null>(null);

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

  const monthDays = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const weekDays = useMemo(() => buildWeekGrid(weekDate), [weekDate]);
  const days = viewMode === 'month' ? monthDays : weekDays;
  const today = todayKey();

  function goToPrev() {
    if (viewMode === 'month') {
      setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else {
      setWeekDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    }
  }

  function goToNext() {
    if (viewMode === 'month') {
      setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else {
      setWeekDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    }
  }

  function goToToday() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    updateParams({ month: monthKey, week: toDateKey(now) });
  }

  function handleSaveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>) {
    saveTask(id, updates);
    setSelectedTaskId(null);
  }

  function handleDeleteTask(id: string) {
    removeTask(id);
    setSelectedTaskId(null);
  }

  function handleQuickAddTask(title: string) {
    if (!selectedDayKey) return;
    const startEntry: TaskDateEntry = {
      id: crypto.randomUUID(),
      type: 'start',
      date: selectedDayKey,
      durationMinutes: null,
    };
    const created = queueCreateTask(
      title,
      null,
      null,
      () => setError('Could not create that task — try again.'),
      { dates: [startEntry] },
    );
    setTasks((prev) => [created, ...prev]);
    setIsQuickAddOpen(false);
  }

  function handleAssignExistingTask(taskId: string) {
    if (!selectedDayKey) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const startEntry: TaskDateEntry = {
      id: crypto.randomUUID(),
      type: 'start',
      date: selectedDayKey,
      durationMinutes: null,
    };
    const updated = queueUpdateTask(task, { dates: [...task.dates, startEntry] }, () => {
      setError('Could not assign that task — try again.');
      refresh();
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    setIsAssignPickerOpen(false);
  }

  function handleDropOnDay(dateKey: string) {
    const entry = draggedEntry;
    setDraggedEntry(null);
    setDragOverDayKey(null);
    setTouchDragOverDayKey(null);
    if (!entry || entry.date === dateKey) return;

    const task = tasks.find((t) => (t.dates ?? []).some((d) => d.id === entry.id));
    if (!task) return;

    const nextDates = task.dates
      .map((d) => (d.id === entry.id ? { ...d, date: dateKey } : d))
      .sort((a, b) => a.date.localeCompare(b.date));

    const updated = queueUpdateTask(task, { dates: nextDates }, () => {
      setError('Could not reschedule that task — try again.');
      refresh();
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  function handleUnscheduleEntry(task: Task, entry: TaskDateEntry) {
    const nextDates = task.dates.filter((d) => d.id !== entry.id);
    const updated = queueUpdateTask(task, { dates: nextDates }, () => {
      setError('Could not unschedule that task — try again.');
      refresh();
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
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
        <h2>{viewMode === 'month' ? MONTH_FORMATTER.format(monthDate) : formatWeekRange(weekDays)}</h2>
        <div className="calendar-header-controls">
          <div className="calendar-view-toggle" role="group" aria-label="Calendar view">
            <button
              type="button"
              className={viewMode === 'month' ? 'active' : ''}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
          <div className="calendar-nav">
            <button type="button" onClick={goToPrev} aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}>‹</button>
            <button type="button" onClick={goToToday}>Today</button>
            <button type="button" onClick={goToNext} aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}>›</button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="board-loading">Loading tasks…</p>
      ) : (
        <div className={`calendar-grid ${viewMode === 'week' ? 'calendar-grid-week' : ''}`}>
          {viewMode === 'month' && WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">{label}</div>
          ))}
          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = viewMode === 'month' ? day.getMonth() === monthDate.getMonth() : true;
            const isToday = key === today;
            const dayEntries = entriesByDate.get(key) ?? [];
            const isDragOver = dragOverDayKey === key || touchDragOverDayKey === key;
            return (
              <div
                key={key}
                data-calendar-day={key}
                className={`calendar-day ${inMonth ? '' : 'calendar-day-outside'} ${isToday ? 'calendar-day-today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => setSelectedDayKey(key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDayKey(key);
                }}
                onDragLeave={() => setDragOverDayKey((k) => (k === key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnDay(key);
                }}
              >
                {viewMode === 'week' ? (
                  <span className="calendar-day-label">
                    <span className="calendar-day-weekday">{WEEKDAY_LABELS[(day.getDay() + 6) % 7]}</span>
                    <span className="calendar-day-number">{day.getDate()}</span>
                  </span>
                ) : (
                  <span className="calendar-day-number">{day.getDate()}</span>
                )}
                <div className="calendar-day-entries">
                  {dayEntries.map(({ task, entry }) => (
                    <CalendarChip
                      key={entry.id}
                      task={task}
                      entry={entry}
                      onOpen={setSelectedTaskId}
                      onDragStart={setDraggedEntry}
                      onTouchDrop={handleDropOnDay}
                      onTouchHover={setTouchDragOverDayKey}
                      onContextMenu={(task, entry, x, y) => setChipContextMenu({ task, entry, x, y })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chipContextMenu && (
        <ContextMenu
          x={chipContextMenu.x}
          y={chipContextMenu.y}
          onClose={() => setChipContextMenu(null)}
          items={[
            {
              label: 'Unschedule',
              onSelect: () => handleUnscheduleEntry(chipContextMenu.task, chipContextMenu.entry),
            },
          ]}
        />
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
