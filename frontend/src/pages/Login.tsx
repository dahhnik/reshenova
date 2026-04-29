import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { signIn, signUp } from '../lib/auth'

export default function Login() {
  const [mode, setMode] = createSignal<'signin' | 'signup'>('signin')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [message, setMessage] = createSignal('')
  const [isError, setIsError] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const navigate = useNavigate()

  function toggle() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setMessage('')
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)
    try {
      if (mode() === 'signin') {
        await signIn(email(), password())
        navigate('/', { replace: true })
      } else {
        const { confirmationRequired } = await signUp(email(), password())
        if (confirmationRequired) {
          setMessage('Check your email for a confirmation link.')
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      setIsError(true)
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h1 class="text-2xl font-bold text-center text-gray-900">Reshenova</h1>
        <form class="space-y-4" onSubmit={handleSubmit}>
          {message() && (
            <div
              class={`p-3 text-sm rounded border ${
                isError()
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-green-700 bg-green-50 border-green-200'
              }`}
            >
              {message()}
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
              autocomplete={mode() === 'signin' ? 'current-password' : 'new-password'}
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
            {loading() ? '…' : mode() === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p class="text-center text-sm text-gray-500">
          {mode() === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={toggle} class="text-indigo-600 hover:underline font-medium">
            {mode() === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
