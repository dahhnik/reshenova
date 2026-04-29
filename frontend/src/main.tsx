import { render } from 'solid-js/web'
import { Router, Route, useNavigate } from '@solidjs/router'
import { createSignal, createEffect, onCleanup, Show, type ParentProps } from 'solid-js'
import { getSession, onAuthStateChange, signOut } from './lib/auth'
import Login from './pages/Login'
import './index.css'

function AuthGuard(props: ParentProps) {
  const navigate = useNavigate()
  const [ready, setReady] = createSignal(false)
  const [authed, setAuthed] = createSignal(false)

  createEffect(async () => {
    const session = await getSession()
    if (!session) navigate('/login', { replace: true })
    setAuthed(!!session)
    setReady(true)
  })

  const unsub = onAuthStateChange((session) => {
    if (!session) navigate('/login', { replace: true })
    setAuthed(!!session)
  })
  onCleanup(unsub)

  return (
    <Show when={ready() && authed()}>
      {props.children}
    </Show>
  )
}

function Dashboard() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AuthGuard>
      <div class="min-h-screen bg-gray-50">
        <header class="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <span class="font-semibold text-gray-900">Reshenova</span>
          <button
            onClick={handleSignOut}
            class="text-sm text-gray-500 hover:text-gray-900"
          >
            Sign out
          </button>
        </header>
        <div class="p-8 text-gray-600">Dashboard — coming soon.</div>
      </div>
    </AuthGuard>
  )
}

function App() {
  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route path="*" component={Dashboard} />
    </Router>
  )
}

render(() => <App />, document.getElementById('root')!)
