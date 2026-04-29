import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createClient } from '../lib/supabase'
import type { Variables } from '../app'

const queueRoute = new Hono<{ Variables: Variables }>()

queueRoute.get('/projects/:id/decisions/queue', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const supabase = createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .single()

  if (!project) return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404)

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('decision_candidates')
    .select('id, extracted_value, confidence, is_contradiction, extraction_note, status, source_message_ids, created_at, template_field_id')
    .eq('project_id', projectId)
    .or(`status.eq.pending_review,and(status.eq.auto_confirmed,created_at.gte.${cutoff})`)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: 'Database error', code: 'DB_ERROR' }, 500)

  const fieldIds = [...new Set(candidates?.map((c) => c.template_field_id) ?? [])]
  const messageIds = [...new Set(candidates?.flatMap((c) => c.source_message_ids) ?? [])]

  const [{ data: fields }, { data: messages }] = await Promise.all([
    fieldIds.length > 0
      ? supabase.from('template_fields').select('id, name, category').in('id', fieldIds)
      : { data: [] },
    messageIds.length > 0
      ? supabase.from('messages').select('id, sender_name, content, sent_at').in('id', messageIds)
      : { data: [] },
  ])

  const fieldsById = Object.fromEntries((fields ?? []).map((f) => [f.id, f]))
  const messagesById = Object.fromEntries((messages ?? []).map((m) => [m.id, m]))

  const format = (candidate: NonNullable<typeof candidates>[number]) => ({
    id: candidate.id,
    template_field: fieldsById[candidate.template_field_id],
    extracted_value: candidate.extracted_value,
    confidence: candidate.confidence,
    is_contradiction: candidate.is_contradiction,
    source_messages: candidate.source_message_ids.map((id) => messagesById[id]).filter(Boolean),
    extraction_note: candidate.extraction_note,
    created_at: candidate.created_at,
  })

  return c.json({
    pending_review: (candidates ?? []).filter((c) => c.status === 'pending_review').map(format),
    auto_confirmed: (candidates ?? [])
      .filter((c) => c.status === 'auto_confirmed')
      .map((c) => ({ ...format(c), confirmed_at: c.created_at })),
  })
})

export { queueRoute }
