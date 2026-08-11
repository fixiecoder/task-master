export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskDateType = 'start' | 'due' | 'planned_work' | 'completed';

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
  projectId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Project {
  id: string;
  name: string;
  color: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export type ProjectWithCount = Project & { taskCount: number };

export type ShoppingCategory = 'groceries' | 'diy' | 'electronics' | 'other';

export interface ShoppingItem {
  id: string;
  taskId: string;
  taskTitle: string;
  name: string;
  normalizedName: string;
  category: ShoppingCategory | null;
  purchased: boolean;
  purchasedAt: unknown;
  archived: boolean;
  source: 'ai' | 'manual';
  createdAt: unknown;
  updatedAt: unknown;
}

export type NotificationType = 'morning_digest';

export interface NotificationDoc {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  taskIds: string[];
  taskTitles: string[];
  createdAt: unknown;
  read: boolean;
  readAt: unknown;
}

export interface NotificationSettings {
  morningReminderTime: string; // 'HH:mm', local
  timezone: string; // IANA
  enabled: boolean;
  lastMorningDigestSentDate: string | null; // ISO yyyy-mm-dd
}
