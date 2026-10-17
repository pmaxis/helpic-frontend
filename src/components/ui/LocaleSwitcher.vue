<script setup lang="ts">
/** EN / УК: switches the interface's language (and the account's, when signed in). */
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n'
import { toast } from '@/composables/useToasts'
import { ApiRequestError } from '@/services/api'

const { locale, t } = useI18n()
const auth = useAuthStore()

const SHORT: Record<Locale, string> = { en: 'EN', uk: 'УК' }

async function pick(l: Locale) {
  if (l === locale.value) return
  try {
    await auth.setLocale(l)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('errors.generic'))
  }
}
</script>

<template>
  <div class="inline-flex rounded-md bg-neutral-100 p-0.5 text-xs font-medium" role="group" :aria-label="t('common.language')">
    <button
      v-for="l in LOCALES"
      :key="l"
      type="button"
      :lang="l"
      :title="LOCALE_NAMES[l]"
      :aria-pressed="locale === l"
      class="rounded px-2 py-1 transition-colors"
      :class="locale === l ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'"
      @click="pick(l)"
    >
      {{ SHORT[l] }}
    </button>
  </div>
</template>
