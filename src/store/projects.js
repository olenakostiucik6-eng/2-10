
import { defineStore } from 'pinia'
import { useTasksStore } from './tasks'

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [
      { id: 'general', title: 'Загальні' },
      { id: 'study', title: 'Навчання' },
      { id: 'personal', title: 'Особисті' }
    ],
    nextProjectId: 1
  }),

  getters: {
    projectCount: (state) => state.projects.length,

    projectTitle: (state) => (id) => {
      return state.projects.find(project => project.id === id)?.title ?? 'Загальні'
    },

    projectStats() {
      const taskStore = useTasksStore()

      return this.projects.map(project => {
        const projectTasks = taskStore.tasks.filter(
          task => task.projectId === project.id
        )

        const totalTasks = projectTasks.length
        const completedTasks = projectTasks.filter(
          task => task.status === 'done'
        ).length

        return {
          ...project,
          totalTasks,
          completedTasks,
          unfinishedTasks: totalTasks - completedTasks,
          completionPercent: totalTasks
            ? Math.round((completedTasks / totalTasks) * 100)
            : 0
        }
      })
    }
  },

  actions: {
    addProject(rawTitle) {
      const title = String(rawTitle ?? '').trim()

      if (title.length < 3 || title.length > 40) {
        return null
      }

      const duplicate = this.projects.some(
        project =>
          project.title.toLocaleLowerCase('uk-UA') ===
          title.toLocaleLowerCase('uk-UA')
      )

      if (duplicate) {
        return null
      }

      const project = {
        id: `project-${this.nextProjectId}`,
        title
      }

      this.nextProjectId += 1
      this.projects.push(project)

      return project
    }
  }
})
