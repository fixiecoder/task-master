import type { Task } from '../types';
import { todayKey } from '../taskDates';
import './ProgressBar.css';

interface ProgressBarProps {
  task: Task;
}

export function ProgressBar({ task }: ProgressBarProps) {
  const total = task.estimatedMinutes;
  if (!total || total <= 0) return null;

  const today = todayKey();
  let pastMinutes = 0;
  let futureMinutes = 0;
  for (const entry of task.dates ?? []) {
    if (entry.type !== 'planned_work' || !entry.durationMinutes) continue;
    if (entry.date <= today) pastMinutes += entry.durationMinutes;
    else futureMinutes += entry.durationMinutes;
  }

  const greenPct = (Math.min(pastMinutes, total) / total) * 100;
  const remainAfterGreen = Math.max(total - pastMinutes, 0);
  const amberPct = (Math.min(futureMinutes, remainAfterGreen) / total) * 100;
  const redPct = Math.max(100 - greenPct - amberPct, 0);

  return (
    <div className="progress-bar" title={`${pastMinutes}m done, ${futureMinutes}m scheduled, of ${total}m estimated`}>
      {greenPct > 0 && <span className="progress-segment progress-green" style={{ width: `${greenPct}%` }} />}
      {amberPct > 0 && <span className="progress-segment progress-amber" style={{ width: `${amberPct}%` }} />}
      {redPct > 0 && <span className="progress-segment progress-red" style={{ width: `${redPct}%` }} />}
    </div>
  );
}
