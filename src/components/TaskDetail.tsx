import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Task, TaskStatus, TaskDateEntry, TaskDateType } from '../types';
import {
  TASK_STATUSES,
  sendTaskChatMessage,
  listTaskConversations,
  getTaskConversation,
  type ChatMessage,
  type ConversationSummary,
} from '../api';
import { DATE_TYPE_LABELS, formatDuration } from '../taskDates';
import { ShoppingListSection } from './ShoppingListSection';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes'>>) => void;
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
  const [title, setTitle] = useState(task.title);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [isEditingNotes, setIsEditingNotes] = useState(!task.notes);

  const [dates, setDates] = useState<TaskDateEntry[]>(task.dates ?? []);
  const [estimatedHoursInput, setEstimatedHoursInput] = useState(
    task.estimatedMinutes != null ? String(task.estimatedMinutes / 60) : '',
  );
  const [newDateType, setNewDateType] = useState<TaskDateType>('planned_work');
  const [newDateValue, setNewDateValue] = useState('');
  const [newDateDuration, setNewDateDuration] = useState('');

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
    || estimatedMinutes !== (task.estimatedMinutes ?? null);

  function handleSave() {
    onSave(task.id, { title, status, notes: notes || null, dates, estimatedMinutes });
    setIsEditingNotes(false);
  }

  function handleAddDate(e: FormEvent) {
    e.preventDefault();
    if (!newDateValue) return;
    const entry: TaskDateEntry = {
      id: crypto.randomUUID(),
      type: newDateType,
      date: newDateValue,
      durationMinutes: newDateType === 'planned_work' && newDateDuration
        ? Number(newDateDuration) * 60
        : null,
    };
    setDates((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDateValue('');
    setNewDateDuration('');
  }

  function handleRemoveDate(id: string) {
    setDates((prev) => prev.filter((d) => d.id !== id));
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
      const response = await sendTaskChatMessage(task.id, text, conversationId ?? undefined);
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
    <div className="task-detail-backdrop" onClick={onClose}>
      <div className="task-detail" onClick={(e) => e.stopPropagation()}>
        <header className="task-detail-header">
          <input
            className="task-detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="button" className="task-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="task-detail-status">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-pill status-${s} ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="task-detail-dates">
          <div className="task-detail-dates-header">
            <span>Dates</span>
          </div>

          {dates.length === 0 ? (
            <p className="task-detail-dates-empty">No dates yet.</p>
          ) : (
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

          <form className="task-date-form" onSubmit={handleAddDate}>
            <select value={newDateType} onChange={(e) => setNewDateType(e.target.value as TaskDateType)}>
              <option value="start">Start date</option>
              <option value="due">Due date</option>
              <option value="planned_work">Planned work</option>
            </select>
            <input
              type="date"
              value={newDateValue}
              onChange={(e) => setNewDateValue(e.target.value)}
              required
            />
            {newDateType === 'planned_work' && (
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Hours"
                value={newDateDuration}
                onChange={(e) => setNewDateDuration(e.target.value)}
              />
            )}
            <button type="submit" disabled={!newDateValue}>Add</button>
          </form>

          <label className="task-detail-estimate">
            Estimated total time (hours)
            <input
              type="number"
              min="0"
              step="0.25"
              placeholder="e.g. 8"
              value={estimatedHoursInput}
              onChange={(e) => setEstimatedHoursInput(e.target.value)}
            />
          </label>
        </div>

        <ShoppingListSection taskId={task.id} isOnline={isOnline} />

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
              <button type="button" className="danger" onClick={() => onDelete(task.id)} disabled={!isOnline}>
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="link-button task-detail-delete"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={!isOnline}
              title={!isOnline ? "Can't delete while offline" : undefined}
            >
              Delete task
            </button>
          )}
          <div className="task-detail-footer-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={!isDirty || !isOnline}
              title={!isOnline ? "Can't save while offline" : undefined}
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
