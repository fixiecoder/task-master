import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../useNotifications';
import { markAllNotificationsRead, markNotificationRead } from '../notifications';
import './NotificationsTray.css';

export function NotificationsTray() {
  const { notifications, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function openTask(notificationId: string, taskId: string) {
    markNotificationRead(notificationId);
    setOpen(false);
    navigate(`/?task=${taskId}`);
  }

  return (
    <div className="notifications-tray">
      <button
        type="button"
        className="bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="tray-backdrop" onClick={() => setOpen(false)} />
          <div className="tray-panel">
            <div className="tray-header">
              <span>Notifications</span>
              <button
                type="button"
                className="tray-mark-all"
                onClick={() => markAllNotificationsRead()}
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
            <ul className="tray-list">
              {notifications.length === 0 && <li className="tray-empty">No notifications yet</li>}
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={n.read ? 'tray-item read' : 'tray-item unread'}
                  onClick={() => !n.read && markNotificationRead(n.id)}
                >
                  <div className="tray-item-title">{n.title}</div>
                  <div className="tray-item-body">{n.body}</div>
                  {n.taskIds?.length > 0 && (
                    <ul className="tray-item-tasks">
                      {n.taskIds.map((taskId, i) => (
                        <li key={taskId}>
                          <button
                            type="button"
                            className="tray-item-task-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTask(n.id, taskId);
                            }}
                          >
                            {n.taskTitles?.[i] ?? 'Untitled task'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c-3.31 0-6 2.69-6 6v3.5L4 15v1h16v-1l-2-2.5V9c0-3.31-2.69-6-6-6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
