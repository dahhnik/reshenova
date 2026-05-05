import { createResource, For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { apiFetch } from '../lib/api'

type Project = {
  id: string
  name: string
  pending_review_count: number
  created_at: string
}

export function Projects() {
  const [projects] = createResource<Project[]>(() => apiFetch<Project[]>('/projects'))

  return (
    <div class="mx-auto max-w-2xl px-4 py-8">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">Projects</h1>

      <Show when={projects.loading}>
        <div class="space-y-4">
          {Array.from({ length: 3 }).map(() => (
            <div class="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </Show>

      <Show when={projects.error}>
        <p class="text-red-600">Failed to load projects. Please refresh.</p>
      </Show>

      <Show when={!projects.loading && !projects.error}>
        <Show
          when={(projects() ?? []).length > 0}
          fallback={
            <p class="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
              No projects yet.
            </p>
          }
        >
          <div class="space-y-3">
            <For each={projects()}>
              {(project) => (
                <A
                  href={`/projects/${project.id}/decisions`}
                  class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div>
                    <p class="font-semibold text-gray-900">{project.name}</p>
                    <p class="text-xs text-gray-400 mt-0.5">
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Show when={project.pending_review_count > 0}>
                    <span class="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800">
                      {project.pending_review_count} pending
                    </span>
                  </Show>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}
