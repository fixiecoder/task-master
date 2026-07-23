import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';

function App() {
  const user = auth.currentUser;

  return (
    <div className="landing">
      <header className="topbar">
        <span className="brand">Task Master</span>
        {user && (
          <div className="account">
            <span className="email">{user.email}</span>
            <button type="button" className="sign-out" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="hero">
        <h1>Task Master</h1>
        <p>Task management is coming soon.</p>
      </main>
    </div>
  );
}

export default App;
