import { render } from 'solid-js/web'
import { Router, Route, useNavigate } from '@solidjs/router'
import { createSignal, createEffect, onCleanup, Show, type ParentProps } from 'solid-js'
import { getSession, onAuthStateChange } from './lib/auth'
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
  return (
    <AuthGuard>
      <div class="p-8 text-gray-600">Dashboard — coming soon.</div>
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
