
<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'

import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'
import TaskForm from '../components/TaskForm.vue'
import TaskListControls from '../components/TaskListControls.vue'

import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'

import {
  persistenceState,
  retrySave
} from '../services/persistence'

import {
  remoteChangeState,
  clearRemoteChangeNotice
} from '../services/tabSync'

import '../css/task-components.css'
import '../css/task-form.css'
import '../css/task-list.css'
import '../css/persistence.css'

const taskStore = useTasksStore()
const projectStore = useProjectsStore()

const {
  tasks,
  visibleTasks,
  searchText,
  selectedStatus,
  selectedPriority,
  selectedProject,
  sortOrder,
  onlyActive,
  onlyWithoutDueDate,
} = storeToRefs(taskStore)

const {
  projects,
  projectStats
} = storeToRefs(projectStore)

const showForm = ref(false)
const editingId = ref(null)
const newProjectTitle = ref('')
const newProjectError = ref('')
const importInput = ref(null)
const exportMessage = ref('')
const exportUrl = ref('')
const exportFileName = ref('')

const editingTask = computed(
  () => tasks.value.find(
    (task) => task.id === editingId.value
  ) ?? null
)

const saveMessage = computed(() => {
  if (persistenceState.status === 'loading') {
    return 'Завантаження локальних даних…'
  }

  if (persistenceState.status === 'saving') {
    return 'Збереження змін у IndexedDB…'
  }

  if (persistenceState.status === 'saved') {
    return 'Усі зміни збережено в цьому браузері.'
  }

  return persistenceState.error || 'Помилка локального збереження.'
})

const lastSavedText = computed(() => {
  if (!persistenceState.lastSavedAt) {
    return 'Ще немає підтвердженого збереження.'
  }

  const date = new Date(persistenceState.lastSavedAt)

  if (Number.isNaN(date.getTime())) {
    return 'Дата збереження недоступна.'
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
})

// Створення завдання.
function startCreate() {
  editingId.value = null
  showForm.value = true
}

// Редагування завдання.
function startEdit(id) {
  editingId.value = id
  showForm.value = true
}

function cancelForm() {
  editingId.value = null
  showForm.value = false
}

function saveTask(values) {
  const saved = values.id === null
    ? taskStore.addTask(values)
    : taskStore.updateTask(values)

  if (saved) cancelForm()
}

// Видалення завдання.
function handleDelete(id) {
  const task = tasks.value.find(
    (item) => item.id === Number(id)
  )

  if (!task) return

  if (!window.confirm(`Видалити завдання «${task.title}»?`)) {
    return
  }

  if (taskStore.deleteTask(id) && editingId.value === id) {
    cancelForm()
  }
}

// Створення проєкту.
function createProject() {
  const project = projectStore.addProject(newProjectTitle.value)

  if (!project) {
    newProjectError.value =
      'Назва повинна містити 3–40 символів і бути унікальною.'
    return
  }

  newProjectTitle.value = ''
  newProjectError.value = ''
  selectedProject.value = project.id
}

// Групова зміна статусу проєкту.
function moveProjectToProgress(project) {
  if (project.totalTasks === 0) return

  const confirmed = window.confirm(
    `Перевести всі ${project.totalTasks} завдань проєкту «${project.title}» у статус «У роботі»?`
  )

  if (!confirmed) return

  taskStore.setProjectTasksInProgress(project.id)
}

// ЕКСПОРТ JSON. Після створення показуємо звичайне посилання
// для ручного завантаження, якщо браузер блокує автоматичний клік.
function exportJson() {
  exportMessage.value = ''

  try {
    const backup = {
      format: 'taskflow-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      nextProjectId: projectStore.nextProjectId,
      tasks: JSON.parse(JSON.stringify(tasks.value)),
      projects: JSON.parse(JSON.stringify(projects.value)),
    }

    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob(
      [json],
      { type: 'application/json;charset=utf-8' }
    )

    // При повторному експорті звільняємо попередню адресу файлу.
    if (exportUrl.value) {
      URL.revokeObjectURL(exportUrl.value)
    }

    exportUrl.value = URL.createObjectURL(blob)
    exportFileName.value = `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`

    exportMessage.value =
      `Резервну копію підготовлено: ${backup.tasks.length} завдань і ${backup.projects.length} проєктів. Натисніть кнопку «Завантажити JSON-файл» нижче.`
  } catch (error) {
    console.error('TaskFlow: помилка експорту JSON:', error)
    exportMessage.value = `Не вдалося створити резервну копію: ${error.message}`
  }
}

// Завантаження через звичайний клік користувача.
// class="external" і data-ignore не дають Framework7 перехопити Blob-посилання як маршрут.
function downloadJson() {
  if (!exportUrl.value) {
    exportMessage.value = 'Спочатку натисніть «Експорт JSON».'
    return
  }

  const link = document.createElement('a')
  link.href = exportUrl.value
  link.download = exportFileName.value
  link.className = 'external'
  link.setAttribute('data-ignore', 'true')
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  exportMessage.value = `Завантаження ${exportFileName.value} розпочато. Перевірте Ctrl + J.`
}

// Звільняємо Blob URL після виходу зі сторінки.
onBeforeUnmount(() => {
  if (exportUrl.value) {
    URL.revokeObjectURL(exportUrl.value)
  }
})

// Відкриття вибору JSON-файлу.
function openImportDialog() {
  importInput.value?.click()
}

// ПЕРЕВІРКА СТРУКТУРИ JSON.
function validateBackup(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    data.format !== 'taskflow-backup' ||
    data.version !== 1 ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.projects) ||
    typeof data.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(data.exportedAt))
  ) {
    throw new Error('Неправильна структура резервної копії.')
  }

  const projectIds = new Set()
  const projectTitles = new Set()

  for (const project of data.projects) {
    if (
      !project ||
      typeof project.id !== 'string' ||
      !project.id.trim() ||
      typeof project.title !== 'string' ||
      project.title.trim().length < 3 ||
      project.title.trim().length > 40
    ) {
      throw new Error('Некоректні дані проєкту.')
    }

    const titleKey = project.title.trim().toLocaleLowerCase('uk-UA')

    if (projectIds.has(project.id)) {
      throw new Error('Знайдено повторюваний ID проєкту.')
    }

    if (projectTitles.has(titleKey)) {
      throw new Error('Знайдено повторювану назву проєкту.')
    }

    projectIds.add(project.id)
    projectTitles.add(titleKey)
  }

  if (!projectIds.has('general')) {
    throw new Error('Резервна копія повинна містити проєкт general.')
  }

  const taskIds = new Set()

  const allowedStatuses = ['todo', 'progress', 'done']
  const allowedPriorities = ['low', 'medium', 'high']
  const allowedCategories = ['learning', 'work', 'personal']

  for (const task of data.tasks) {
    if (
      !task ||
      !Number.isSafeInteger(task.id) ||
      task.id < 1 ||
      typeof task.title !== 'string' ||
      task.title.trim().length < 3 ||
      task.title.trim().length > 80 ||
      typeof task.description !== 'string' ||
      task.description.length > 500 ||
      !allowedStatuses.includes(task.status) ||
      !allowedPriorities.includes(task.priority) ||
      !allowedCategories.includes(task.category) ||
      typeof task.projectId !== 'string' ||
      !projectIds.has(task.projectId) ||
      typeof task.dueDate !== 'string' ||
      (
        task.dueDate !== '' &&
        !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
      )
    ) {
      throw new Error(
        `Некоректні дані завдання з ID ${task?.id ?? 'невідомий'}.`
      )
    }

    if (taskIds.has(task.id)) {
      throw new Error('Знайдено повторюваний ID завдання.')
    }

    taskIds.add(task.id)
  }

  const calculatedNextId = Math.max(
    0,
    ...data.projects.map((project) => {
      const match = /^project-(\d+)$/.exec(project.id)
      return match ? Number(match[1]) : 0
    })
  ) + 1

  const nextProjectId =
    Number.isSafeInteger(data.nextProjectId) &&
    data.nextProjectId >= calculatedNextId
      ? data.nextProjectId
      : calculatedNextId

  return {
    tasks: data.tasks,
    projects: data.projects,
    nextProjectId,
  }
}

// ІМПОРТ JSON.
async function importJson(event) {
  const file = event.target.files?.[0]

  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    const backup = validateBackup(data)

    const confirmed = window.confirm(
      `Імпортувати ${backup.tasks.length} завдань і ${backup.projects.length} проєктів? Поточні дані буде замінено.`
    )

    if (!confirmed) return

    projectStore.$patch({
      projects: backup.projects,
      nextProjectId: backup.nextProjectId,
    })

    taskStore.$patch({
      tasks: backup.tasks,
    })

    taskStore.resetFilters()

    window.alert(
      'Імпорт завершено. Дочекайтеся підтвердження локального збереження.'
    )
  } catch (error) {
    window.alert(`Помилка імпорту: ${error.message}`)
  } finally {
    event.target.value = ''
  }
}

// Перезавантаження для отримання змін з іншої вкладки.
function reloadRemoteChanges() {
  clearRemoteChangeNotice()
  window.location.reload()
}
</script>

<template>
  <f7-page name="tasks" class="tf3-page">
    <f7-navbar title="Мої завдання" />

    <div class="tf3-container">

      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / TASK MANAGER</div>

        <h1>Керування завданнями і проєктами</h1>

        <p>
          Pinia керує станом, IndexedDB зберігає завдання
          та проєкти локально.
        </p>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary tf5-new"
          @click="startCreate"
        >
          + Додати завдання
        </button>
      </section>

      <!-- Індикатор збереження -->
      <section
        class="tf7-persistence"
        :class="`tf7-persistence--${persistenceState.status}`"
        role="status"
        aria-live="polite"
      >
        <strong>Локальне збереження</strong>
        <span>{{ saveMessage }}</span>

        <button
          v-if="persistenceState.canRetry"
          type="button"
          class="tf5-btn"
          @click="retrySave"
        >
          Повторити збереження
        </button>

        <span class="tf7-save-time">
          Останнє успішне збереження: {{ lastSavedText }}
        </span>
      </section>

      <!-- Повідомлення про зміни в іншій вкладці -->
      <section
        v-if="remoteChangeState.hasChanges"
        class="tf7-persistence tf7-persistence--saving"
        role="alert"
      >
        <strong>Зміни в іншій вкладці</strong>

        <span>
          Інша вкладка TaskFlow зберегла нові дані.
          Перезавантажте сторінку, щоб завантажити актуальну версію.
        </span>

        <button
          type="button"
          class="tf5-btn"
          @click="reloadRemoteChanges"
        >
          Завантажити актуальні дані
        </button>
      </section>

      <!-- Проєкти -->
      <section class="tf5-panel tf6-project-panel">
        <h2>Мої проєкти</h2>

        <div class="tf6-project-list">
          <div
            v-for="project in projectStats"
            :key="project.id"
            class="tf6-project-pill"
          >
            <strong>{{ project.title }}</strong>

            <span>Усього: {{ project.totalTasks }}</span>
            <span>Невиконано: {{ project.unfinishedTasks }}</span>
            <span>Виконано: {{ project.completedTasks }}</span>
            <span>Прогрес: {{ project.completionPercent }}%</span>

            <button
              type="button"
              class="tf5-btn"
              :disabled="project.totalTasks === 0"
              @click="moveProjectToProgress(project)"
            >
              Усі в роботу
            </button>
          </div>
        </div>

        <form
          class="tf6-project-form"
          @submit.prevent="createProject"
        >
          <label>
            Назва нового проєкту

            <input
              v-model="newProjectTitle"
              type="text"
              maxlength="40"
              placeholder="Наприклад: Лабораторні"
              @input="newProjectError = ''"
            />
          </label>

          <button type="submit" class="tf5-btn tf5-btn--primary">
            Створити проєкт
          </button>
        </form>

        <p v-if="newProjectError" class="tf5-error" role="alert">
          {{ newProjectError }}
        </p>
      </section>

      <!-- Експорт та імпорт резервної копії -->
      <section class="tf5-panel tf7-backup-panel">
        <h2>Резервне копіювання</h2>

        <p>
          Експорт завдань і проєктів у JSON або відновлення
          даних із резервної копії.
        </p>

        <div class="tf7-backup-actions">
          <button
            type="button"
            class="tf5-btn tf5-btn--primary"
            @click="exportJson"
          >
            Експорт JSON
          </button>

          <button
            type="button"
            class="tf5-btn"
            @click="openImportDialog"
          >
            Імпорт JSON
          </button>

          <button
            v-if="exportUrl"
            type="button"
            class="tf5-btn tf5-btn--primary tf7-download-link"
            @click.stop="downloadJson"
          >
            Завантажити JSON-файл
          </button>

          <input
            ref="importInput"
            type="file"
            accept=".json,application/json"
            style="display: none"
            @change="importJson"
          />
        </div>

        <p
          v-if="exportMessage"
          class="tf7-export-message"
          role="status"
          aria-live="polite"
        >
          {{ exportMessage }}
        </p>
      </section>

      <!-- Форма завдання -->
      <TaskForm
        v-if="showForm"
        :key="editingId ?? 'new'"
        :task="editingTask"
        :projects="projects"
        @save="saveTask"
        @cancel="cancelForm"
      />

      <!-- Фільтри -->
      <TaskListControls
        v-model:search="searchText"
        v-model:status="selectedStatus"
        v-model:priority="selectedPriority"
        v-model:project="selectedProject"
        v-model:sort="sortOrder"
        v-model:onlyActive="onlyActive"
        v-model:onlyWithoutDueDate="onlyWithoutDueDate"
        :projects="projects"
        @reset="taskStore.resetFilters"
      />

      <!-- Список -->
      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">TASK LIST</div>
            <h2>Список завдань</h2>
          </div>

          <div class="tf3-counter">
            Показано: {{ visibleTasks.length }}
            із {{ tasks.length }}
          </div>
        </div>

        <div v-if="visibleTasks.length" class="tf3-task-grid">
          <TaskCard
            v-for="task in visibleTasks"
            :key="task.id"
            :task="task"
            :project-title="projectStore.projectTitle(task.projectId)"
            @status-change="taskStore.setTaskStatus"
            @priority-change="taskStore.setTaskPriority"
            @edit="startEdit"
            @delete="handleDelete"
          />
        </div>

        <div v-else class="tf5-empty">
          <p>За поточними умовами завдань не знайдено.</p>

          <button
            type="button"
            class="tf5-btn"
            @click="taskStore.resetFilters"
          >
            Показати всі завдання
          </button>
        </div>
      </section>
    </div>

    <AppTabbar active="tasks" />
  </f7-page>
</template>
