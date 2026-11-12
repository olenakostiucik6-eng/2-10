
<script setup>
import { ref, onMounted } from 'vue'
import { getDatabase } from '../services/database'

import '../css/app.css'
import '../css/persistence.css'

const loading = ref(true)
const error = ref('')

const stats = ref({
  tasks: 0,
  projects: 0,
  initialized: false,
  lastSavedAt: null,
})

async function loadDatabaseStats() {
  loading.value = true
  error.value = ''

  try {
    const db = await getDatabase()

    const tx = db.transaction(
      ['tasks', 'projects', 'metadata'],
      'readonly'
    )

    const taskStore = tx.objectStore('tasks')
    const projectStore = tx.objectStore('projects')
    const metadataStore = tx.objectStore('metadata')

    const [
      tasksCount,
      projectsCount,
      initialized,
      lastSavedAt,
    ] = await Promise.all([
      taskStore.count(),
      projectStore.count(),
      metadataStore.get('initialized'),
      metadataStore.get('lastSavedAt'),
    ])

    await tx.done

    stats.value = {
      tasks: tasksCount,
      projects: projectsCount,
      initialized: initialized === true,
      lastSavedAt,
    }
  } catch (err) {
    error.value = err.message || 'Не вдалося прочитати IndexedDB.'
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  if (!value) return 'Немає даних'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Дата недоступна'
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

onMounted(loadDatabaseStats)
</script>

<template>
  <f7-page name="settings" class="tf3-page">
    <f7-navbar title="Налаштування">
      <f7-nav-right>
        <f7-link href="/tasks/">До завдань</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="tf3-container">
      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / SETTINGS</div>
        <h1>Налаштування</h1>

        <p>
          Інформація про локальну базу даних IndexedDB.
        </p>
      </section>

      <section class="tf5-panel">
        <h2>Статистика локальної бази</h2>

        <p v-if="loading">
          Завантаження даних…
        </p>

        <p v-else-if="error" class="tf5-error">
          {{ error }}
        </p>

        <template v-else>
          <div class="tf3-stat-grid">
            <div class="tf3-stat">
              <span class="tf3-stat-label">
                Збережені завдання
              </span>
              <strong>{{ stats.tasks }}</strong>
            </div>

            <div class="tf3-stat">
              <span class="tf3-stat-label">
                Збережені проєкти
              </span>
              <strong>{{ stats.projects }}</strong>
            </div>
          </div>

          <p>
            База ініціалізована:
            <strong>{{ stats.initialized ? 'Так' : 'Ні' }}</strong>
          </p>

          <p>
            Останнє збереження:
            <strong>{{ formatDate(stats.lastSavedAt) }}</strong>
          </p>
        </template>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary"
          @click="loadDatabaseStats"
        >
          Оновити статистику
        </button>
      </section>
    </div>
  </f7-page>
</template>
