<script setup lang="ts">
/**
 * The rate limits refusing someone right now, the longest first: which
 * limit, whose email, address or account, and when it lifts by itself. An
 * admin can lift one sooner; it's recorded in the action log.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import LogsIllustration from '@/components/illustrations/LogsIllustration.vue'
import { toast } from '@/composables/useToasts'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import { clearAdminLimit, fetchAdminLimits } from '../api'
import { untilText } from '../limits'
import type { AdminLimit } from '../types'

const { t } = useI18n()
const auth = useAuthStore()

const query = ref('')
const limits = ref<AdminLimit[] | null>(null)
const loading = ref(false)
const clearing = ref<string | null>(null)

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  if (!auth.canOpenAdmin) return
  const mine = ++latest
  loading.value = true
  try {
    const data = await fetchAdminLimits({ q: query.value.trim() })
    if (mine === latest) limits.value = data
  } catch {
    if (mine === latest) toast.error(t('admin.loadFailed'))
  } finally {
    if (mine === latest) loading.value = false
  }
}

let typing: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(typing)
  typing = setTimeout(() => void load(), 300)
})
onBeforeUnmount(() => clearTimeout(typing))
void load()

const id = (l: AdminLimit) => `${l.scope} ${l.key}`

async function clear(l: AdminLimit) {
  clearing.value = id(l)
  try {
    await clearAdminLimit(l)
    toast.success(t('admin.limits.cleared'))
  } catch {
    toast.error(t('admin.limits.failed'))
  } finally {
    clearing.value = null
    await load()
  }
}

/** Nothing limited at all, rather than nothing matching the search. */
const noneAtAll = computed(() => !query.value.trim())
</script>

<template>
  <AdminShell :title="$t('nav.adminLimits')" :description="$t('admin.limits.description')" :fill="!!limits && !limits.length">
    <template #actions>
      <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load()">{{ $t('admin.logs.refresh') }}</BaseButton>
    </template>

    <BaseInput v-model="query" :label="$t('admin.limits.search')" type="search" />

    <EmptyState
      v-if="limits && !limits.length"
      class="mt-6 flex-1 justify-center"
      :title="noneAtAll ? $t('admin.limits.empty') : $t('admin.limits.noMatch')"
      :description="noneAtAll ? $t('admin.limits.emptyText') : $t('admin.limits.noMatchText')"
    >
      <template #illustration>
        <LogsIllustration v-if="noneAtAll" />
        <FilterIllustration v-else />
      </template>
    </EmptyState>

    <div v-else class="mt-4 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && limits ? 'opacity-60' : ''">
      <table class="w-full min-w-[44rem] text-left text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.limits.columns.limit') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.limits.columns.who') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.limits.columns.opens') }}</th>
            <th scope="col" class="px-4 py-2.5"><span class="sr-only">{{ $t('admin.manage.title') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr v-for="l in limits ?? []" :key="id(l)" class="align-top">
            <td class="px-4 py-2.5 font-medium text-neutral-900">{{ $t(`admin.limits.scopes.${l.scope}`) }}</td>
            <td class="max-w-72 px-4 py-2.5">
              <RouterLink
                v-if="l.account_id"
                :to="{ path: '/admin/users', query: { account: l.account_id } }"
                class="block truncate font-medium text-neutral-900 hover:underline"
              >
                {{ l.account_email }}
              </RouterLink>
              <span v-else-if="l.email" class="block truncate text-neutral-900">{{ l.email }}</span>
              <span v-if="l.ip" class="block truncate font-mono text-xs text-neutral-500">{{ l.ip }}</span>
              <span v-if="!l.account_id && l.kind !== 'ip'" class="block text-xs text-neutral-400">{{ $t('admin.limits.noAccount') }}</span>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ untilText(l.opens_at) }}</td>
            <td class="px-4 py-2 text-right">
              <BaseButton variant="ghost" size="sm" :block="false" :loading="clearing === id(l)" @click="clear(l)">{{ $t('admin.limits.clear') }}</BaseButton>
            </td>
          </tr>
          <template v-if="!limits">
            <tr v-for="i in 4" :key="i">
              <td v-for="j in 4" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </AdminShell>
</template>
