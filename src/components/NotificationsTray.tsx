import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../useNotifications';
import { markAllNotificationsRead, markNotificationRead } from '../notifications';
import './NotificationsTray.css';
import { BellIcon } from '../icons';

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
                  {n.taskIds?.length > 0 ? (
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
                  ) : (
                    <div className="tray-item-body">{n.body}</div>
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
