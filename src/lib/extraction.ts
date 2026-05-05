import { GoogleGenerativeAI } from '@google/generative-ai'

export type ExtractionCandidate = {
  template_field_id: string
  extracted_value: string
  confidence: number
  is_contradiction: boolean
  extraction_note: string | null
}

export function parseExtractionResponse(
  jsonString: string,
  fields: { id: string; name: string; category: string }[]
): ExtractionCandidate[] {
  // Strip markdown code fences if Gemini wraps the response (```json ... ```)
  const cleaned = jsonString
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return []
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return []

  const results: ExtractionCandidate[] = []

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue

    const entry = item as Record<string, unknown>
    const fieldName = typeof entry.field_name === 'string' ? entry.field_name : null
    if (!fieldName) continue

    const field = fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
    if (!field) continue

    const rawConfidence = typeof entry.confidence === 'number' ? entry.confidence : 0
    const confidence = Math.min(1, Math.max(0, rawConfidence))

    results.push({
      template_field_id: field.id,
      extracted_value: typeof entry.extracted_value === 'string' ? entry.extracted_value : '',
      confidence,
      is_contradiction: entry.is_contradiction === true,
      extraction_note:
        typeof entry.extraction_note === 'string' ? entry.extraction_note : null,
    })
  }

  return results
}

export async function extractDecisions(
  messages: { sender_name: string | null; content: string; sent_at: string }[],
  fields: { id: string; name: string; category: string }[],
  confirmedDecisions: { field_name: string; confirmed_value: string }[]
): Promise<ExtractionCandidate[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const fieldList = fields.map((f) => `- ${f.name} (${f.category})`).join('\n')

  const confirmedSection =
    confirmedDecisions.length > 0
      ? `Already confirmed decisions (mark is_contradiction: true if new info conflicts):\n${confirmedDecisions.map((d) => `- ${d.field_name}: ${d.confirmed_value}`).join('\n')}`
      : ''

  const messageList = messages
    .map((m) => `[${m.sent_at}] ${m.sender_name ?? 'Unknown'}: ${m.content}`)
    .join('\n')

  const prompt = `You are analyzing messages from a renovation project Telegram group.
Extract any decisions related to these fields:
${fieldList}

${confirmedSection}

Messages:
${messageList}

Return a JSON array. Each item: { "field_name": string, "extracted_value": string, "confidence": number (0-1), "is_contradiction": boolean, "extraction_note": string|null }
Only include fields where the message contains a clear decision. Return [] if none found.
Return only valid JSON, no other text.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('[extraction] gemini raw response:', text)

  return parseExtractionResponse(text, fields)
}
