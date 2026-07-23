export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}
