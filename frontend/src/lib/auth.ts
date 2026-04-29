import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session!
}

export async function signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return { confirmationRequired: !data.session }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => subscription.unsubscribe()
}
