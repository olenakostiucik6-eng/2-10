
import { openDB } from 'idb'

const DB_NAME = 'taskflow-db'
const DB_VERSION = 1

let databasePromise = null

// Відкриваємо базу даних.
export function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('Цей браузер не підтримує IndexedDB.')
    )
  }

  if (!databasePromise) {
    databasePromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata')
        }
      },
    }).catch((error) => {
      databasePromise = null
      throw error
    })
  }

  return databasePromise
}

// Читаємо повний знімок бази.
export async function readSnapshot() {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readonly'
  )

  const [
    tasks,
    projects,
    initialized,
    nextProjectId,
    lastSavedAt,
  ] = await Promise.all([
    tx.objectStore('tasks').getAll(),
    tx.objectStore('projects').getAll(),
    tx.objectStore('metadata').get('initialized'),
    tx.objectStore('metadata').get('nextProjectId'),
    tx.objectStore('metadata').get('lastSavedAt'),
  ])

  await tx.done

  return {
    tasks,
    projects,
    initialized: initialized === true,
    nextProjectId,
    lastSavedAt,
  }
}

// Атомарно записуємо повний знімок стану.
export async function writeSnapshot(snapshot) {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readwrite'
  )

  const taskStore = tx.objectStore('tasks')
  const projectStore = tx.objectStore('projects')
  const metadataStore = tx.objectStore('metadata')

  const savedAt = new Date().toISOString()

  await Promise.all([
    taskStore.clear(),
    projectStore.clear(),
  ])

  await Promise.all([
    ...snapshot.tasks.map((task) => taskStore.put(task)),
    ...snapshot.projects.map((project) => projectStore.put(project)),
    metadataStore.put(true, 'initialized'),
    metadataStore.put(snapshot.nextProjectId, 'nextProjectId'),
    metadataStore.put(savedAt, 'lastSavedAt'),
    tx.done,
  ])

  return savedAt
}

// Додаткова функція точкового видалення одного завдання.
// Не замінює основний механізм snapshot у Pinia.
export async function deleteTaskRecord(id) {
  const db = await getDatabase()

  const tx = db.transaction('tasks', 'readwrite')

  await tx.objectStore('tasks').delete(Number(id))
  await tx.done

  return true
}
