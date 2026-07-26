import type { TaskDateEntry, TaskDateType } from './types';

export const DATE_TYPE_LABELS: Record<TaskDateType, string> = {
  start: 'Start',
  due: 'Due',
  planned_work: 'Planned work',
  completed: 'Completed',
};

export const DATE_TYPES: TaskDateType[] = ['start', 'due', 'planned_work'];

export function hasDateOfType(dates: TaskDateEntry[], type: TaskDateType): boolean {
  return dates.some((d) => d.type === type);
}

export function withDateStamp(
  dates: TaskDateEntry[],
  type: Extract<TaskDateType, 'start' | 'completed'>,
): TaskDateEntry[] {
  if (hasDateOfType(dates, type)) return dates;
  return [...dates, { id: crypto.randomUUID(), type, date: todayKey(), durationMinutes: null }];
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
