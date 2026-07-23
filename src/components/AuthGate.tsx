import { type ReactNode, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';

type State = 'checking' | 'authenticated' | 'redirecting';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<State>('checking');
  // useRef so this flag survives React StrictMode's double-invocation of effects.
  // A plain `let` inside the effect resets on the second invocation, causing a
  // redirect loop in dev: the URL is cleaned on the first run so the second run
  // sees no token, sets the flag to false, and redirects when onAuthStateChanged
  // fires null while signInWithCustomToken is still in-flight.
  const signingInWithTokenRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customToken = params.get('customToken');
    const hubUrl = (import.meta.env.VITE_AUTH_HUB_URL as string | undefined) ?? 'https://auth.colinadams.co';

    if (customToken) {
      signingInWithTokenRef.current = true;
      params.delete('customToken');
      const cleanSearch = params.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState({}, '', cleanUrl);

      signInWithCustomToken(auth, customToken).catch(() => {
        // Token invalid/expired — clear the flag and let onAuthStateChanged redirect
        signingInWithTokenRef.current = false;
        window.location.href = `${hubUrl}?redirect=${encodeURIComponent(window.location.origin)}`;
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState('authenticated');
      } else if (!signingInWithTokenRef.current) {
        setState('redirecting');
        window.location.href = `${hubUrl}?redirect=${encodeURIComponent(window.location.origin)}`;
      }
    });

    return unsubscribe;
  }, []);

  if (state === 'authenticated') {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        border: '3px solid #1e3a6e',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
