import { Route, Routes } from 'react-router-dom';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarPage } from './components/CalendarPage';
import { ShoppingView } from './components/ShoppingView';
import { NavBar } from './components/NavBar';
import { NotificationsTray } from './components/NotificationsTray';
import { NotificationSettingsPage } from './components/NotificationSettings';
import { PromptBar } from './components/PromptBar';
import { useOnlineStatus } from './useOnlineStatus';
import './App.css';

function App() {
  const isOnline = useOnlineStatus();

  return (
    <div className="landing">
      <header className="topbar">
        <NavBar />
        <div className="account">
          <NotificationsTray />
        </div>
      </header>

      <main className="board-main">
        <Routes>
          <Route path="/" element={<KanbanBoard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/shopping" element={<ShoppingView />} />
          <Route path="/settings" element={<NotificationSettingsPage />} />
        </Routes>
      </main>

      {isOnline && <PromptBar onTasksChanged={() => {}} />}
    </div>
  );
}

export default App;
