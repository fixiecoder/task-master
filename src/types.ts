export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskDateType = 'start' | 'due' | 'planned_work' | 'completed';

export interface TaskDateEntry {
  id: string;
  type: TaskDateType;
  date: string; // ISO yyyy-mm-dd
  durationMinutes: number | null; // only meaningful for planned_work
}

/** Where a task originated, when it was created by another spoke app rather than task-master itself. */
export interface TaskSource {
  app: string; // e.g. 'video-planner'
  scriptId: string;
  versionId: string;
  shotBlockId: string | null; // null = script-level task
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes: string | null;
  dates: TaskDateEntry[];
  estimatedMinutes: number | null;
  projectId: string | null;
  listId: string | null;
  source: TaskSource | null;
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

export type ListType = 'shopping' | 'todo' | 'checklist' | 'stock';

export interface List {
  id: string;
  name: string;
  type: ListType;
  // Symmetric link between a `shopping` list and its auto-created `stock`
  // list. Null for todo/checklist lists, which never pair.
  pairedListId: string | null;
  projectId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export type ListWithItemCount = List & { itemCount: number };

export interface ListItem {
  id: string;
  listId: string;
  name: string;
  normalizedName: string;
  category: ShoppingCategory | null; // only meaningful for shopping/stock lists
  checked: boolean; // todo/checklist "done" state; shopping/stock state is which list it's in
  checkedAt: unknown;
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
