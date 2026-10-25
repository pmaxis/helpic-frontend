<script setup lang="ts">
/**
 * One of the site's policies, for anyone, signed in or not: as an admin
 * wrote it, or else Helpic's own, in the interface's language. Each is a page
 * of its own, laid out as signing in is: the text on the light side, and on
 * the dark one, standing still while it scrolls, what the policy is about and
 * the policy drawn as a document that lights up as it's read. On a phone, the
 * text alone.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLogo from '@/components/ui/AppLogo.vue'
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PolicyText from '@/components/policies/PolicyText.vue'
import PolicyShowcase from '@/components/policies/PolicyShowcase.vue'
import LegalFooter from '@/components/policies/LegalFooter.vue'
import { APP_NAME } from '@/config'
import { isLocale } from '@/i18n'
import { fetchPolicy } from '@/services/policies'
import { useAuthStore } from '@/stores/auth'
import { formatDocumentDate } from '@/utils/format'
import type { Policy, PolicyKind } from '@/types/policies'

const props = defineProps<{ kind: PolicyKind }>()

const { locale } = useI18n()
const auth = useAuthStore()

const policy = ref<Policy | null>(null)
const failed = ref(false)

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  const mine = ++latest
  failed.value = false
  policy.value = null
  try {
    const p = await fetchPolicy(props.kind, isLocale(locale.value) ? locale.value : 'en')
    if (mine !== latest) return
    policy.value = p
    await nextTick()
    measure()
  } catch {
    if (mine === latest) failed.value = true
  }
}
watch([() => props.kind, locale], load, { immediate: true })

// --- how much of the text has been read ---------------------------------------

const progress = ref(0)

function measure() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  progress.value = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1
}

let frame = 0
function onScroll() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measure)
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(frame)
})

/** Where the soft light over the dark side is: it follows the pointer. */
const light = ref({ x: '75%', y: '15%' })

function onPointerMove(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  light.value = { x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` }
}

/** Where the way back leads: an admin's panel, someone's dashboard, or signing in. */
const home = computed(() => (auth.isAdmin ? '/admin' : auth.isAuthenticated ? '/dashboard' : '/login'))
</script>

<template>
  <main class="grid min-h-full bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <!-- The text -->
    <div class="flex min-h-full flex-col bg-neutral-50 px-5 py-6 sm:px-10">
      <div class="flex items-center justify-between gap-4">
        <RouterLink :to="home" :aria-label="APP_NAME">
          <AppLogo />
        </RouterLink>
        <LocaleSwitcher />
      </div>

      <article class="mx-auto w-full max-w-[38rem] flex-1 py-12 lg:py-16">
        <h1 class="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">{{ $t(`policies.names.${kind}`) }}</h1>
        <p v-if="policy?.updated_at" class="mt-3 text-sm text-neutral-500">{{ $t('policies.updated', { date: formatDocumentDate(policy.updated_at) }) }}</p>
        <hr class="my-8 border-neutral-200" />

        <div v-if="failed" class="flex flex-col items-start gap-4">
          <p class="text-sm text-neutral-600">{{ $t('policies.loadFailed') }}</p>
          <BaseButton variant="ghost" size="sm" :block="false" @click="load">{{ $t('policies.retry') }}</BaseButton>
        </div>
        <div v-else-if="!policy" class="space-y-3" aria-hidden="true">
          <div v-for="i in 8" :key="i" class="h-3.5 animate-pulse rounded bg-neutral-200/70" :class="i % 4 === 0 ? 'w-1/3' : i % 3 === 0 ? 'w-2/3' : 'w-full'" />
        </div>
        <PolicyText v-else :body="policy.body" />
      </article>

      <LegalFooter :current="kind" />
    </div>

    <!-- What the policy is about, and how far through it the reader is, standing still while the text scrolls -->
    <aside class="light-palette relative hidden bg-neutral-950 text-white lg:block" :aria-label="$t(`policies.names.${kind}`)">
      <div class="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-14 xl:px-20" @pointermove="onPointerMove">
        <!-- soft grid backdrop -->
        <svg class="pointer-events-none absolute inset-0 h-full w-full text-white/[0.05]" aria-hidden="true">
          <defs>
            <pattern id="policy-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0v32" fill="none" stroke="currentColor" stroke-width="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#policy-grid)" />
        </svg>
        <div class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <!-- a soft light that follows the pointer over the grid -->
        <div
          class="pointer-events-none absolute inset-0"
          :style="{ background: `radial-gradient(480px circle at ${light.x} ${light.y}, rgb(52 211 153 / 0.09), transparent 70%)` }"
          aria-hidden="true"
        />

        <div class="relative max-w-md">
          <p class="text-xs font-semibold tracking-wider text-emerald-400 uppercase">{{ $t(`policies.names.${kind}`) }}</p>
          <h2 class="mt-3 text-3xl leading-tight font-semibold tracking-tight">{{ $t(`policies.leads.${kind}`) }}</h2>

          <PolicyShowcase :kind="kind" :progress="progress" />
        </div>
      </div>
    </aside>
  </main>
</template>
