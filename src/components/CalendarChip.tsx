import { useEffect, useRef, useState } from 'react';
import type { Task, TaskDateEntry } from '../types';
import { DATE_TYPE_LABELS, formatDuration } from '../taskDates';

interface CalendarChipProps {
  task: Task;
  entry: TaskDateEntry;
  onOpen: (taskId: string) => void;
  onDragStart: (entry: TaskDateEntry) => void;
  onTouchDrop: (dateKey: string) => void;
  onTouchHover: (dateKey: string | null) => void;
}

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 10;

function dayKeyUnderPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-calendar-day]');
  return el?.dataset.calendarDay ?? null;
}

export function CalendarChip({ task, entry, onOpen, onDragStart, onTouchDrop, onTouchHover }: CalendarChipProps) {
  const chipRef = useRef<HTMLButtonElement>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  // Mutable so the DOM event listeners always see the latest press without re-binding.
  const press = useRef({ timer: 0, startX: 0, startY: 0, dragging: false });

  useEffect(() => {
    const el = chipRef.current;
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
        onDragStart(entry);
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
      onTouchHover(dayKeyUnderPoint(touch.clientX, touch.clientY));
    }

    function handleTouchEnd(e: TouchEvent) {
      window.clearTimeout(state.timer);
      if (!state.dragging) return;
      state.dragging = false;
      setIsTouchDragging(false);
      e.preventDefault();
      const touch = e.changedTouches[0];
      const dayKey = dayKeyUnderPoint(touch.clientX, touch.clientY);
      onTouchHover(null);
      if (dayKey) onTouchDrop(dayKey);
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
  }, [entry, onDragStart, onTouchDrop, onTouchHover]);

  return (
    <button
      ref={chipRef}
      type="button"
      className={`calendar-chip calendar-chip-${entry.type} ${isTouchDragging ? 'touch-dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(entry);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(task.id);
      }}
      title={`${DATE_TYPE_LABELS[entry.type]}: ${task.title}${entry.durationMinutes ? ` (${formatDuration(entry.durationMinutes)})` : ''}`}
    >
      <span className="calendar-chip-title">{task.title}</span>
    </button>
  );
}
