import { createResource, createSignal, For, Show } from 'solid-js'
import { apiFetch } from '../lib/api'
import { DecisionCard, type Candidate } from '../components/DecisionCard'

type QueueResponse = {
  pending_review: Candidate[]
  auto_confirmed: (Candidate & { confirmed_at: string })[]
}

type Props = {
  projectId: string
}

export function DecisionQueue(props: Props) {
  const [resolvedIds, setResolvedIds] = createSignal<Set<string>>(new Set())

  const [queue] = createResource(
    () => props.projectId,
    (id) => apiFetch<QueueResponse>(`/projects/${id}/decisions/queue`)
  )

  function handleResolved(id: string) {
    setResolvedIds((prev) => new Set([...prev, id]))
  }

  const pendingItems = () =>
    (queue()?.pending_review ?? []).filter((c) => !resolvedIds().has(c.id))

  const autoItems = () =>
    (queue()?.auto_confirmed ?? []).filter((c) => !resolvedIds().has(c.id))

  return (
    <div class="mx-auto max-w-2xl px-4 py-8">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">Decision Queue</h1>

      <Show when={queue.loading}>
        <div class="space-y-4">
          {Array.from({ length: 3 }).map(() => (
            <div class="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </Show>

      <Show when={queue.error}>
        <p class="text-red-600">Failed to load queue. Please refresh.</p>
      </Show>

      <Show when={!queue.loading && !queue.error}>
        <section class="mb-8">
          <h2 class="mb-3 text-lg font-semibold text-gray-700">
            Needs Your Review
            <Show when={pendingItems().length > 0}>
              <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                {pendingItems().length}
              </span>
            </Show>
          </h2>

          <Show
            when={pendingItems().length > 0}
            fallback={
              <p class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                No pending decisions
              </p>
            }
          >
            <div class="space-y-4">
              <For each={pendingItems()}>
                {(candidate) => (
                  <DecisionCard
                    projectId={props.projectId}
                    candidate={candidate}
                    onResolved={handleResolved}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

        <section>
          <h2 class="mb-3 text-lg font-semibold text-gray-700">
            Auto-Confirmed Today
            <Show when={autoItems().length > 0}>
              <span class="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-sm font-medium text-green-800">
                {autoItems().length}
              </span>
            </Show>
          </h2>

          <Show
            when={autoItems().length > 0}
            fallback={
              <p class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                No auto-confirmed decisions in the last 48 hours
              </p>
            }
          >
            <div class="space-y-4">
              <For each={autoItems()}>
                {(candidate) => (
                  <DecisionCard
                    projectId={props.projectId}
                    candidate={candidate}
                    onResolved={handleResolved}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>
      </Show>
    </div>
  )
}
