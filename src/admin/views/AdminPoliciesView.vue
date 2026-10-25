<script setup lang="ts">
/**
 * The site's policies, each in English and Ukrainian: the text, and behind
 * the eye by the languages how it reads, saved for everyone at once, or Helpic's own put back. Drafts are
 * kept per policy and language while the page is open, so switching between
 * them loses nothing.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PolicyText from '@/components/policies/PolicyText.vue'
import { toast } from '@/composables/useToasts'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n'
import { ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { timeAgo } from '@/utils/format'
import { POLICY_KINDS, type AdminPolicy, type PolicyKind } from '@/types/policies'
import AdminShell from '../components/AdminShell.vue'
import { fetchAdminPolicies, resetAdminPolicy, saveAdminPolicy } from '../api'

const { t, locale: uiLocale } = useI18n()
const auth = useAuthStore()

const kind = ref<PolicyKind>('privacy')
const locale = ref<Locale>(uiLocale.value as Locale)

/** The text as it reads instead of the code; the code by default. */
const previewing = ref(false)

const key = (k: PolicyKind, l: Locale) => `${k}.${l}`

const policies = ref<Record<string, AdminPolicy> | null>(null)
const drafts = ref<Record<string, string>>({})

async function load() {
  if (!auth.canOpenAdmin) return
  try {
    const list = await fetchAdminPolicies()
    policies.value = Object.fromEntries(list.map((p) => [key(p.kind, p.locale), p]))
    drafts.value = Object.fromEntries(list.map((p) => [key(p.kind, p.locale), p.body]))
  } catch {
    toast.error(t('admin.loadFailed'))
  }
}
void load()

const current = computed(() => policies.value?.[key(kind.value, locale.value)] ?? null)
const draft = computed({
  get: () => drafts.value[key(kind.value, locale.value)] ?? '',
  set: (v: string) => (drafts.value[key(kind.value, locale.value)] = v),
})

const isDirty = (k: PolicyKind, l: Locale) => {
  const p = policies.value?.[key(k, l)]
  return !!p && drafts.value[key(k, l)] !== p.body
}
const kindDirty = (k: PolicyKind) => LOCALES.some((l) => isDirty(k, l))
const dirty = computed(() => isDirty(kind.value, locale.value))

const error = ref('')
const saving = ref(false)

function keep(p: AdminPolicy) {
  policies.value = { ...policies.value, [key(p.kind, p.locale)]: p }
  drafts.value[key(p.kind, p.locale)] = p.body
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    keep(await saveAdminPolicy(kind.value, locale.value, draft.value))
    toast.success(t('policyAdmin.saved'))
  } catch (e) {
    if (e instanceof ApiRequestError && e.fields?.body) error.value = e.fields.body
    else toast.error(t('policyAdmin.saveFailed'))
  } finally {
    saving.value = false
  }
}

const confirmReset = ref(false)
const resetting = ref(false)

async function reset() {
  resetting.value = true
  try {
    keep(await resetAdminPolicy(kind.value, locale.value))
    confirmReset.value = false
    error.value = ''
    toast.success(t('policyAdmin.resetDone'))
  } catch {
    toast.error(t('policyAdmin.resetFailed'))
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <AdminShell :title="$t('nav.adminPolicies')" :description="$t('policyAdmin.description')">
    <template #actions>
      <a
        :href="`/${kind}`"
        target="_blank"
        rel="noopener"
        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 shadow-xs transition-colors hover:bg-neutral-50"
      >
        {{ $t('policyAdmin.open') }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </template>

    <div class="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200">
      <nav class="-mb-px flex gap-5 overflow-x-auto" :aria-label="$t('policies.nav')">
        <button
          v-for="k in POLICY_KINDS"
          :key="k"
          type="button"
          class="flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
          :class="kind === k ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
          :aria-current="kind === k ? 'page' : undefined"
          @click="kind = k"
        >
          {{ $t(`policies.names.${k}`) }}
          <span v-if="kindDirty(k)" class="h-1.5 w-1.5 rounded-full bg-amber-500" :title="$t('policyAdmin.unsaved')" />
        </button>
      </nav>
      <div class="mb-2 flex items-center gap-2">
        <div class="inline-flex rounded-md bg-neutral-100 p-0.5 text-xs font-medium" role="group" :aria-label="$t('policyAdmin.language')">
          <button
            v-for="l in LOCALES"
            :key="l"
            type="button"
            :lang="l"
            :aria-pressed="locale === l"
            class="flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors"
            :class="locale === l ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'"
            @click="locale = l"
          >
            {{ LOCALE_NAMES[l] }}
            <span v-if="isDirty(kind, l)" class="h-1.5 w-1.5 rounded-full bg-amber-500" :title="$t('policyAdmin.unsaved')" />
          </button>
        </div>
        <button
          type="button"
          class="flex h-[26px] w-[26px] items-center justify-center rounded-md transition-colors"
          :class="previewing ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'"
          :aria-pressed="previewing"
          :aria-label="$t('policyAdmin.preview')"
          :title="$t('policyAdmin.preview')"
          @click="previewing = !previewing"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="!current" class="mt-6 grid gap-6 lg:grid-cols-2" aria-hidden="true">
      <div class="h-96 animate-pulse rounded-lg bg-neutral-100" />
      <div class="h-96 animate-pulse rounded-lg bg-neutral-100" />
    </div>

    <template v-else>
      <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span v-if="current.custom" class="text-neutral-500">
          {{
            current.updated_by
              ? $t('policyAdmin.edited', { who: current.updated_by, when: timeAgo(current.updated_at!) })
              : $t('policyAdmin.editedSomeone', { when: timeAgo(current.updated_at!) })
          }}
        </span>
        <span v-if="dirty" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{{ $t('policyAdmin.unsaved') }}</span>
      </div>

      <div class="mt-4 flex flex-1 flex-col">
        <div v-if="!previewing" class="flex flex-1 flex-col">
          <textarea
            v-model="draft"
            :lang="locale"
            spellcheck="true"
            :aria-label="$t('policyAdmin.text')"
            :aria-invalid="error ? 'true' : undefined"
            class="block min-h-[32rem] w-full flex-1 resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-neutral-900 transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
            :class="error ? 'border-neutral-900' : ''"
          />
          <p class="mt-1.5 text-xs text-neutral-500">{{ $t('policyAdmin.format') }}</p>
        </div>
        <div v-else class="min-h-[32rem] flex-1 rounded-lg border border-neutral-200 bg-neutral-50 p-6 sm:p-10" :lang="locale">
          <h2 class="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">{{ $t(`policies.names.${kind}`) }}</h2>
          <PolicyText :body="draft" />
        </div>
        <p v-if="error" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>
      </div>

      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <BaseButton v-if="current.custom" variant="ghost" size="sm" :block="false" @click="confirmReset = true">{{ $t('policyAdmin.reset') }}</BaseButton>
        <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving || !dirty || !draft.trim()" @click="save">{{ $t('policyAdmin.save') }}</BaseButton>
      </div>
    </template>

    <ConfirmDialog
      v-model:open="confirmReset"
      :title="$t('policyAdmin.resetTitle')"
      :description="$t('policyAdmin.resetText')"
      :confirm-label="$t('policyAdmin.reset')"
      :loading="resetting"
      @confirm="reset"
    />
  </AdminShell>
</template>
