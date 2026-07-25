import { useEffect, useState } from 'react';
import { runDigestNow } from '../api';
import {
  disablePushNotifications,
  enablePushNotifications,
  saveNotificationSettings,
  subscribeToNotificationSettings,
} from '../notifications';
import './NotificationSettings.css';

const DETECTED_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function NotificationSettingsPage() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [reminderTime, setReminderTime] = useState('08:00');
  const [busy, setBusy] = useState(false);
  const [digestStatus, setDigestStatus] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToNotificationSettings((settings) => {
        if (settings?.morningReminderTime) setReminderTime(settings.morningReminderTime);
      }),
    [],
  );

  async function handleEnable() {
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      setPermission(result);
      if (result === 'granted') {
        await saveNotificationSettings({ enabled: true, morningReminderTime: reminderTime });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      await disablePushNotifications();
      await saveNotificationSettings({ enabled: false });
    } finally {
      setBusy(false);
    }
  }

  function handleTimeBlur() {
    saveNotificationSettings({ morningReminderTime: reminderTime });
  }

  async function handleRunDigestNow() {
    setDigestStatus('Checking…');
    try {
      const result = await runDigestNow();
      setDigestStatus(
        result.sent
          ? `Sent — ${result.taskCount} task${result.taskCount === 1 ? '' : 's'} planned today.`
          : 'No tasks planned for today.',
      );
    } catch {
      setDigestStatus('Could not run digest.');
    }
  }

  return (
    <div className="settings-page">
      <h1>Notifications</h1>

      <section className="settings-section">
        <h2>Push notifications</h2>
        <p className="settings-hint">
          Status: <strong>{permission}</strong>
        </p>
        {permission !== 'granted' ? (
          <button type="button" onClick={handleEnable} disabled={busy}>
            Enable push notifications
          </button>
        ) : (
          <button type="button" onClick={handleDisable} disabled={busy}>
            Disable on this device
          </button>
        )}
      </section>

      <section className="settings-section">
        <h2>Morning reminder</h2>
        <label className="settings-field">
          Remind me at
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            onBlur={handleTimeBlur}
          />
        </label>
        <p className="settings-hint">Detected timezone: {DETECTED_TIMEZONE}</p>
      </section>

      <section className="settings-section">
        <h2>Test</h2>
        <button type="button" onClick={handleRunDigestNow}>
          Send digest now
        </button>
        {digestStatus && <p className="settings-hint">{digestStatus}</p>}
      </section>
    </div>
  );
}
