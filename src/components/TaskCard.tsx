import { useEffect, useRef, useState } from 'react';
import type { Task, TaskStatus } from '../types';

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onTouchDrop: (status: TaskStatus) => void;
  onTouchHover: (status: TaskStatus | null) => void;
}

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 10;

function statusUnderPoint(x: number, y: number): TaskStatus | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-kanban-status]');
  return (el?.dataset.kanbanStatus as TaskStatus | undefined) ?? null;
}

export function TaskCard({ task, onOpen, onDragStart, onTouchDrop, onTouchHover }: TaskCardProps) {
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
      onTouchHover(statusUnderPoint(touch.clientX, touch.clientY));
    }

    function handleTouchEnd(e: TouchEvent) {
      window.clearTimeout(state.timer);
      if (!state.dragging) return;
      state.dragging = false;
      setIsTouchDragging(false);
      e.preventDefault();
      const touch = e.changedTouches[0];
      const status = statusUnderPoint(touch.clientX, touch.clientY);
      onTouchHover(null);
      if (status) onTouchDrop(status);
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
        <span className="task-card-title">{task.title}</span>
      </span>
      {task.notes && <span className="task-card-notes-dot" title="Has notes" />}
    </button>
  );
}
