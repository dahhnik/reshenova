import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createClient } from '../lib/supabase'
import { writeCell } from '../lib/sheets'
import type { Variables } from '../app'

const candidatesRoute = new Hono<{ Variables: Variables }>()

candidatesRoute.patch('/projects/:id/candidates/:cid/confirm', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const candidateId = c.req.param('cid')
  const supabase = createClient()

  let body: { confirmed_value?: string; correction_note?: string } = {}
  try {
    body = await c.req.json()
  } catch {
    // empty body is fine
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, google_sheet_id')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .single()
  if (!project) return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404)

  const { data: candidate } = await supabase
    .from('decision_candidates')
    .select('id, extracted_value, status, template_field_id')
    .eq('id', candidateId)
    .eq('project_id', projectId)
    .single()
  if (!candidate) return c.json({ error: 'Candidate not found', code: 'NOT_FOUND' }, 404)
  if (!['pending_review', 'auto_confirmed'].includes(candidate.status)) {
    return c.json({ error: 'Candidate already resolved', code: 'ALREADY_RESOLVED' }, 409)
  }

  const { data: field } = await supabase
    .from('template_fields')
    .select('sheet_cell_ref')
    .eq('id', candidate.template_field_id)
    .single()

  const confirmedValue = body.confirmed_value ?? candidate.extracted_value

  // Find and supersede any prior active log entry for this field
  const { data: priorEntry } = await supabase
    .from('decision_log')
    .select('id')
    .eq('project_id', projectId)
    .eq('template_field_id', candidate.template_field_id)
    .is('superseded_by', null)
    .maybeSingle()

  const { data: logEntry, error: logError } = await supabase
    .from('decision_log')
    .insert({
      project_id: projectId,
      template_field_id: candidate.template_field_id,
      candidate_id: candidateId,
      confirmed_value: confirmedValue,
      original_extracted_value: candidate.extracted_value,
      confirmed_by: userId,
      correction_note: body.correction_note ?? null,
    })
    .select()
    .single()

  if (logError || !logEntry) return c.json({ error: 'Failed to create log entry', code: 'DB_ERROR' }, 500)

  if (priorEntry) {
    await supabase.from('decision_log').update({ superseded_by: logEntry.id }).eq('id', priorEntry.id)
  }

  // Write to Google Sheets (non-blocking failure — sheet_written_at stays null for retry)
  try {
    await writeCell(project.google_sheet_id, field!.sheet_cell_ref, confirmedValue)
    await supabase
      .from('decision_log')
      .update({ sheet_written_at: new Date().toISOString() })
      .eq('id', logEntry.id)
  } catch (err) {
    console.error('Sheet write failed:', err)
  }

  await supabase.from('decision_candidates').update({ status: 'confirmed' }).eq('id', candidateId)

  return c.json(logEntry)
})

candidatesRoute.patch('/projects/:id/candidates/:cid/reject', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const candidateId = c.req.param('cid')
  const supabase = createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .single()
  if (!project) return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404)

  const { data: candidate } = await supabase
    .from('decision_candidates')
    .select('id')
    .eq('id', candidateId)
    .eq('project_id', projectId)
    .single()
  if (!candidate) return c.json({ error: 'Candidate not found', code: 'NOT_FOUND' }, 404)

  await supabase.from('decision_candidates').update({ status: 'rejected' }).eq('id', candidateId)

  return c.json({})
})

export { candidatesRoute }
