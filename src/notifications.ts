import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { auth, db, messagingReady } from './firebase';
import type { NotificationDoc, NotificationSettings } from './types';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

function requireUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

// Must be called from a user gesture (e.g. a button's onClick) — Chrome
// silently ignores/ties Notification.requestPermission() to a click, it
// won't reliably prompt if called on mount or from an async callback.
export async function enablePushNotifications(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const messaging = await messagingReady;
  if (!messaging) return 'denied'; // unsupported browser/context

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return 'denied';

  const uid = requireUid();
  await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
    token,
    createdAt: serverTimestamp(),
    userAgent: navigator.userAgent,
  });
  return 'granted';
}

export async function disablePushNotifications(): Promise<void> {
  const messaging = await messagingReady;
  if (!messaging) return;

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => null);
  if (!token) return;

  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
}

export async function saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  const uid = requireUid();
  await setDoc(
    doc(db, 'users', uid, 'notificationSettings', 'default'),
    { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...settings },
    { merge: true },
  );
}

export function subscribeToNotificationSettings(
  onChange: (settings: NotificationSettings | null) => void,
): Unsubscribe {
  const uid = requireUid();
  return onSnapshot(doc(db, 'users', uid, 'notificationSettings', 'default'), (snap) => {
    onChange(snap.exists() ? (snap.data() as NotificationSettings) : null);
  });
}

export function subscribeToNotifications(
  onChange: (items: NotificationDoc[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const uid = requireUid();
  const notificationsQuery = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    notificationsQuery,
    (snap) => onChange(snap.docs.map((d) => d.data() as NotificationDoc)),
    onError,
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(db, 'users', uid, 'notifications', id), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const uid = requireUid();
  const snap = await getDocs(collection(db, 'users', uid, 'notifications'));
  const unread = snap.docs.filter((d) => !d.data().read);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  unread.forEach((d) => batch.update(d.ref, { read: true, readAt: serverTimestamp() }));
  await batch.commit();
}

// Chrome doesn't show an OS notification for FCM messages received while
// the tab is foregrounded, and the live onSnapshot listener above already
// updates the tray as soon as the digest writes its Firestore doc — so
// this registration exists only to prevent an unhandled-message warning,
// not to render anything.
messagingReady.then((messaging) => {
  if (messaging) onMessage(messaging, () => {});
});
