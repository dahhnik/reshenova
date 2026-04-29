import type { CandidateStatus } from './supabase'

export function routeCandidate(confidence: number, isContradiction: boolean): CandidateStatus {
  if (isContradiction || confidence < 0.85) return 'pending_review'
  return 'auto_confirmed'
}
