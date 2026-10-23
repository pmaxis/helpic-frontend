<script setup lang="ts">
/**
 * Who can open the admin panel, in a table: a row opens the admin in a card
 * beside it, as accounts open, with their devices and sign-ins; the open
 * admin is in the address (?admin=…). On a tab of its own (?tab=sign-ins)
 * every sign-in to an admin account, the failed attempts too, a page at a
 * time. Admins are made, locked and reset on the server, not here.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Pagination from '@/components/ui/Pagination.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { deviceName, formatDate, timeAgo } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import AccountAvatar from '../components/AccountAvatar.vue'
import AdminPanel from '../components/AdminPanel.vue'
import { fetchAdmins, fetchAdminSignIns } from '../api'
import type { AdminAccountAdmin, AdminSignInOutcome, AdminSignInsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

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

// --- the tabs: the admins, every sign-in ----------------------------------------------

const TABS = ['admins', 'sign-ins'] as const
type Tab = (typeof TABS)[number]
const tab = computed<Tab>(() => (route.query.tab === 'sign-ins' ? 'sign-ins' : 'admins'))

function show(next: Tab) {
  // The sign-ins have no card beside them.
  const { tab: _, admin: __, ...rest } = route.query
  void router.replace({ query: next === 'admins' ? rest : { ...rest, tab: next } })
}

// --- the open admin ------------------------------------------------------------------

const openId = computed(() => (tab.value === 'admins' && typeof route.query.admin === 'string' ? route.query.admin : null))
const openAdmin = computed(() => admins.value?.find((a) => a.id === openId.value) ?? null)

function open(id: string) {
  void router.replace({ query: { ...route.query, admin: id } })
}
function close() {
  const { admin: _, ...rest } = route.query
  void router.replace({ query: rest })
}

/** Something changed an admin: the list, and the sign-ins under it, are new. */
function changed() {
  void loadAdmins()
  void loadSignIns()
}

// --- every sign-in -------------------------------------------------------------------

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
    <nav class="mb-4 flex gap-5 border-b border-neutral-200" :aria-label="$t('nav.adminAdmins')">
      <button
        v-for="item in TABS"
        :key="item"
        type="button"
        class="-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors"
        :class="tab === item ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === item ? 'page' : undefined"
        @click="show(item)"
      >
        {{ item === 'admins' ? $t('nav.adminAdmins') : $t('admin.admins.signIns') }}
        <span v-if="item === 'admins' && admins" class="rounded-full bg-neutral-100 px-1.5 text-[11px] text-neutral-500 tabular-nums">{{ admins.length }}</span>
      </button>
    </nav>

    <div v-if="tab === 'admins'" class="overflow-x-auto rounded-xl border border-neutral-200">
      <table class="w-full text-left text-sm" :class="openId ? 'min-w-[24rem]' : 'min-w-[44rem]'">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns2.admin') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns2.lastSignIn') }}</th>
            <th v-if="!openId" scope="col" class="px-4 py-2.5 text-right font-medium">{{ $t('admin.admins.columns2.devices') }}</th>
            <th v-if="!openId" scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.admins.columns2.created') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr
            v-for="a in admins ?? []"
            :key="a.id"
            class="cursor-pointer transition-colors hover:bg-neutral-50"
            :class="openId === a.id ? 'bg-neutral-50' : ''"
            @click="open(a.id)"
          >
            <td class="max-w-80 px-4 py-2.5">
              <!-- the row's click is for the pointer; the name is the keyboard's way in -->
              <button type="button" class="flex w-full min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:underline" @click.stop="open(a.id)">
                <AccountAvatar :name="a.name" :email="a.email" />
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate font-medium text-neutral-900">{{ a.name || a.email }}</span>
                    <span v-if="a.id === auth.user?.id" class="shrink-0 rounded bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-600">{{ $t('admin.admins.you') }}</span>
                    <span v-if="a.two_factor" class="shrink-0 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700">2FA</span>
                  </span>
                  <span v-if="a.name" class="block truncate text-xs text-neutral-500">{{ a.email }}</span>
                </span>
              </button>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap" :class="a.last_sign_in ? 'text-neutral-600' : 'text-neutral-400'">
              {{ a.last_sign_in ? timeAgo(a.last_sign_in) : $t('admin.never') }}
            </td>
            <td v-if="!openId" class="px-4 py-2.5 text-right text-neutral-600 tabular-nums">{{ a.sessions.length }}</td>
            <td v-if="!openId" class="px-4 py-2.5 whitespace-nowrap text-neutral-600">{{ formatDate(a.created_at) }}</td>
          </tr>
          <template v-if="!admins">
            <tr v-for="i in 2" :key="i">
              <td v-for="j in openId ? 2 : 4" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <section v-else>
      <div class="flex justify-end">
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

    <template v-if="openAdmin" #side>
      <AdminPanel :admin="openAdmin" @close="close" @changed="changed" />
    </template>
  </AdminShell>
</template>
