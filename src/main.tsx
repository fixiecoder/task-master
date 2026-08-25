import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './components/AuthGate.tsx'
import { auth } from './firebase.ts'
import { replayOutbox } from './syncQueue.ts'
import { dispatchMutation } from './outbox.ts'

// Re-drives any mutation still pending from a previous session (the tab was
// reloaded or killed while offline, before it reached the network) as soon
// as we know who's signed in — a signed-out replay attempt would just fail.
const unsubscribeAuthForReplay = onAuthStateChanged(auth, (user) => {
  if (!user) return
  unsubscribeAuthForReplay()
  replayOutbox(dispatchMutation)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
)
