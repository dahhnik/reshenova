type Props = {
  confidence: number
  isContradiction?: boolean
}

export function ConfidenceBadge(props: Props) {
  const isHighConfidence = () => !props.isContradiction && props.confidence >= 0.85
  const label = () => (isHighConfidence() ? 'Auto-confirmed' : 'Needs review')
  const colorClass = () =>
    isHighConfidence()
      ? 'bg-green-100 text-green-800'
      : 'bg-amber-100 text-amber-800'
  const score = () => `${Math.round(props.confidence * 100)}%`

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass()}`}
      title={score()}
    >
      {label()}
      <span class="opacity-60">{score()}</span>
    </span>
  )
}
