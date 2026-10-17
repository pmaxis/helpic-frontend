import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { onUnauthorized } from './services/api'
import { useAuthStore } from './stores/auth'
import { useNotificationsStore } from './stores/notifications'
import { toast } from './composables/useToasts'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Wire the API layer's 401 handler to the auth store once Pinia is active.
onUnauthorized(() => {
  useAuthStore().handleSessionExpired()
  useNotificationsStore().stopPolling()
  if (router.currentRoute.value.meta.requiresAuth) {
    toast.info('Your session expired. Please sign in again.')
    void router.replace({ name: 'login' })
  }
})

app.mount('#app')
