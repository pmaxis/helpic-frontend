<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import InviteModal from '@/components/people/InviteModal.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import { usePeopleStore } from '@/stores/people'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Invitation } from '@/types/people'

const people = usePeopleStore()
const loaded = ref(false)
const inviting = ref(false)
const revoking = ref<Invitation | null>(null)
const revokeBusy = ref(false)

onMounted(async () => {
  try {
    await people.fetchClients()
  } catch {
    toast.error(t('clients.loadFailed'))
  } finally {
    loaded.value = true
  }
})

async function revoke() {
  if (!revoking.value) return
  revokeBusy.value = true
  try {
    await people.revokeInvitation(revoking.value.id)
    toast.success(t('clients.revoked'))
  } catch {
    toast.error(t('clients.revokeFailed'))
  } finally {
    revokeBusy.value = false
    revoking.value = null
  }
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('clients.title')">
      <template #actions>
        <BaseButton size="sm" :block="false" @click="inviting = true">{{ $t('clients.invite') }}</BaseButton>
      </template>
    </PageHeader>

    <div v-if="loaded && !people.clients.length && !people.invitations.length" class="mt-6">
      <EmptyState :title="$t('clients.noneYet')" :description="$t('clients.noneYetText')">
        <BaseButton size="sm" :block="false" @click="inviting = true">{{ $t('clients.invite') }}</BaseButton>
      </EmptyState>
    </div>

    <template v-else-if="loaded">
      <ul v-if="people.clients.length" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="c in people.clients" :key="c.id">
          <PersonCard :person="c" />
        </li>
      </ul>

      <section v-if="people.invitations.length" class="mt-8">
        <h2 class="text-sm font-semibold text-neutral-900">
          {{ $t('clients.pending') }}
          <span class="ml-1.5 font-normal text-neutral-400">{{ people.invitations.length }}</span>
        </h2>
        <ul class="mt-3 grid gap-3">
          <li
            v-for="inv in people.invitations"
            :key="inv.id"
            class="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 p-4"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-500 ring-1 ring-neutral-200"
              aria-hidden="true"
            >
              {{ initials(inv.name || inv.email) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p class="truncate text-sm font-medium text-neutral-900">{{ inv.name || inv.email }}</p>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="inv.expired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'"
                >
                  {{ inv.expired ? $t('clients.expired') : $t('clients.expires', { date: formatDate(inv.expires_at) }) }}
                </span>
              </div>
              <p v-if="inv.name" class="mt-0.5 truncate text-xs text-neutral-500">{{ inv.email }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600"
              @click="revoking = inv"
            >
              {{ inv.expired ? $t('clients.remove') : $t('clients.revoke') }}
            </button>
          </li>
        </ul>
      </section>
    </template>

    <InviteModal v-if="inviting" @close="inviting = false" />
    <ConfirmDialog
      :open="!!revoking"
      :title="$t('clients.confirmRevoke')"
      :description="$t('clients.confirmRevokeText', { email: revoking?.email ?? '' })"
      :confirm-label="$t('clients.revoke')"
      :loading="revokeBusy"
      @update:open="(v) => { if (!v) revoking = null }"
      @confirm="revoke"
    />
  </DashboardLayout>
</template>
