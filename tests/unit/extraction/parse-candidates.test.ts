import { describe, it, expect } from 'vitest'
import { parseExtractionResponse, type ExtractionCandidate } from '../../../src/lib/extraction'

const fields = [
  { id: 'field-1', name: 'Tile Color', category: 'Finishes' },
  { id: 'field-2', name: 'Grout Type', category: 'Finishes' },
  { id: 'field-3', name: 'Budget', category: 'Costs' },
]

describe('parseExtractionResponse', () => {
  it('parses valid JSON array into ExtractionCandidate array', () => {
    const json = JSON.stringify([
      {
        field_name: 'Tile Color',
        extracted_value: 'Warm Gray',
        confidence: 0.9,
        is_contradiction: false,
        extraction_note: null,
      },
    ])
    const result = parseExtractionResponse(json, fields)
    expect(result).toHaveLength(1)
    const candidate = result[0] as ExtractionCandidate
    expect(candidate.template_field_id).toBe('field-1')
    expect(candidate.extracted_value).toBe('Warm Gray')
    expect(candidate.confidence).toBe(0.9)
    expect(candidate.is_contradiction).toBe(false)
    expect(candidate.extraction_note).toBeNull()
  })

  it('returns [] for malformed JSON', () => {
    expect(parseExtractionResponse('not json', fields)).toEqual([])
    expect(parseExtractionResponse('{invalid}', fields)).toEqual([])
  })

  it('returns [] for empty array', () => {
    expect(parseExtractionResponse('[]', fields)).toEqual([])
  })

  it('skips entries where field_name does not match any template field', () => {
    const json = JSON.stringify([
      {
        field_name: 'Nonexistent Field',
        extracted_value: 'some value',
        confidence: 0.8,
        is_contradiction: false,
        extraction_note: null,
      },
      {
        field_name: 'Grout Type',
        extracted_value: 'Epoxy',
        confidence: 0.75,
        is_contradiction: false,
        extraction_note: null,
      },
    ])
    const result = parseExtractionResponse(json, fields)
    expect(result).toHaveLength(1)
    expect(result[0].template_field_id).toBe('field-2')
  })

  it('matches field names case-insensitively', () => {
    const json = JSON.stringify([
      {
        field_name: 'tile color',
        extracted_value: 'White',
        confidence: 0.88,
        is_contradiction: false,
        extraction_note: null,
      },
    ])
    const result = parseExtractionResponse(json, fields)
    expect(result).toHaveLength(1)
    expect(result[0].template_field_id).toBe('field-1')
  })

  it('preserves is_contradiction: true and extraction_note', () => {
    const json = JSON.stringify([
      {
        field_name: 'Budget',
        extracted_value: '€500',
        confidence: 0.6,
        is_contradiction: true,
        extraction_note: 'Two different amounts mentioned',
      },
    ])
    const result = parseExtractionResponse(json, fields)
    expect(result).toHaveLength(1)
    expect(result[0].is_contradiction).toBe(true)
    expect(result[0].extraction_note).toBe('Two different amounts mentioned')
  })

  it('clamps confidence to 0–1 range', () => {
    const json = JSON.stringify([
      {
        field_name: 'Tile Color',
        extracted_value: 'Blue',
        confidence: 1.5,
        is_contradiction: false,
        extraction_note: null,
      },
      {
        field_name: 'Grout Type',
        extracted_value: 'Sand',
        confidence: -0.2,
        is_contradiction: false,
        extraction_note: null,
      },
    ])
    const result = parseExtractionResponse(json, fields)
    expect(result[0].confidence).toBe(1)
    expect(result[1].confidence).toBe(0)
  })
})
