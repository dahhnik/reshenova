/**
 * Inserts sample decision candidates into a project for local dev / manual testing.
 * Usage: PROJECT_ID=<uuid> npx tsx tests/fixtures/seed-decision-queue.ts
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/supabase'

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const projectId = process.env.PROJECT_ID
if (!projectId) {
  console.error('PROJECT_ID env var required')
  process.exit(1)
}

// Use the first available template field IDs
const { data: fields } = await supabase
  .from('template_fields')
  .select('id')
  .limit(5)

if (!fields || fields.length < 3) {
  console.error('Need at least 3 template fields in DB')
  process.exit(1)
}

// Insert a dummy source message
const { data: message } = await supabase
  .from('messages')
  .insert({
    project_id: projectId,
    telegram_message_id: 999001,
    sender_name: 'Ivan Petrov',
    content: 'Confirmed: tiles from Leroy Merlin, 500 EUR budget',
    sent_at: new Date().toISOString(),
  })
  .select()
  .single()

if (!message) {
  console.error('Failed to insert message')
  process.exit(1)
}

const candidates = [
  {
    project_id: projectId,
    template_field_id: fields[0].id,
    extracted_value: 'Leroy Merlin ceramic tiles',
    confidence: 0.62,
    is_contradiction: false,
    extraction_note: 'Mentioned once; no quantity specified',
    status: 'pending_review' as const,
    source_message_ids: [message.id],
  },
  {
    project_id: projectId,
    template_field_id: fields[1].id,
    extracted_value: '€500',
    confidence: 0.45,
    is_contradiction: true,
    extraction_note: 'Two different amounts mentioned: €500 and €450',
    status: 'pending_review' as const,
    source_message_ids: [message.id],
  },
  {
    project_id: projectId,
    template_field_id: fields[2].id,
    extracted_value: 'Contractor: Mikhail',
    confidence: 0.71,
    is_contradiction: false,
    extraction_note: null,
    status: 'pending_review' as const,
    source_message_ids: [message.id],
  },
  {
    project_id: projectId,
    template_field_id: fields[0].id,
    extracted_value: 'White matte finish',
    confidence: 0.91,
    is_contradiction: false,
    extraction_note: null,
    status: 'auto_confirmed' as const,
    source_message_ids: [message.id],
  },
  {
    project_id: projectId,
    template_field_id: fields[1].id,
    extracted_value: 'Start date: June 15',
    confidence: 0.88,
    is_contradiction: false,
    extraction_note: null,
    status: 'auto_confirmed' as const,
    source_message_ids: [message.id],
  },
]

const { error } = await supabase.from('decision_candidates').insert(candidates)
if (error) {
  console.error('Insert failed:', error)
  process.exit(1)
}

console.log(`Seeded ${candidates.length} candidates for project ${projectId}`)
