import { useState, type FormEvent } from 'react';
import { sendPrompt } from '../api';

interface PromptBarProps {
  onTasksChanged: () => void;
}

export function PromptBar({ onTasksChanged }: PromptBarProps) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setReply(null);
    try {
      const response = await sendPrompt(text);
      setReply(response.reply);
      setMessage('');
      onTasksChanged();
    } catch {
      setReply("Something went wrong — I couldn't process that.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="prompt-bar-wrap">
      <form className="prompt-bar" onSubmit={handleSubmit}>
        <span className="prompt-bar-prefix" aria-hidden="true">›</span>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell Task Master what to do…"
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !message.trim()}>
          {isSending ? 'Thinking…' : 'Send'}
        </button>
      </form>
      {reply && <p className="prompt-reply">{reply}</p>}
    </div>
  );
}
