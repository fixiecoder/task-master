import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Task, TaskStatus, TaskDateEntry, TaskDateType } from '../types';
import {
  TASK_STATUSES,
  sendTaskChatMessage,
  listTaskConversations,
  getTaskConversation,
  queueUpdateTask,
  type ChatMessage,
  type ConversationSummary,
} from '../api';
import { DATE_TYPE_LABELS, formatDuration, withDateStamp } from '../taskDates';
import { usePersistedState } from '../usePersistedState';
import { useProjects } from '../useProjects';
import { createProject } from '../api';
import { ShoppingListSection } from './ShoppingListSection';
import { TaskDateModal } from './TaskDateModal';
import { ProjectModal } from './ProjectModal';
import { BrainIcon } from '../icons';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>) => void;
  onDelete: (id: string) => void;
  onTasksChanged: () => void;
  isOnline: boolean;
}

function normalizeMarkdown(text: string): string {
  const lines = text.split('\n');
  const collapsed: string[] = [];
  for (const line of lines) {
    const isBlank = line.trim() === '';
    const prevBlank = collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '';
    if (isBlank && prevBlank) continue;
    collapsed.push(line);
  }
  return collapsed.join('\n').trim();
}

interface TaskDraft {
  title: string;
  status: TaskStatus;
  notes: string;
  dates: TaskDateEntry[];
  estimatedHoursInput: string;
  projectId: string | null;
}

function draftKey(taskId: string): string {
  return `task-master:draft:${taskId}`;
}

function loadDraft(taskId: string): TaskDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(taskId));
    return raw ? (JSON.parse(raw) as TaskDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(taskId: string, draft: TaskDraft) {
  try {
    localStorage.setItem(draftKey(taskId), JSON.stringify(draft));
  } catch {
    // localStorage may be unavailable (e.g. private browsing) — drafts just won't survive a refresh.
  }
}

function clearDraft(taskId: string) {
  localStorage.removeItem(draftKey(taskId));
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function TaskDetail({ task, onClose, onSave, onDelete, onTasksChanged, isOnline }: TaskDetailProps) {
  const [draft] = useState(() => loadDraft(task.id));
  const [title, setTitle] = useState(draft?.title ?? task.title);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(draft?.status ?? task.status);
  const [notes, setNotes] = useState(draft?.notes ?? task.notes ?? '');
  const [isEditingNotes, setIsEditingNotes] = useState(draft ? true : !task.notes);

  const [dates, setDates] = useState<TaskDateEntry[]>(draft?.dates ?? task.dates ?? []);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [estimatedHoursInput, setEstimatedHoursInput] = useState(
    draft?.estimatedHoursInput ?? (task.estimatedMinutes != null ? String(task.estimatedMinutes / 60) : ''),
  );
  const [projectId, setProjectId] = useState<string | null>(draft?.projectId ?? task.projectId ?? null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const { projects, setProjects } = useProjects();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = usePersistedState(`task-master:chat-draft:${task.id}`, '');
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [isSmartMode, setIsSmartMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const chatThreadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isChatOpen) return;
    const el = chatThreadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isChatOpen, chatMessages, isChatting]);

  const estimatedMinutes = estimatedHoursInput.trim() === ''
    ? null
    : Math.round(Number(estimatedHoursInput) * 60);

  const isDirty = title !== task.title
    || status !== task.status
    || notes !== (task.notes ?? '')
    || JSON.stringify(dates) !== JSON.stringify(task.dates ?? [])
    || estimatedMinutes !== (task.estimatedMinutes ?? null)
    || projectId !== (task.projectId ?? null);

  useEffect(() => {
    if (isDirty) {
      saveDraft(task.id, { title, status, notes, dates, estimatedHoursInput, projectId });
    } else {
      clearDraft(task.id);
    }
  }, [task.id, isDirty, title, status, notes, dates, estimatedHoursInput, projectId]);

  function handleSave() {
    clearDraft(task.id);
    onSave(task.id, { title, status, notes: notes || null, dates, estimatedMinutes, projectId });
    setIsEditingNotes(false);
  }

  async function handleCreateProjectFromPicker(name: string, color: string | null) {
    const project = await createProject(name, color);
    setProjects((prev) => [...prev, { ...project, taskCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setProjectId(project.id);
    setIsNewProjectModalOpen(false);
  }

  function handleClose() {
    clearDraft(task.id);
    onClose();
  }

  function handleDeleteConfirmed() {
    clearDraft(task.id);
    onDelete(task.id);
  }

  function handleStatusChange(next: TaskStatus) {
    setStatus(next);
    if (next === 'in_progress') setDates((prev) => withDateStamp(prev, 'start'));
    else if (next === 'done') setDates((prev) => withDateStamp(prev, 'completed'));
  }

  function persistDates(next: TaskDateEntry[]) {
    const previous = dates;
    setDates(next);
    setDateError(null);
    queueUpdateTask(task, { dates: next }, () => {
      setDates(previous);
      setDateError("Couldn't save that date — try again.");
    });
    onTasksChanged();
  }

  function persistEstimate(hoursInput: string) {
    const previous = estimatedHoursInput;
    if (hoursInput === previous) return;
    const minutes = hoursInput.trim() === '' ? null : Math.round(Number(hoursInput) * 60);
    setEstimatedHoursInput(hoursInput);
    setDateError(null);
    queueUpdateTask(task, { estimatedMinutes: minutes }, () => {
      setEstimatedHoursInput(previous);
      setDateError("Couldn't save that estimate — try again.");
    });
    onTasksChanged();
  }

  function handleAddDateFromModal(type: TaskDateType, date: string, durationMinutes: number | null) {
    const entry: TaskDateEntry = { id: crypto.randomUUID(), type, date, durationMinutes };
    persistDates([...dates, entry].sort((a, b) => a.date.localeCompare(b.date)));
  }

  function handleRemoveDate(id: string) {
    persistDates(dates.filter((d) => d.id !== id));
  }

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isChatting) return;

    setChatMessages((prev) => [...prev, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setChatInput('');
    setChatError(null);
    setIsChatting(true);
    try {
      const response = await sendTaskChatMessage(task.id, text, conversationId ?? undefined, isSmartMode);
      setConversationId(response.conversationId);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.reply, createdAt: new Date().toISOString() },
      ]);
      if (response.notes !== undefined) {
        setNotes(response.notes);
        setIsEditingNotes(false);
        onTasksChanged();
      }
    } catch {
      setChatError("Something went wrong — I couldn't process that.");
    } finally {
      setIsChatting(false);
    }
  }

  function handleNewChat() {
    setConversationId(null);
    setChatMessages([]);
    setChatError(null);
    setIsHistoryOpen(false);
  }

  async function handleToggleHistory() {
    const opening = !isHistoryOpen;
    setIsHistoryOpen(opening);
    if (opening) {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        setHistory(await listTaskConversations(task.id));
      } catch {
        setHistoryError('Could not load past conversations.');
      } finally {
        setIsLoadingHistory(false);
      }
    }
  }

  async function handleSelectConversation(summary: ConversationSummary) {
    setIsHistoryOpen(false);
    setChatError(null);
    try {
      const conversation = await getTaskConversation(task.id, summary.id);
      setConversationId(conversation.id);
      setChatMessages(conversation.messages);
    } catch {
      setChatError('Could not load that conversation.');
    }
  }

  return (
    <div className="task-detail-backdrop" onClick={handleClose}>
      <div className="task-detail" onClick={(e) => e.stopPropagation()}>
        <header className="task-detail-header">
          <input
            className="task-detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="button" className="task-detail-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="task-detail-status">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-pill status-${s} ${status === s ? 'active' : ''}`}
              onClick={() => handleStatusChange(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="task-detail-project">
          <span className="task-detail-project-label">Project</span>
          <select
            className="task-detail-project-select"
            value={projectId ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setIsNewProjectModalOpen(true);
                return;
              }
              setProjectId(e.target.value || null);
            }}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="__new__">+ New project…</option>
          </select>
        </div>

        <div className="task-detail-dates">
          <div className="task-detail-dates-header">
            <span>Dates</span>
          </div>

          {dateError && <p className="task-detail-dates-error">{dateError}</p>}

          {dates.length > 0 && (
            <ul className="task-date-list">
              {dates.map((d) => (
                <li key={d.id} className={`task-date-item task-date-${d.type}`}>
                  <span className="task-date-dot" />
                  <span className="task-date-type">{DATE_TYPE_LABELS[d.type]}</span>
                  <span className="task-date-value">{d.date}</span>
                  {d.type === 'planned_work' && d.durationMinutes ? (
                    <span className="task-date-duration">{formatDuration(d.durationMinutes)}</span>
                  ) : null}
                  <button
                    type="button"
                    className="task-date-remove"
                    onClick={() => handleRemoveDate(d.id)}
                    aria-label="Remove date"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {estimatedHoursInput.trim() !== '' && (
            <p className="task-detail-estimate-display">
              Estimated total: {estimatedHoursInput}h
            </p>
          )}

          <button
            type="button"
            className="task-date-add"
            onClick={() => setIsDateModalOpen(true)}
          >
            + Add date
          </button>
        </div>

        <ShoppingListSection taskId={task.id} taskTitle={task.title} />

        <div className={`task-detail-notes ${isOnline && isChatOpen ? 'notes-collapsed' : ''}`}>
          <div className="task-detail-notes-header">
            <span>Notes</span>
            {!isEditingNotes && (
              <button type="button" className="link-button" onClick={() => setIsEditingNotes(true)}>
                Edit
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write notes in markdown…"
              rows={10}
            />
          ) : notes ? (
            <div className="markdown-preview">
              <ReactMarkdown>{normalizeMarkdown(notes)}</ReactMarkdown>
            </div>
          ) : (
            <p className="task-detail-notes-empty">No notes yet.</p>
          )}
        </div>

        {isOnline ? (
        <div className={`task-chat ${isChatOpen ? 'task-chat-open' : ''}`}>
          <div className="task-chat-header">
            <button
              type="button"
              className="task-chat-toggle"
              onClick={() => setIsChatOpen((o) => !o)}
              aria-expanded={isChatOpen}
            >
              <span className={`task-chat-chevron ${isChatOpen ? 'open' : ''}`}>›</span>
              <span>Ask AI</span>
            </button>
            {isChatOpen && (
              <div className="task-chat-header-actions">
                <button
                  type="button"
                  className={`task-chat-brain ${isSmartMode ? 'smart-on' : 'smart-off'}`}
                  onClick={() => setIsSmartMode((v) => !v)}
                  aria-pressed={isSmartMode}
                  title={isSmartMode ? 'Smart mode on — using Sonnet' : 'Smart mode off — using Haiku'}
                >
                  <BrainIcon />
                </button>
                <button type="button" className="link-button" onClick={handleNewChat}>
                  New chat
                </button>
                <div className="task-chat-history">
                  <button type="button" className="link-button" onClick={handleToggleHistory}>
                    History
                  </button>
                  {isHistoryOpen && (
                    <div className="task-chat-history-popout">
                      {isLoadingHistory ? (
                        <p className="task-chat-history-empty">Loading…</p>
                      ) : historyError ? (
                        <p className="task-chat-history-empty">{historyError}</p>
                      ) : !history || history.length === 0 ? (
                        <p className="task-chat-history-empty">No past conversations yet.</p>
                      ) : (
                        history.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`task-chat-history-item ${c.id === conversationId ? 'active' : ''}`}
                            onClick={() => handleSelectConversation(c)}
                          >
                            <span className="task-chat-history-item-title">{c.title}</span>
                            <span className="task-chat-history-item-time">{formatRelativeTime(c.updatedAt)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isChatOpen && (
            <>
              {chatMessages.length > 0 && (
                <div className="task-chat-thread" ref={chatThreadRef}>
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`task-chat-message task-chat-message-${m.role}`}>
                      {m.role === 'assistant' ? (
                        <div className="markdown-preview">
                          <ReactMarkdown>{normalizeMarkdown(m.content)}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  ))}
                  {isChatting && <div className="task-chat-message task-chat-message-assistant">Thinking…</div>}
                </div>
              )}
              {chatError && <p className="task-chat-error">{chatError}</p>}

              <form className="task-chat-form" onSubmit={handleChatSubmit}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this task…"
                  disabled={isChatting}
                />
                <button type="submit" disabled={isChatting || !chatInput.trim()}>
                  {isChatting ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
        ) : (
          <p className="task-chat-offline">Ask AI is unavailable while offline.</p>
        )}

        <footer className="task-detail-footer">
          {isConfirmingDelete ? (
            <div className="task-detail-delete-confirm">
              <span>Delete this task?</span>
              <button type="button" className="secondary" onClick={() => setIsConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={handleDeleteConfirmed}>
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="link-button task-detail-delete"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete task
            </button>
          )}
          <div className="task-detail-footer-actions">
            <button type="button" className="secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={!isDirty}
            >
              Save
            </button>
          </div>
        </footer>
      </div>

      {isDateModalOpen && (
        <TaskDateModal
          onClose={() => setIsDateModalOpen(false)}
          onAdd={handleAddDateFromModal}
          estimatedHoursInput={estimatedHoursInput}
          onEstimateChange={persistEstimate}
        />
      )}

      {isNewProjectModalOpen && (
        <ProjectModal
          onClose={() => setIsNewProjectModalOpen(false)}
          onSave={handleCreateProjectFromPicker}
        />
      )}
    </div>
  );
}
