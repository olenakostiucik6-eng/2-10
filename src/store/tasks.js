
import { defineStore } from 'pinia'
import initialTasks from '../data/tasks'
import { useProjectsStore } from './projects'

const allowedStatuses = ['todo', 'progress', 'done']
const allowedPriorities = ['low', 'medium', 'high']
const allowedCategories = ['learning', 'work', 'personal']

function normalizeValues(values, projects) {
  const requestedProject = String(values.projectId ?? 'general')

  const projectId = projects.some(
    (project) => project.id === requestedProject
  )
    ? requestedProject
    : 'general'

  return {
    title: String(values.title ?? '').trim(),
    description: String(values.description ?? '').trim(),
    status: allowedStatuses.includes(values.status)
      ? values.status
      : 'todo',
    priority: allowedPriorities.includes(values.priority)
      ? values.priority
      : 'medium',
    category: allowedCategories.includes(values.category)
      ? values.category
      : 'learning',
    dueDate: String(values.dueDate ?? ''),
    projectId,
  }
}

function isValidTask(values) {
  return (
    values.title.length >= 3 &&
    values.title.length <= 80 &&
    values.description.length <= 500 &&
    (
      !values.dueDate ||
      /^\d{4}-\d{2}-\d{2}$/.test(values.dueDate)
    )
  )
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: initialTasks.map((task) => ({
      ...task,
      category: task.category ?? 'learning',
      projectId: task.projectId ?? 'general',
    })),

    searchText: '',
    selectedStatus: 'all',
    selectedPriority: 'all',
    selectedProject: 'all',
    sortOrder: 'newest',

    onlyActive: false,
    onlyWithoutDueDate: false,
  }),

  getters: {
    totalTasks: (state) => state.tasks.length,

    completedTasks: (state) =>
      state.tasks.filter((task) => task.status === 'done').length,

    progressTasks: (state) =>
      state.tasks.filter((task) => task.status === 'progress').length,

    activeTasks: (state) => {
      const rank = { high: 3, medium: 2, low: 1 }

      return state.tasks
        .filter((task) => task.status !== 'done')
        .sort(
          (a, b) =>
            rank[b.priority] - rank[a.priority] || b.id - a.id
        )
        .slice(0, 3)
    },

    visibleTasks: (state) => {
      const term = state.searchText
        .trim()
        .toLocaleLowerCase('uk-UA')

      const rank = { high: 3, medium: 2, low: 1 }
      const statusRank = {
        progress: 3,
        todo: 2,
        done: 1,
      }

      const filtered = state.tasks.filter((task) => {
        const text = `${task.title} ${task.description ?? ''}`
          .toLocaleLowerCase('uk-UA')

        return (
          (!term || text.includes(term)) &&
          (
            state.selectedStatus === 'all' ||
            task.status === state.selectedStatus
          ) &&
          (
            state.selectedPriority === 'all' ||
            task.priority === state.selectedPriority
          ) &&
          (
            state.selectedProject === 'all' ||
            task.projectId === state.selectedProject
          ) &&
          (!state.onlyActive || task.status !== 'done') &&
          (!state.onlyWithoutDueDate || !task.dueDate)
        )
      })

      return filtered.sort((a, b) => {
        if (state.sortOrder === 'title') {
          return a.title.localeCompare(b.title, 'uk-UA') || a.id - b.id
        }

        if (state.sortOrder === 'priority') {
          return rank[b.priority] - rank[a.priority] || b.id - a.id
        }

        if (state.sortOrder === 'status') {
          return statusRank[b.status] - statusRank[a.status] || b.id - a.id
        }

        if (
          state.sortOrder === 'dueDate' ||
          state.sortOrder === 'dueDateDesc'
        ) {
          if (!a.dueDate && !b.dueDate) return b.id - a.id
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1

          const comparison = a.dueDate.localeCompare(b.dueDate)

          return state.sortOrder === 'dueDateDesc'
            ? -comparison || b.id - a.id
            : comparison || b.id - a.id
        }

        return b.id - a.id
      })
    },
  },

  actions: {
    addTask(values) {
      const projectStore = useProjectsStore()
      const normalized = normalizeValues(values, projectStore.projects)

      if (!isValidTask(normalized)) return false

      const nextId =
        Math.max(0, ...this.tasks.map((task) => task.id)) + 1

      this.tasks.unshift({
        id: nextId,
        ...normalized,
      })

      return true
    },

    updateTask(values) {
      const task = this.tasks.find(
        (item) => item.id === Number(values.id)
      )

      if (!task) return false

      const projectStore = useProjectsStore()
      const normalized = normalizeValues(values, projectStore.projects)

      if (!isValidTask(normalized)) return false

      Object.assign(task, normalized)
      return true
    },

    deleteTask(id) {
      const index = this.tasks.findIndex(
        (task) => task.id === Number(id)
      )

      if (index === -1) return false

      this.tasks.splice(index, 1)
      return true
    },

    setTaskStatus({ id, status }) {
      if (!allowedStatuses.includes(status)) return false

      const task = this.tasks.find(
        (item) => item.id === Number(id)
      )

      if (!task) return false

      task.status = status
      return true
    },

    setTaskPriority({ id, priority }) {
      if (!allowedPriorities.includes(priority)) return false

      const task = this.tasks.find(
        (item) => item.id === Number(id)
      )

      if (!task) return false

      task.priority = priority
      return true
    },

    // Масова зміна статусу завдань одного проєкту.
    setProjectTasksInProgress(projectId) {
      const projectStore = useProjectsStore()

      const projectExists = projectStore.projects.some(
        (project) => project.id === projectId
      )

      if (!projectExists) return 0

      let updatedCount = 0

      this.tasks.forEach((task) => {
        if (
          task.projectId === projectId &&
          task.status !== 'progress'
        ) {
          task.status = 'progress'
          updatedCount += 1
        }
      })

      return updatedCount
    },

    resetFilters() {
      this.searchText = ''
      this.selectedStatus = 'all'
      this.selectedPriority = 'all'
      this.selectedProject = 'all'
      this.sortOrder = 'newest'
      this.onlyActive = false
      this.onlyWithoutDueDate = false
    },
  },
})
