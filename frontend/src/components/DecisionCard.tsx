import { createSignal } from 'solid-js'
import { ConfidenceBadge } from './ConfidenceBadge'
import { apiFetch } from '../lib/api'

type SourceMessage = {
  id: string
  sender_name: string
  content: string
  sent_at: string
}

type TemplateField = {
  id: string
  name: string
  category: string
}

export type Candidate = {
  id: string
  template_field: TemplateField
  extracted_value: string
  confidence: number
  is_contradiction: boolean
  extraction_note: string | null
  source_messages: SourceMessage[]
  created_at: string
}

type Props = {
  projectId: string
  candidate: Candidate
  onResolved: (id: string) => void
}

export function DecisionCard(props: Props) {
  const [editedValue, setEditedValue] = createSignal(props.candidate.extracted_value)
  const [correctionNote, setCorrectionNote] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const body: Record<string, string> = { confirmed_value: editedValue() }
      if (correctionNote()) body.correction_note = correctionNote()
      await apiFetch(`/projects/${props.projectId}/candidates/${props.candidate.id}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      props.onResolved(props.candidate.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    setLoading(true)
    try {
      await apiFetch(`/projects/${props.projectId}/candidates/${props.candidate.id}/reject`, {
        method: 'PATCH',
      })
      props.onResolved(props.candidate.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <span class="text-xs font-medium uppercase tracking-wide text-gray-400">
            {props.candidate.template_field.category}
          </span>
          <h3 class="font-semibold text-gray-900">{props.candidate.template_field.name}</h3>
        </div>
        <ConfidenceBadge
          confidence={props.candidate.confidence}
          isContradiction={props.candidate.is_contradiction}
        />
      </div>

      <div class="mb-3">
        <label class="mb-1 block text-xs font-medium text-gray-600">Extracted value</label>
        <input
          type="text"
          value={editedValue()}
          onInput={(e) => setEditedValue(e.currentTarget.value)}
          class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {props.candidate.extraction_note && (
        <p class="mb-3 text-xs text-gray-500 italic">{props.candidate.extraction_note}</p>
      )}

      {props.candidate.source_messages.length > 0 && (
        <div class="mb-3 space-y-1">
          <p class="text-xs font-medium text-gray-600">Source messages</p>
          {props.candidate.source_messages.map((msg) => (
            <div class="rounded bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
              <span class="font-medium">{msg.sender_name}: </span>
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {editedValue() !== props.candidate.extracted_value && (
        <div class="mb-3">
          <label class="mb-1 block text-xs font-medium text-gray-600">Correction note</label>
          <input
            type="text"
            placeholder="Why did you change this?"
            value={correctionNote()}
            onInput={(e) => setCorrectionNote(e.currentTarget.value)}
            class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div class="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading()}
          class="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={handleReject}
          disabled={loading()}
          class="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
