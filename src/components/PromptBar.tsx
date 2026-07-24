import { useState, type FormEvent } from 'react';
import { sendPrompt } from '../api';

interface PromptBarProps {
  onTasksChanged: () => void;
}

const DURATION_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PromptBar({ onTasksChanged }: PromptBarProps) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [askDuration, setAskDuration] = useState(false);

  async function submit(text: string) {
    if (!text || isSending) return;

    setIsSending(true);
    setReply(null);
    try {
      const response = await sendPrompt(text, conversationId);
      setReply(response.reply);
      setConversationId(response.conversationId);
      setAskDuration(response.askDuration ?? false);
      setMessage('');
      onTasksChanged();
    } catch {
      setReply("Something went wrong — I couldn't process that.");
      setAskDuration(false);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(message.trim());
  }

  function handleDurationPick(hours: number) {
    submit(`${hours} hour${hours === 1 ? '' : 's'}`);
  }

  function handleNewConversation() {
    setConversationId(undefined);
    setReply(null);
    setAskDuration(false);
  }

  return (
    <div className="prompt-bar-wrap">
      <form className="prompt-bar" onSubmit={handleSubmit}>
        <span className="prompt-bar-prefix" aria-hidden="true">›</span>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            conversationId ? 'Reply…' : 'Tell Task Master what to do…'
          }
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !message.trim()}>
          {isSending ? 'Thinking…' : 'Send'}
        </button>
      </form>
      {reply && (
        <p className="prompt-reply">
          {reply}
          {conversationId && (
            <button
              type="button"
              className="prompt-reply-reset"
              onClick={handleNewConversation}
            >
              New conversation
            </button>
          )}
        </p>
      )}
      {askDuration && (
        <div className="prompt-duration-picker">
          {DURATION_HOURS.map((hours) => (
            <button
              key={hours}
              type="button"
              className="prompt-duration-option"
              disabled={isSending}
              onClick={() => handleDurationPick(hours)}
            >
              {hours}h
            </button>
          ))}
          <span className="prompt-duration-hint">or type your own above</span>
        </div>
      )}
    </div>
  );
}
