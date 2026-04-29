import { describe, it, expect } from 'vitest'
import { routeCandidate } from '../../../src/lib/candidates'

describe('routeCandidate', () => {
  it('auto-confirms when confidence >= 0.85 with no contradiction', () => {
    expect(routeCandidate(0.85, false)).toBe('auto_confirmed')
    expect(routeCandidate(0.90, false)).toBe('auto_confirmed')
    expect(routeCandidate(1.0, false)).toBe('auto_confirmed')
  })

  it('routes to pending_review when confidence < 0.85', () => {
    expect(routeCandidate(0.84, false)).toBe('pending_review')
    expect(routeCandidate(0.50, false)).toBe('pending_review')
    expect(routeCandidate(0.0, false)).toBe('pending_review')
  })

  it('routes contradictions to pending_review regardless of confidence score', () => {
    expect(routeCandidate(0.99, true)).toBe('pending_review')
    expect(routeCandidate(0.85, true)).toBe('pending_review')
    expect(routeCandidate(0.90, true)).toBe('pending_review')
  })
})
