import { useEffect, useState } from 'react';
import { subscribeToNotifications } from './notifications';
import type { NotificationDoc } from './types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(setNotifications, () => {});
    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
}
