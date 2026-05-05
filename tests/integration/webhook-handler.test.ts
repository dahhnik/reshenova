import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { app } from '../../src/app'
import { createClient } from '../../src/lib/supabase'
import type { ExtractionCandidate } from '../../src/lib/extraction'

vi.mock('../../src/lib/extraction', () => ({
  extractDecisions: vi.fn().mockResolvedValue([
    {
      template_field_id: '',
      extracted_value: 'Warm Gray',
      confidence: 0.9,
      is_contradiction: false,
      extraction_note: null,
    } satisfies ExtractionCandidate,
  ]),
  parseExtractionResponse: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/lib/sheets', () => ({
  writeCell: vi.fn().mockResolvedValue(undefined),
}))

let admin: ReturnType<typeof createClient>

const RUN_ID = Date.now()
const TEST_EMAIL = `webhook-${RUN_ID}@reshenova.test`
const TEST_PASSWORD = 'test-password-123!'

let userId: string
let projectId: string
let templateFieldId: string
let chatId: number
const WEBHOOK_SECRET = `secret-${RUN_ID}`

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs = 2000,
  intervalMs = 100
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

beforeAll(async () => {
  admin = createClient()

  const {
    data: { user },
    error: createError,
  } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw new Error(`createUser failed: ${createError.message}`)
  userId = user!.id

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
  templateFieldId = fields![0].id

  chatId = -(RUN_ID % 2147483647)

  const { data: project } = await admin
    .from('projects')
    .insert({
      owner_id: userId,
      name: `Webhook Test Project ${RUN_ID}`,
      telegram_chat_id: chatId,
      google_sheet_id: 'test-sheet-id',
      template_id: templateId,
      webhook_secret: WEBHOOK_SECRET,
    })
    .select('id')
    .single()
  projectId = project!.id
}, 30_000)

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
}, 15_000)

function makeTelegramUpdate(overrides: Record<string, unknown> = {}) {
  return {
    update_id: RUN_ID,
    message: {
      message_id: RUN_ID,
      from: { id: 12345, first_name: 'Test', last_name: 'User' },
      chat: { id: chatId, title: 'Test Chat', type: 'group' },
      date: Math.floor(Date.now() / 1000),
      text: 'We decided on warm gray tiles',
      ...overrides,
    },
  }
}

describe('POST /api/telegram/webhook', () => {
  it('returns 401 if no secret header', async () => {
    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTelegramUpdate()),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 if secret header does not match project.webhook_secret', async () => {
    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
      body: JSON.stringify(makeTelegramUpdate()),
    })
    expect(res.status).toBe(401)
  })

  it('returns 200 for valid secret immediately', async () => {
    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify(makeTelegramUpdate({ message_id: RUN_ID + 100 })),
    })
    expect(res.status).toBe(200)
  })

  it('creates a message row in DB after 200', async () => {
    const msgId = RUN_ID + 200
    await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify(makeTelegramUpdate({ message_id: msgId })),
    })

    const found = await waitFor(async () => {
      const { data } = await admin
        .from('messages')
        .select('id')
        .eq('project_id', projectId)
        .eq('telegram_message_id', msgId)
      return (data?.length ?? 0) > 0
    })
    expect(found).toBe(true)
  })

  it('creates a decision_candidate row after 200', async () => {
    const { extractDecisions } = await import('../../src/lib/extraction')
    const mockExtract = vi.mocked(extractDecisions)

    const fieldId = templateFieldId
    mockExtract.mockResolvedValueOnce([
      {
        template_field_id: fieldId,
        extracted_value: 'Gray tile',
        confidence: 0.9,
        is_contradiction: false,
        extraction_note: null,
      },
    ])

    const msgId = RUN_ID + 300
    await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify(makeTelegramUpdate({ message_id: msgId })),
    })

    const found = await waitFor(async () => {
      const { data } = await admin
        .from('decision_candidates')
        .select('id')
        .eq('project_id', projectId)
        .eq('template_field_id', fieldId)
        .eq('extracted_value', 'Gray tile')
      return (data?.length ?? 0) > 0
    })
    expect(found).toBe(true)
  })

  it('returns 200 but does not create message row for non-text messages', async () => {
    const msgId = RUN_ID + 400
    const update = {
      update_id: msgId,
      message: {
        message_id: msgId,
        from: { id: 12345, first_name: 'Test' },
        chat: { id: chatId, title: 'Test Chat', type: 'group' },
        date: Math.floor(Date.now() / 1000),
        // no text field — photo message
        photo: [{ file_id: 'abc', file_unique_id: 'xyz', width: 100, height: 100, file_size: 1024 }],
      },
    }

    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify(update),
    })
    expect(res.status).toBe(200)

    // Wait briefly then confirm no message was inserted
    await new Promise((r) => setTimeout(r, 300))
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('project_id', projectId)
      .eq('telegram_message_id', msgId)
    expect(data?.length ?? 0).toBe(0)
  })
})
