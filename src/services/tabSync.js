
import { reactive } from 'vue'

const tabId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('taskflow-sync')
  : null

export const remoteChangeState = reactive({
  hasChanges: false,
  lastSavedAt: null,
})

// Повідомляємо інші вкладки про успішне збереження.
export function announceSaved(savedAt) {
  if (!channel) return

  channel.postMessage({
    type: 'snapshot-saved',
    source: tabId,
    savedAt,
  })
}

// Отримуємо повідомлення з інших вкладок.
if (channel) {
  channel.addEventListener('message', (event) => {
    const message = event.data

    if (
      !message ||
      message.type !== 'snapshot-saved' ||
      message.source === tabId
    ) {
      return
    }

    remoteChangeState.hasChanges = true
    remoteChangeState.lastSavedAt = message.savedAt
  })
}

// Очищення повідомлення про зовнішні зміни.
export function clearRemoteChangeNotice() {
  remoteChangeState.hasChanges = false
  remoteChangeState.lastSavedAt = null
}
