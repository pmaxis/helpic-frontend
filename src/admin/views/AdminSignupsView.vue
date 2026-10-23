<script setup lang="ts">
/**
 * The sign-ups still waiting for their confirmation link, the newest first,
 * with how the email to each went: an admin can send a new link or remove
 * the sign-up. Each is recorded in the action log.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import InviteIllustration from '@/components/illustrations/InviteIllustration.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import AccountAvatar from '../components/AccountAvatar.vue'
import { deleteSignup, fetchAdminSignups, resendSignup } from '../api'
import type { AdminEmailStatus, AdminSignup, AdminSignupsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()

const LIMIT = 10
const query = ref('')
const page = ref(1)
const result = ref<AdminSignupsPage | null>(null)
const loading = ref(false)
const signups = computed<AdminSignup[] | null>(() => result.value?.signups ?? null)

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  if (!auth.canOpenAdmin) return
  const mine = ++latest
  loading.value = true
  try {
    const data = await fetchAdminSignups({ q: query.value.trim(), page: page.value, limit: LIMIT })
    if (mine === latest) result.value = data
  } catch {
    if (mine === latest) toast.error(t('admin.loadFailed'))
  } finally {
    if (mine === latest) loading.value = false
  }
}

// Typing waits for a pause; the page loads at once.
let typing: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch(page, () => void load())
onBeforeUnmount(() => clearTimeout(typing))
void load()

/** The sign-up being sent a link, by email. */
const resending = ref<string | null>(null)

async function resend(s: AdminSignup) {
  resending.value = s.email
  try {
    await resendSignup(s.email)
    toast.success(t('admin.signups.resent', { email: s.email }))
    await load()
  } catch {
    toast.error(t('admin.signups.failed'))
  } finally {
    resending.value = null
  }
}

/** The sign-up asked to be removed. */
const removing = ref<AdminSignup | null>(null)
const removeBusy = ref(false)

async function remove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await deleteSignup(removing.value.email)
    toast.success(t('admin.signups.removed'))
    removing.value = null
    // The last one on a page that isn't the first: step back a page.
    if (signups.value?.length === 1 && page.value > 1) page.value--
    else await load()
  } catch {
    toast.error(t('admin.signups.failed'))
  } finally {
    removeBusy.value = false
  }
}

const timeFormat = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const TONES: Record<AdminEmailStatus | '', string> = {
  queued: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  '': 'bg-neutral-100 text-neutral-600 ring-neutral-200',
}

/** Nothing waiting at all, rather than nothing matching the search. */
const noneAtAll = computed(() => !query.value.trim())
</script>

<template>
  <AdminShell :title="$t('nav.adminSignups')" :description="$t('admin.signups.description')" :fill="!!signups && !signups.length">
    <BaseInput v-model="query" :label="$t('admin.signups.search')" type="search" />

    <EmptyState
      v-if="signups && !signups.length"
      class="mt-6 flex-1 justify-center"
      :title="noneAtAll ? $t('admin.signups.empty') : $t('admin.signups.noMatch')"
      :description="noneAtAll ? $t('admin.signups.emptyText') : $t('admin.signups.noMatchText')"
    >
      <template #illustration>
        <InviteIllustration v-if="noneAtAll" />
        <FilterIllustration v-else />
      </template>
    </EmptyState>

    <div v-else class="mt-4 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && signups ? 'opacity-60' : ''">
      <table class="w-full min-w-[52rem] text-left text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.signups.columns.person') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.signups.columns.at') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.signups.columns.expires') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.signups.columns.email') }}</th>
            <th scope="col" class="px-4 py-2.5"><span class="sr-only">{{ $t('admin.manage.title') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr v-for="s in signups ?? []" :key="s.email" class="align-top">
            <td class="max-w-72 px-4 py-2.5">
              <div class="flex min-w-0 items-center gap-3">
                <AccountAvatar :name="s.name" :email="s.email" />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-neutral-900">{{ s.name || s.email }}</span>
                  <span v-if="s.name" class="block truncate text-xs text-neutral-500">{{ s.email }}</span>
                </span>
              </div>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ timeFormat.format(new Date(s.created_at)) }}</td>
            <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ timeFormat.format(new Date(s.expires_at)) }}</td>
            <td class="max-w-64 px-4 py-2.5">
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset" :class="TONES[s.email_status]">
                {{ $t(`admin.signups.emailStatus.${s.email_status || 'unknown'}`) }}
              </span>
              <p v-if="s.email_error && s.email_status !== 'sent'" class="mt-1 font-mono text-xs break-words text-red-600">{{ s.email_error }}</p>
            </td>
            <td class="px-4 py-2">
              <div class="flex justify-end gap-2">
              <BaseButton variant="ghost" size="sm" :block="false" :loading="resending === s.email" @click="resend(s)">{{ $t('admin.signups.resend') }}</BaseButton>
              <BaseButton variant="ghost" size="sm" :block="false" class="text-red-600 hover:text-red-700" @click="removing = s">{{ $t('admin.signups.remove') }}</BaseButton>
              </div>
            </td>
          </tr>
          <template v-if="!signups">
            <tr v-for="i in 5" :key="i">
              <td v-for="j in 5" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <Pagination v-if="result && result.total" v-model:page="page" class="mt-4" :total="result.total" :limit="LIMIT" />

    <ConfirmDialog
      :open="!!removing"
      :title="$t('admin.signups.removeTitle')"
      :description="$t('admin.signups.removeText', { email: removing?.email ?? '' })"
      :confirm-label="$t('admin.signups.remove')"
      :loading="removeBusy"
      @update:open="(v) => !v && (removing = null)"
      @confirm="remove"
    />
  </AdminShell>
</template>
