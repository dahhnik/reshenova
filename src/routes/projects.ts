import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createClient } from '../lib/supabase'
import type { Variables } from '../app'

export const projectsRoute = new Hono<{ Variables: Variables }>()

projectsRoute.get('/projects', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const supabase = createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, active, created_at, telegram_chat_id, google_sheet_id')
    .eq('owner_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (!projects) return c.json([])

  const ids = projects.map((p) => p.id)
  const { data: pending } =
    ids.length > 0
      ? await supabase
          .from('decision_candidates')
          .select('project_id')
          .in('project_id', ids)
          .eq('status', 'pending_review')
      : { data: [] }

  const counts = ((pending ?? []) as { project_id: string }[]).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.project_id] = (acc[row.project_id] ?? 0) + 1
      return acc
    },
    {}
  )

  return c.json(projects.map((p) => ({ ...p, pending_review_count: counts[p.id] ?? 0 })))
})
