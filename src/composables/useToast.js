import { reactive } from 'vue'

const toasts = reactive([])

let idCounter = 0

export function useToast() {
  function show(message, type = 'info', duration = 4000) {
    const id = ++idCounter
    toasts.push({ id, message, type })

    setTimeout(() => {
      const idx = toasts.findIndex(t => t.id === id)
      if (idx !== -1) toasts.splice(idx, 1)
    }, duration)
  }

  return {
    toasts,
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur),
    info: (msg, dur) => show(msg, 'info', dur),
    dismiss: (id) => {
      const idx = toasts.findIndex(t => t.id === id)
      if (idx !== -1) toasts.splice(idx, 1)
    },
  }
}
