import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarPage } from './components/CalendarPage';
import { NavBar } from './components/NavBar';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const isSignedIn = user !== null;

  return (
    <div className="landing">
      <header className="topbar">
        <span className="brand">Task Master</span>
        <NavBar />
        <div className="account">
          <span
            className={`status ${isSignedIn ? 'status-in' : 'status-out'}`}
            title={isSignedIn ? user.email ?? undefined : undefined}
          >
            <span className="status-dot" />
            {isSignedIn ? 'Signed in' : 'Signed out'}
          </span>
        </div>
      </header>

      <main className="board-main">
        <Routes>
          <Route path="/" element={<KanbanBoard />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
