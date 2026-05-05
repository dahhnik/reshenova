import { Hono } from 'hono'
import { createClient } from '../lib/supabase'
import { validateWebhookSecret } from '../lib/telegram'
import { extractDecisions } from '../lib/extraction'
import { writeCell } from '../lib/sheets'
import { routeCandidate } from '../lib/candidates'

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name: string; last_name?: string }
    chat: { id: number; title?: string; type: string }
    date: number
    text?: string
  }
}

type Project = {
  id: string
  template_id: string
  google_sheet_id: string
  webhook_secret: string
}

export const webhookRoute = new Hono()

webhookRoute.post('/telegram/webhook', async (c) => {
  let body: TelegramUpdate
  try {
    body = await c.req.json<TelegramUpdate>()
  } catch {
    return c.json({}, 200)
  }

  const chatId = body.message?.chat?.id
  if (chatId === undefined) return c.json({}, 200)

  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('id, template_id, google_sheet_id, webhook_secret')
    .eq('telegram_chat_id', chatId)
    .eq('active', true)
    .single()

  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token') ?? ''
  if (!project || !validateWebhookSecret(secretHeader, project.webhook_secret)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  // Return 200 immediately, process in background
  const responsePromise = c.json({}, 200)
  void processWebhookUpdate(project, body)
  return responsePromise
})

async function processWebhookUpdate(project: Project, update: TelegramUpdate): Promise<void> {
  if (!update.message?.text) return

  const msg = update.message
  const text: string = update.message.text
  const supabase = createClient()

  const senderName = msg.from
    ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
    : null

  const { data: messageRow, error: insertError } = await supabase
    .from('messages')
    .insert({
      project_id: project.id,
      telegram_message_id: msg.message_id,
      sender_name: senderName,
      sender_telegram_id: msg.from?.id ?? null,
      content: text,
      sent_at: new Date(msg.date * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    // Duplicate message — skip
    if ((insertError as { code?: string }).code === '23505') return
    console.error('Failed to insert message:', insertError)
    return
  }

  const { data: fields } = await supabase
    .from('template_fields')
    .select('id, name, category, sheet_cell_ref')
    .eq('template_id', project.template_id)

  if (!fields || fields.length === 0) return

  const { data: logEntries } = await supabase
    .from('decision_log')
    .select('template_field_id, confirmed_value')
    .eq('project_id', project.id)
    .is('superseded_by', null)

  const confirmedDecisions = (logEntries ?? []).map((entry) => {
    const field = fields.find((f) => f.id === entry.template_field_id)
    return {
      field_name: field?.name ?? '',
      confirmed_value: entry.confirmed_value,
    }
  }).filter((d) => d.field_name !== '')

  const messageForExtraction = {
    sender_name: senderName,
    content: text,
    sent_at: new Date(msg.date * 1000).toISOString(),
  }

  let candidates
  try {
    candidates = await extractDecisions([messageForExtraction], fields, confirmedDecisions)
  } catch (err) {
    console.error('extractDecisions failed:', err)
    return
  }

  for (const candidate of candidates) {
    const status = routeCandidate(candidate.confidence, candidate.is_contradiction)

    const { data: candidateRow, error: candidateError } = await supabase
      .from('decision_candidates')
      .insert({
        project_id: project.id,
        template_field_id: candidate.template_field_id,
        extracted_value: candidate.extracted_value,
        confidence: candidate.confidence,
        status,
        source_message_ids: messageRow ? [messageRow.id] : [],
        is_contradiction: candidate.is_contradiction,
        extraction_note: candidate.extraction_note,
      })
      .select('id')
      .single()

    if (candidateError || !candidateRow) {
      console.error('Failed to insert candidate:', candidateError)
      continue
    }

    if (status === 'auto_confirmed') {
      const field = fields.find((f) => f.id === candidate.template_field_id)
      if (!field) continue

      const { data: priorEntry } = await supabase
        .from('decision_log')
        .select('id')
        .eq('project_id', project.id)
        .eq('template_field_id', candidate.template_field_id)
        .is('superseded_by', null)
        .maybeSingle()

      const { data: logEntry, error: logError } = await supabase
        .from('decision_log')
        .insert({
          project_id: project.id,
          template_field_id: candidate.template_field_id,
          candidate_id: candidateRow.id,
          confirmed_value: candidate.extracted_value,
          original_extracted_value: candidate.extracted_value,
          confirmed_by: null,
        })
        .select('id')
        .single()

      if (logError || !logEntry) {
        console.error('Failed to insert auto_confirmed log entry:', logError)
        continue
      }

      if (priorEntry) {
        await supabase
          .from('decision_log')
          .update({ superseded_by: logEntry.id })
          .eq('id', priorEntry.id)
      }

      try {
        await writeCell(project.google_sheet_id, field.sheet_cell_ref, candidate.extracted_value)
        await supabase
          .from('decision_log')
          .update({ sheet_written_at: new Date().toISOString() })
          .eq('id', logEntry.id)
      } catch (err) {
        console.error('Sheet write failed:', err)
      }
    }
  }
}
