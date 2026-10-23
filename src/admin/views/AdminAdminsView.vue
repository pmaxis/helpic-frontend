<script setup lang="ts">
/**
 * Who can open the admin panel: each admin with their last sign-in and the
 * devices they're signed in on; under them every sign-in to an admin
 * account, the failed attempts too, a page at a time. Admins are made on the
 * server, not here.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pagination from '@/components/ui/Pagination.vue'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { deviceName, parseDevice, timeAgo } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import AccountAvatar from '../components/AccountAvatar.vue'
import { fetchAdmins, fetchAdminSignIns } from '../api'
import type { AdminAccountAdmin, AdminSignInOutcome, AdminSignInsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()

const admins = ref<AdminAccountAdmin[] | null>(null)

async function loadAdmins() {
  if (!auth.canOpenAdmin) return
  try {
    admins.value = await fetchAdmins()
  } catch {
    toast.error(t('admin.loadFailed'))
  }
}
void loadAdmins()

const LIMIT = 10
const failedOnly = ref(false)
const page = ref(1)
const signIns = ref<AdminSignInsPage | null>(null)
const loading = ref(false)

async function loadSignIns() {
  if (!auth.canOpenAdmin) return
  loading.value = true
  try {
    signIns.value = await fetchAdminSignIns({ failed: failedOnly.value, page: page.value, limit: LIMIT })
  } catch {
    toast.error(t('admin.loadFailed'))
  } finally {
    loading.value = false
  }
}
watch(failedOnly, () => {
  if (page.value === 1) void loadSignIns()
  else page.value = 1
})
watch(page, () => void loadSignIns())
void loadSignIns()

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const TONES: Record<AdminSignInOutcome, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  wrong_password: 'bg-red-50 text-red-700 ring-red-200',
  wrong_code: 'bg-red-50 text-red-700 ring-red-200',
  limited: 'bg-amber-50 text-amber-700 ring-amber-200',
}
</script>

<template>
  <AdminShell :title="$t('nav.adminAdmins')" :description="$t('admin.admins.description')">
    <div class="grid gap-3 lg:grid-cols-2">
      <template v-if="admins">
        <section v-for="a in admins" :key="a.id" class="rounded-xl border border-neutral-200 px-4 py-3.5">
          <div class="flex items-center gap-3">
            <AccountAvatar :name="a.name" :email="a.email" />
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5">
                <span class="truncate font-medium text-neutral-900">{{ a.name || a.email }}</span>
                <span v-if="a.id === auth.user?.id" class="shrink-0 rounded bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-600">{{ $t('admin.admins.you') }}</span>
                <span v-if="a.two_factor" class="shrink-0 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700">2FA</span>
              </p>
              <p v-if="a.name" class="truncate text-xs text-neutral-500">{{ a.email }}</p>
            </div>
          </div>
          <p v-if="!a.two_factor" class="mt-2 text-xs text-amber-700">{{ $t('admin.admins.noTwoFactor') }}</p>
          <p class="mt-2 text-xs text-neutral-500">
            {{ a.last_sign_in ? $t('admin.admins.lastSignIn', { when: timeAgo(a.last_sign_in) }) : $t('admin.admins.neverSignedIn') }} ·
            {{ $t('admin.admins.devices', { n: a.sessions.length }, a.sessions.length) }}
          </p>
          <ul v-if="a.sessions.length" class="mt-2.5 space-y-2">
            <li v-for="s in a.sessions" :key="s.id" class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                <DeviceIcon :kind="parseDevice(s.user_agent).kind" class="h-3.5 w-3.5" />
              </span>
              <p class="min-w-0 flex-1 truncate text-sm text-neutral-900">
                {{ deviceName(s.user_agent) }}
                <span class="text-xs text-neutral-500"> · {{ $t('admin.account.activeAgo', { when: timeAgo(s.last_used_at) }) }}<template v-if="s.ip"> · {{ s.ip }}</template></span>
              </p>
            </li>
          </ul>
        </section>
      </template>
      <template v-else>
        <div v-for="i in 2" :key="i" class="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
      </template>
    </div>

    <section class="mt-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.admins.signIns') }}</h2>
          <p class="text-xs text-neutral-500">{{ $t('admin.admins.signInsHint') }}</p>
        </div>
        <div class="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group">
          <button
            v-for="f in [false, true]"
            :key="String(f)"
            type="button"
            class="rounded-md px-2.5 py-1 font-medium transition-colors"
            :class="failedOnly === f ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
            :aria-pressed="failedOnly === f"
            @click="failedOnly = f"
          >
            {{ $t(`admin.admins.filter.${f ? 'failed' : 'all'}`) }}
          </button>
        </div>
      </div>

      <div class="mt-3 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && signIns ? 'opacity-60' : ''">
        <table class="w-full min-w-[44rem] text-left text-sm">
          <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th scope="col" class="w-36 px-4 py-2.5 font-medium">{{ $t('admin.admins.columns.at') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns.admin') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns.outcome') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns.device') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            <tr v-for="s in signIns?.sign_ins ?? []" :key="s.id">
              <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ dateTime.format(new Date(s.at)) }}</td>
              <td class="max-w-56 truncate px-4 py-2.5 text-neutral-900">{{ s.admin_email }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset" :class="TONES[s.outcome]">
                  {{ $t(`admin.admins.outcomes.${s.outcome}`) }}
                </span>
              </td>
              <td class="max-w-64 truncate px-4 py-2.5 text-neutral-600">
                {{ deviceName(s.user_agent) }}<template v-if="s.ip"> · <span class="font-mono text-xs">{{ s.ip }}</span></template>
              </td>
            </tr>
            <tr v-if="signIns && !signIns.sign_ins.length">
              <td colspan="4" class="px-4 py-6 text-center text-sm text-neutral-500">
                {{ failedOnly ? $t('admin.admins.emptyFailed') : $t('admin.admins.empty') }}
              </td>
            </tr>
            <template v-if="!signIns">
              <tr v-for="i in 4" :key="i">
                <td v-for="j in 4" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <Pagination v-if="signIns && signIns.total" v-model:page="page" class="mt-4" :total="signIns.total" :limit="LIMIT" />
    </section>
  </AdminShell>
</template>
