import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { signIn } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const navigate = useNavigate()

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email(), password())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h1 class="text-2xl font-bold text-center text-gray-900">Reshenova</h1>
        <form class="space-y-4" onSubmit={handleSubmit}>
          {error() && (
            <div class="p-3 text-sm text-red-700 bg-red-50 rounded border border-red-200">
              {error()}
            </div>
          )}
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              autocomplete="email"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              autocomplete="current-password"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading()}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading() ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
