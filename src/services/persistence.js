
import { reactive } from 'vue'

import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'
import { readSnapshot, writeSnapshot } from './database'
import { announceSaved } from './tabSync'

export const persistenceState = reactive({
  status: 'loading',
  error: '',
  canRetry: false,
  lastSavedAt: null,
})

let taskStore = null
let projectStore = null
let enabled = false
let writing = false
let revision = 0
let savedRevision = 0
let lastRequestedSnapshot = ''
let scheduled = false

function makeSnapshot() {
  return JSON.parse(JSON.stringify({
    tasks: taskStore.tasks,
    projects: projectStore.projects,
    nextProjectId: projectStore.nextProjectId,
  }))
}

async function flushChanges() {
  if (!enabled || writing) return

  writing = true

  try {
    while (savedRevision < revision) {
      const targetRevision = revision
      const snapshot = makeSnapshot()

      try {
        const savedAt = await writeSnapshot(snapshot)

        savedRevision = targetRevision
        persistenceState.lastSavedAt = new Date(savedAt)

        // Повідомляємо інші вкладки після успішної транзакції.
        announceSaved(savedAt)
      } catch (error) {
        console.error('TaskFlow: збереження не вдалося:', error)

        persistenceState.status = 'error'
        persistenceState.error =
          'Зміни поки що залишилися лише в пам’яті.'
        persistenceState.canRetry = true

        return
      }
    }

    persistenceState.status = 'saved'
    persistenceState.error = ''
    persistenceState.canRetry = false
  } finally {
    writing = false
  }
}

function requestSave(force = false) {
  if (!enabled) return

  const fingerprint = JSON.stringify(makeSnapshot())

  if (!force && fingerprint === lastRequestedSnapshot) return

  lastRequestedSnapshot = fingerprint
  revision += 1

  persistenceState.status = 'saving'
  persistenceState.error = ''
  persistenceState.canRetry = false

  void flushChanges()
}

function onStoreChanged() {
  if (scheduled) return

  scheduled = true

  queueMicrotask(() => {
    scheduled = false
    requestSave()
  })
}

export function retrySave() {
  if (!enabled || persistenceState.status !== 'error') return

  requestSave(true)
}

export async function initializePersistence(pinia) {
  taskStore = useTasksStore(pinia)
  projectStore = useProjectsStore(pinia)

  try {
    const snapshot = await readSnapshot()

    if (snapshot.initialized) {
      if (
        !Array.isArray(snapshot.tasks) ||
        !Array.isArray(snapshot.projects)
      ) {
        throw new Error('Некоректний формат локальних даних.')
      }

      const calculatedNextId = Math.max(
        0,
        ...snapshot.projects.map((project) => {
          const match = /^project-(\d+)$/.exec(String(project.id))
          return match ? Number(match[1]) : 0
        })
      ) + 1

      projectStore.$patch({
        projects: snapshot.projects,
        nextProjectId:
          Number.isSafeInteger(snapshot.nextProjectId) &&
          snapshot.nextProjectId >= calculatedNextId
            ? snapshot.nextProjectId
            : calculatedNextId,
      })

      taskStore.$patch({
        tasks: snapshot.tasks,
      })

      persistenceState.lastSavedAt = snapshot.lastSavedAt
        ? new Date(snapshot.lastSavedAt)
        : null
    } else {
      // Перший запуск: записуємо демонстраційні дані.
      const savedAt = await writeSnapshot(makeSnapshot())
      persistenceState.lastSavedAt = new Date(savedAt)
    }

    persistenceState.status = 'saved'
    persistenceState.error = ''

    lastRequestedSnapshot = JSON.stringify(makeSnapshot())
    enabled = true

    taskStore.$subscribe(
      onStoreChanged,
      { detached: true, flush: 'sync' }
    )

    projectStore.$subscribe(
      onStoreChanged,
      { detached: true, flush: 'sync' }
    )
  } catch (error) {
    console.error('TaskFlow: IndexedDB недоступна:', error)

    persistenceState.status = 'error'
    persistenceState.error =
      'Не вдалося відкрити або відновити локальні дані. ' +
      'Працює лише тимчасовий стан; наявну базу не перезаписано.'

    persistenceState.canRetry = false
  }
}
