import { useEffect, useRef, useState } from 'react';
import type { Project, Task } from '../types';
import { ProgressBar } from './ProgressBar';
import type { ColumnId } from './KanbanColumn';
import { DATE_TYPE_LABELS, formatShortDate, primaryDisplayDate } from '../taskDates';

interface TaskCardProps {
  task: Task;
  project?: Project;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onTouchDrop: (id: ColumnId) => void;
  onTouchHover: (id: ColumnId | null) => void;
}

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 10;

function columnUnderPoint(x: number, y: number): ColumnId | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-kanban-status]');
  return (el?.dataset.kanbanStatus as ColumnId | undefined) ?? null;
}

export function TaskCard({ task, project, onOpen, onDragStart, onTouchDrop, onTouchHover }: TaskCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  // Mutable so the DOM event listeners always see the latest press without re-binding.
  const press = useRef({ timer: 0, startX: 0, startY: 0, dragging: false });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const state = press.current;

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.dragging = false;
      state.timer = window.setTimeout(() => {
        state.dragging = true;
        setIsTouchDragging(true);
        onDragStart(task);
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    }

    function handleTouchMove(e: TouchEvent) {
      const touch = e.touches[0];
      if (!state.dragging) {
        const dx = Math.abs(touch.clientX - state.startX);
        const dy = Math.abs(touch.clientY - state.startY);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) window.clearTimeout(state.timer);
        return;
      }
      e.preventDefault();
      onTouchHover(columnUnderPoint(touch.clientX, touch.clientY));
    }

    function handleTouchEnd(e: TouchEvent) {
      window.clearTimeout(state.timer);
      if (!state.dragging) return;
      state.dragging = false;
      setIsTouchDragging(false);
      e.preventDefault();
      const touch = e.changedTouches[0];
      const column = columnUnderPoint(touch.clientX, touch.clientY);
      onTouchHover(null);
      if (column) onTouchDrop(column);
    }

    function handleTouchCancel() {
      window.clearTimeout(state.timer);
      state.dragging = false;
      setIsTouchDragging(false);
      onTouchHover(null);
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.clearTimeout(state.timer);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [task, onDragStart, onTouchDrop, onTouchHover]);

  const dateEntry = primaryDisplayDate(task.dates);

  return (
    <button
      ref={cardRef}
      type="button"
      className={`task-card ${isTouchDragging ? 'touch-dragging' : ''}`}
      draggable
      onDragStart={() => onDragStart(task)}
      onClick={() => onOpen(task)}
    >
      <span className="task-card-body">
        <span className="task-card-title">
          {project && (
            <span
              className="task-card-project-dot"
              style={{ backgroundColor: project.color ?? 'var(--chalk-dim)' }}
              title={project.name}
            />
          )}
          {task.title}
        </span>
        {dateEntry && (
          <span className="task-card-date" title={DATE_TYPE_LABELS[dateEntry.type]}>
            {DATE_TYPE_LABELS[dateEntry.type]} {formatShortDate(dateEntry.date)}
          </span>
        )}
        <ProgressBar task={task} />
      </span>
      {task.notes && <span className="task-card-notes-dot" title="Has notes" />}
    </button>
  );
}
