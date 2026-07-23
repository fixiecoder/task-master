import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { KanbanBoard } from './components/KanbanBoard';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const isSignedIn = user !== null;

  return (
    <div className="landing">
      <header className="topbar">
        <span className="brand">Task Master</span>
        <div className="account">
          <span className={`status ${isSignedIn ? 'status-in' : 'status-out'}`}>
            <span className="status-dot" />
            {isSignedIn ? `Signed in as ${user.email}` : 'Signed out'}
          </span>
          {isSignedIn && (
            <button type="button" className="sign-out" onClick={() => signOut(auth)}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="board-main">
        <KanbanBoard />
      </main>
    </div>
  );
}

export default App;
