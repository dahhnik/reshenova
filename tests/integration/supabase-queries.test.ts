import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { app } from '../../src/app'
import { createClient } from '../../src/lib/supabase'

vi.mock('../../src/lib/sheets', () => ({
  writeCell: vi.fn().mockResolvedValue(undefined),
}))

// Clients created inside beforeAll so process.env is populated by vitest test.env
let admin: ReturnType<typeof createClient>
let anon: ReturnType<typeof createSupabaseClient>

const RUN_ID = Date.now()
const TEST_EMAIL = `phase3-${RUN_ID}@reshenova.test`
const TEST_PASSWORD = 'test-password-123!'

let userId: string
let jwt: string
let projectId: string
let pendingCandidateId: string
let rejectCandidateId: string
let otherProjectId: string

beforeAll(async () => {
  admin = createClient()
  anon = createSupabaseClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

  // Create test user
  const { data: { user }, error: createError } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw new Error(`createUser failed: ${createError.message}`)
  userId = user!.id

  // Sign in to get JWT
  const { data: { session } } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  jwt = session!.access_token

  // Fetch seed template
  const { data: template } = await admin
    .from('templates')
    .select('id')
    .eq('name', 'Residential Renovation')
    .single()

  const templateId = template!.id

  const { data: fields } = await admin
    .from('template_fields')
    .select('id')
    .eq('template_id', templateId)
    .limit(1)

  const fieldId = fields![0].id

  // Create test project
  const { data: project } = await admin
    .from('projects')
    .insert({
      owner_id: userId,
      name: `Test Project ${RUN_ID}`,
      telegram_chat_id: -(RUN_ID),
      google_sheet_id: 'test-sheet-id',
      template_id: templateId,
      webhook_secret: 'test-secret',
    })
    .select('id')
    .single()
  projectId = project!.id

  // Create a second project owned by a different user (to test isolation)
  const { data: otherProject } = await admin
    .from('projects')
    .insert({
      owner_id: userId, // same user but different project — candidates should still be filtered by project_id
      name: `Other Project ${RUN_ID}`,
      telegram_chat_id: -(RUN_ID + 1),
      google_sheet_id: 'other-sheet-id',
      template_id: templateId,
      webhook_secret: 'other-secret',
    })
    .select('id')
    .single()
  otherProjectId = otherProject!.id

  // Create test messages
  const { data: messages } = await admin
    .from('messages')
    .insert([
      {
        project_id: projectId,
        telegram_message_id: RUN_ID,
        content: "Let's go with warm gray grout",
        sender_name: 'Anna',
        sent_at: new Date().toISOString(),
      },
    ])
    .select('id')
  const messageId = messages![0].id

  // Create test candidates
  const { data: candidates } = await admin
    .from('decision_candidates')
    .insert([
      {
        project_id: projectId,
        template_field_id: fieldId,
        extracted_value: 'Warm Gray',
        confidence: 0.72,
        status: 'pending_review',
        source_message_ids: [messageId],
        is_contradiction: false,
      },
      {
        project_id: projectId,
        template_field_id: fieldId,
        extracted_value: 'Matte Black',
        confidence: 0.93,
        status: 'auto_confirmed',
        source_message_ids: [messageId],
        is_contradiction: false,
      },
      {
        project_id: projectId,
        template_field_id: fieldId,
        extracted_value: 'Brushed Nickel',
        confidence: 0.62,
        status: 'pending_review',
        source_message_ids: [messageId],
        is_contradiction: false,
      },
    ])
    .select('id')

  pendingCandidateId = candidates![0].id
  rejectCandidateId = candidates![2].id

  // Create candidate in the other project (should NOT appear in main project queue)
  await admin.from('decision_candidates').insert({
    project_id: otherProjectId,
    template_field_id: fieldId,
    extracted_value: 'Should not appear',
    confidence: 0.5,
    status: 'pending_review',
    source_message_ids: [],
    is_contradiction: false,
  })
}, 30_000)

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
}, 15_000)

// ── T021: GET queue ──────────────────────────────────────────────────────────

describe('GET /api/projects/:id/decisions/queue', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request(`/api/projects/${projectId}/decisions/queue`)
    expect(res.status).toBe(401)
  })

  it('returns 404 for a project not owned by the user', async () => {
    const res = await app.request(`/api/projects/00000000-0000-0000-0000-000000000000/decisions/queue`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    expect(res.status).toBe(404)
  })

  it('returns pending_review and auto_confirmed candidates', async () => {
    const res = await app.request(`/api/projects/${projectId}/decisions/queue`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { pending_review: unknown[]; auto_confirmed: unknown[] }
    expect(body.pending_review.length).toBeGreaterThanOrEqual(1)
    expect(body.auto_confirmed.length).toBeGreaterThanOrEqual(1)
  })

  it('does not return candidates from other projects', async () => {
    const res = await app.request(`/api/projects/${projectId}/decisions/queue`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    const body = await res.json() as { pending_review: { id: string }[]; auto_confirmed: { id: string }[] }
    const allIds = [
      ...body.pending_review.map(c => c.id),
      ...body.auto_confirmed.map(c => c.id),
    ]
    // The "other project" candidate should not be in this project's queue
    const { data: otherCandidates } = await admin
      .from('decision_candidates')
      .select('id')
      .eq('project_id', otherProjectId)
    const otherIds = (otherCandidates ?? []).map(c => c.id)
    for (const otherId of otherIds) {
      expect(allIds).not.toContain(otherId)
    }
  })
})

// ── T022: PATCH confirm / reject ─────────────────────────────────────────────

describe('PATCH /api/projects/:id/candidates/:cid/confirm', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request(
      `/api/projects/${projectId}/candidates/${pendingCandidateId}/confirm`,
      { method: 'PATCH' }
    )
    expect(res.status).toBe(401)
  })

  it('creates a decision_log entry with the confirmed value', async () => {
    const confirmedValue = 'Warm Gray 112'
    const res = await app.request(
      `/api/projects/${projectId}/candidates/${pendingCandidateId}/confirm`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_value: confirmedValue, correction_note: 'Added product code' }),
      }
    )
    expect(res.status).toBe(200)

    const { data: logEntry } = await admin
      .from('decision_log')
      .select('confirmed_value, confirmed_by')
      .eq('candidate_id', pendingCandidateId)
      .single()

    expect(logEntry?.confirmed_value).toBe(confirmedValue)
    expect(logEntry?.confirmed_by).toBe(userId)
  })

  it('updates candidate status to confirmed', async () => {
    const { data } = await admin
      .from('decision_candidates')
      .select('status')
      .eq('id', pendingCandidateId)
      .single()
    expect(data?.status).toBe('confirmed')
  })
})

describe('PATCH /api/projects/:id/candidates/:cid/reject', () => {
  it('sets candidate status to rejected', async () => {
    const res = await app.request(
      `/api/projects/${projectId}/candidates/${rejectCandidateId}/reject`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${jwt}` },
      }
    )
    expect(res.status).toBe(200)

    const { data } = await admin
      .from('decision_candidates')
      .select('status')
      .eq('id', rejectCandidateId)
      .single()
    expect(data?.status).toBe('rejected')
  })

  it('does not create a decision_log entry on reject', async () => {
    const { data } = await admin
      .from('decision_log')
      .select('id')
      .eq('candidate_id', rejectCandidateId)
    expect(data?.length ?? 0).toBe(0)
  })
})
