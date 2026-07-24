export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskDateType = 'start' | 'due' | 'planned_work';

export interface TaskDateEntry {
  id: string;
  type: TaskDateType;
  date: string; // ISO yyyy-mm-dd
  durationMinutes: number | null; // only meaningful for planned_work
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes: string | null;
  dates: TaskDateEntry[];
  estimatedMinutes: number | null;
  createdAt: unknown;
  updatedAt: unknown;
}
