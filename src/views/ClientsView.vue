<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import InviteModal from '@/components/people/InviteModal.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import { invitationLink, usePeopleStore } from '@/stores/people'
import { copyText, formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Invitation } from '@/types/people'
import type { Task } from '@/types/tasks'

const people = usePeopleStore()
const router = useRouter()
/** The client a new task is being added for. */
const taskFor = ref('')

function onSaved(task: Task) {
  taskFor.value = ''
  void router.push({ name: 'task-detail', params: { id: task.id } })
}
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

async function copy(inv: Invitation) {
  if (await copyText(invitationLink(inv.token))) toast.success(t('clients.linkCopied'))
  else toast.error(t('clients.copyFailed'))
}

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
      <section v-if="people.clients.length" class="mt-6">
        <ul class="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          <li v-for="c in people.clients" :key="c.id" class="flex items-center gap-4 px-4 py-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              {{ (c.name || c.email).slice(0, 2).toUpperCase() }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-neutral-900">{{ c.name || c.email }}</p>
              <p class="truncate text-xs text-neutral-500">{{ $t('people.since', { email: c.email, date: formatDate(c.linked_at) }) }}</p>
            </div>
            <RouterLink
              :to="{ name: 'tasks', query: { with: c.id } }"
              class="shrink-0 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              {{ $t('people.openTasks', { n: c.open_tasks }, c.open_tasks) }}
            </RouterLink>
            <BaseButton variant="ghost" size="sm" :block="false" @click="taskFor = c.id">{{ $t('people.newTask') }}</BaseButton>
          </li>
        </ul>
      </section>

      <section v-if="people.invitations.length" class="mt-8">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('clients.pending') }}</h2>
        <ul class="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          <li v-for="inv in people.invitations" :key="inv.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-neutral-900">{{ inv.name }}</p>
              <p class="truncate text-xs text-neutral-500">
                {{ inv.email }} ·
                <span v-if="inv.expired" class="font-medium text-red-600">{{ $t('clients.expired') }}</span>
                <span v-else>{{ $t('clients.expires', { date: formatDate(inv.expires_at) }) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <BaseButton v-if="!inv.expired" variant="ghost" size="sm" :block="false" @click="copy(inv)">{{ $t('common.copyLink') }}</BaseButton>
              <BaseButton variant="ghost" size="sm" :block="false" @click="revoking = inv">{{ inv.expired ? $t('clients.remove') : $t('clients.revoke') }}</BaseButton>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <InviteModal v-if="inviting" @close="inviting = false" />
    <TaskFormModal v-if="taskFor" :people="people.clients" :person-id="taskFor" @close="taskFor = ''" @saved="onSaved" />
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
