
<script setup>
import { storeToRefs } from 'pinia'

import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'

import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'

import '../css/task-components.css'
import '../css/task-list.css'

const taskStore = useTasksStore()
const projectStore = useProjectsStore()

// Отримання реактивних даних зі сховища завдань.
const {
  totalTasks,
  completedTasks,
  progressTasks,
  activeTasks,
} = storeToRefs(taskStore)

// Отримання реактивних даних зі сховища проєктів.
const {
  projectCount,
  projectStats,
} = storeToRefs(projectStore)

function projectTitleFor(task) {
  return projectStore.projectTitle(task.projectId)
}
</script>

<template>
  <f7-page name="home" class="tf3-page">
    <f7-navbar title="TaskFlow">
      <f7-nav-right>
        <f7-link href="/about/">Про застосунок</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="tf3-container">
      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / DASHBOARD</div>

        <h1>Панель керування</h1>

        <p>
          Контролюйте виконання завдань і пріоритети.
          Проєктів: {{ projectCount }}.
        </p>
      </section>

      <!-- Загальна статистика завдань -->
      <section class="tf3-stat-grid">
        <div class="tf3-stat">
          <span class="tf3-stat-label">Усього завдань</span>
          <strong>{{ totalTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">У роботі</span>
          <strong>{{ progressTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">Виконано</span>
          <strong>{{ completedTasks }}</strong>
        </div>
      </section>

      <!-- Статистика окремих проєктів із Pinia -->
      <section
        class="tf5-panel tf6-project-panel"
        aria-label="Статистика проєктів"
      >
        <h2>Статистика проєктів</h2>

        <div
          v-if="projectStats.length"
          class="tf6-project-list"
        >
          <div
            v-for="project in projectStats"
            :key="project.id"
            class="tf6-project-pill"
          >
            <strong>{{ project.title }}</strong>

            <span>
              Усього завдань: {{ project.totalTasks }}
            </span>

            <span>
              Невиконано: {{ project.unfinishedTasks }}
            </span>

            <span>
              Виконано: {{ project.completedTasks }}
            </span>

            <span>
              Прогрес: {{ project.completionPercent }}%
            </span>
          </div>
        </div>

        <p v-else>
          Проєктів поки немає.
        </p>
      </section>

      <!-- Актуальні завдання -->
      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">PRIORITY TASKS</div>
            <h2>Актуальні завдання</h2>
          </div>

          <f7-button href="/tasks/" outline small>
            Переглянути всі
          </f7-button>
        </div>

        <div
          v-if="activeTasks.length"
          class="tf3-task-grid"
        >
          <TaskCard
            v-for="task in activeTasks"
            :key="task.id"
            :task="task"
            :project-title="projectTitleFor(task)"
            :show-management-actions="false"
            @status-change="taskStore.setTaskStatus"
            @priority-change="taskStore.setTaskPriority"
          />
        </div>

        <div v-else class="tf3-empty">
          Наразі всі завдання виконані.
        </div>
      </section>
    </div>

    <AppTabbar active="home" />
  </f7-page>
</template>
