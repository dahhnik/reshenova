/**
 * Seeds the database with a test user, project, and decision candidates for local dev.
 *
 * Usage:
 *   npx tsx scripts/seed-dev.ts
 *
 * Optional env overrides (all have defaults):
 *   SEED_EMAIL=me@example.com
 *   SEED_PASSWORD=password123
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Database } from '../src/lib/supabase'

// Load .env.local manually (tsx doesn't auto-load it)
const envPath = resolve(process.cwd(), '.env.local')
try {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
} catch {
  // ignore missing file
}

const SEED_EMAIL = process.env.SEED_EMAIL ?? 'dev@reshenova.local'
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'devpassword123!'

const admin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  console.log(`\nSeeding dev database at ${process.env.SUPABASE_URL}\n`)

  // ── User ────────────────────────────────────────────────────────────────────
  let userId: string

  const { data: existing } = await admin.auth.admin.listUsers()
  const existingUser = existing?.users.find((u) => u.email === SEED_EMAIL)

  if (existingUser) {
    userId = existingUser.id
    console.log(`✓ User already exists: ${SEED_EMAIL} (${userId})`)
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
    })
    if (error || !created.user) {
      console.error('✗ Failed to create user:', error)
      process.exit(1)
    }
    userId = created.user.id
    console.log(`✓ Created user: ${SEED_EMAIL} (${userId})`)
  }

  // ── Template ─────────────────────────────────────────────────────────────────
  const { data: template } = await admin
    .from('templates')
    .select('id')
    .eq('name', 'Residential Renovation')
    .single()

  if (!template) {
    console.error('✗ Seed template "Residential Renovation" not found — run supabase db push first')
    process.exit(1)
  }

  const { data: fields } = await admin
    .from('template_fields')
    .select('id, name, category')
    .eq('template_id', template.id)
    .order('sort_order')
    .limit(5)

  if (!fields || fields.length < 3) {
    console.error('✗ Not enough template fields found')
    process.exit(1)
  }

  console.log(`✓ Template: Residential Renovation (${fields.length} fields)`)

  // ── Project ──────────────────────────────────────────────────────────────────
  const existingProject = await admin
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
    .eq('name', 'Dev Test Project')
    .maybeSingle()

  let projectId: string

  if (existingProject.data) {
    projectId = existingProject.data.id
    console.log(`✓ Project already exists (${projectId})`)
  } else {
    const { data: project, error } = await admin
      .from('projects')
      .insert({
        owner_id: userId,
        name: 'Dev Test Project',
        telegram_chat_id: -100123456789,
        google_sheet_id: 'mock-sheet-id',
        template_id: template.id,
        webhook_secret: 'dev-secret',
      })
      .select('id')
      .single()

    if (error || !project) {
      console.error('✗ Failed to create project:', error)
      process.exit(1)
    }
    projectId = project.id
    console.log(`✓ Created project (${projectId})`)
  }

  // ── Messages ─────────────────────────────────────────────────────────────────
  const msgBase = Date.now()
  const { data: messages, error: msgError } = await admin
    .from('messages')
    .insert([
      {
        project_id: projectId,
        telegram_message_id: msgBase + 1,
        sender_name: 'Ivan Petrov',
        content: 'Agreed on Leroy Merlin tiles, 500 EUR budget for the bathroom',
        sent_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        project_id: projectId,
        telegram_message_id: msgBase + 2,
        sender_name: 'Maria Sidorova',
        content: 'Actually I think the budget was 450 EUR, not 500',
        sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        project_id: projectId,
        telegram_message_id: msgBase + 3,
        sender_name: 'Ivan Petrov',
        content: 'Contractor will be Mikhail, starting June 15',
        sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ])
    .select('id')

  if (msgError || !messages) {
    console.error('✗ Failed to insert messages:', msgError)
    process.exit(1)
  }
  console.log(`✓ Created ${messages.length} messages`)

  const [msg1, msg2, msg3] = messages

  // ── Decision Candidates ──────────────────────────────────────────────────────
  const { error: candError } = await admin.from('decision_candidates').insert([
    {
      project_id: projectId,
      template_field_id: fields[0].id,
      extracted_value: 'Leroy Merlin ceramic tiles',
      confidence: 0.62,
      is_contradiction: false,
      extraction_note: 'Tile brand mentioned once; no model number specified',
      status: 'pending_review',
      source_message_ids: [msg1.id],
    },
    {
      project_id: projectId,
      template_field_id: fields[1].id,
      extracted_value: '€500',
      confidence: 0.45,
      is_contradiction: true,
      extraction_note: 'Conflict: Ivan said €500, Maria said €450',
      status: 'pending_review',
      source_message_ids: [msg1.id, msg2.id],
    },
    {
      project_id: projectId,
      template_field_id: fields[2].id,
      extracted_value: 'Mikhail',
      confidence: 0.71,
      is_contradiction: false,
      extraction_note: null,
      status: 'pending_review',
      source_message_ids: [msg3.id],
    },
    {
      project_id: projectId,
      template_field_id: fields[3].id,
      extracted_value: 'June 15',
      confidence: 0.91,
      is_contradiction: false,
      extraction_note: null,
      status: 'auto_confirmed',
      source_message_ids: [msg3.id],
    },
    {
      project_id: projectId,
      template_field_id: fields[4].id,
      extracted_value: 'White matte finish',
      confidence: 0.88,
      is_contradiction: false,
      extraction_note: null,
      status: 'auto_confirmed',
      source_message_ids: [msg1.id],
    },
  ])

  if (candError) {
    console.error('✗ Failed to insert candidates:', candError)
    process.exit(1)
  }
  console.log('✓ Created 3 pending + 2 auto-confirmed decision candidates')

  console.log(`
────────────────────────────────────────
  Email:      ${SEED_EMAIL}
  Password:   ${SEED_PASSWORD}
  Project ID: ${projectId}
────────────────────────────────────────
`)
}

run()
