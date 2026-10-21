<script setup lang="ts">
import { APP_NAME } from '@/config'
import { ref } from 'vue'
import AuthShowcase from '@/components/auth/AuthShowcase.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue'

const year = new Date().getFullYear()

/** Where the soft light over the product side is: it follows the pointer. */
const light = ref({ x: '75%', y: '15%' })

function onPointerMove(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  light.value = { x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` }
}

/** The selling points: keys under "authLayout.features" in the messages. */
const FEATURES = ['invite', 'tasks', 'projects', 'personal'] as const

</script>

<template>
  <main class="grid min-h-full bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <!-- Form side -->
    <div class="flex min-h-full flex-col bg-neutral-50 px-5 py-6 sm:px-10">
      <div class="flex items-center justify-between gap-4">
        <RouterLink to="/" :aria-label="APP_NAME">
          <AppLogo />
        </RouterLink>
        <LocaleSwitcher />
      </div>
      <div class="flex flex-1 items-center justify-center py-10">
        <slot />
      </div>
      <footer class="text-xs text-neutral-400">
        <p>{{ $t('authLayout.rights', { year, app: APP_NAME }) }}</p>
      </footer>
    </div>

    <!-- Product side -->
    <aside
      class="light-palette relative hidden overflow-hidden bg-neutral-950 text-white lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      :aria-label="$t('authLayout.about', { app: APP_NAME })"
      @pointermove="onPointerMove"
    >
      <!-- soft grid backdrop -->
      <svg class="pointer-events-none absolute inset-0 h-full w-full text-white/[0.05]" aria-hidden="true">
        <defs>
          <pattern id="auth-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0v32" fill="none" stroke="currentColor" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>
      <div class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <!-- a soft light that follows the pointer over the grid -->
      <div
        class="pointer-events-none absolute inset-0"
        :style="{ background: `radial-gradient(480px circle at ${light.x} ${light.y}, rgb(52 211 153 / 0.09), transparent 70%)` }"
        aria-hidden="true"
      />

      <div class="relative max-w-lg">
        <h2 class="text-3xl leading-tight font-semibold tracking-tight">{{ $t('authLayout.heroTitle') }}<br />{{ $t('authLayout.heroTitle2') }}</h2>
        <p class="mt-3 text-sm leading-relaxed text-neutral-400">
          {{ $t('authLayout.heroText') }}
        </p>

        <!-- A live glimpse of the app -->
        <AuthShowcase />

        <ul class="mt-10 grid gap-5 sm:grid-cols-2">
          <li v-for="f in FEATURES" :key="f">
            <p class="flex items-center gap-2 text-sm font-medium">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-emerald-400" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {{ $t(`authLayout.features.${f}.title`) }}
            </p>
            <p class="mt-1 pl-5.5 text-xs leading-relaxed text-neutral-400">{{ $t(`authLayout.features.${f}.text`) }}</p>
          </li>
        </ul>
      </div>
    </aside>
  </main>
</template>
