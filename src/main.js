
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Framework7 from 'framework7/lite-bundle'
import Framework7Vue, { registerComponents } from 'framework7-vue/bundle'

import 'framework7/css/bundle'
import 'framework7-icons'

import './css/app.css'

import App from './App.vue'
import { initializePersistence } from './services/persistence'

// Залишаємо реєстрацію Framework7.
Framework7.use(Framework7Vue)

const app = createApp(App)
const pinia = createPinia()

// Підключаємо Pinia до Vue.
app.use(pinia)

// Реєструємо компоненти Framework7.
registerComponents(app)

// Спочатку відновлюємо дані, потім запускаємо інтерфейс.
async function bootstrap() {
  await initializePersistence(pinia)
  app.mount('#app')
}

bootstrap().catch((error) => {
  console.error('TaskFlow: помилка запуску:', error)
  app.mount('#app')
})
