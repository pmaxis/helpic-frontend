<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import InviteIllustration from '@/components/illustrations/InviteIllustration.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import InviteModal from '@/components/people/InviteModal.vue'
import PendingInvitations from '@/components/people/PendingInvitations.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import { usePeopleStore } from '@/stores/people'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'

const people = usePeopleStore()
const loaded = ref(false)
const inviting = ref(false)

onMounted(async () => {
  try {
    await people.fetchClients()
  } catch {
    toast.error(t('clients.loadFailed'))
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <!-- with nobody yet the page is filled, so the empty state sits in the middle -->
  <DashboardLayout :fill="loaded && !people.clients.length && !people.invitations.length">
    <PageHeader :title="$t('clients.title')">
      <template #actions>
        <BaseButton size="sm" :block="false" @click="inviting = true">{{ $t('clients.invite') }}</BaseButton>
      </template>
    </PageHeader>

    <div v-if="loaded && !people.clients.length && !people.invitations.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState class="flex-1 justify-center" :title="$t('clients.noneYet')" :description="$t('clients.noneYetText')">
        <template #illustration>
          <InviteIllustration />
        </template>
        <BaseButton size="sm" :block="false" @click="inviting = true">{{ $t('clients.invite') }}</BaseButton>
      </EmptyState>
    </div>

    <template v-else-if="loaded">
      <ul v-if="people.clients.length" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="c in people.clients" :key="c.id">
          <PersonCard :person="c" />
        </li>
      </ul>

      <PendingInvitations v-if="people.invitations.length" :invitations="people.invitations" :revoke="people.revokeInvitation" />
    </template>

    <InviteModal v-if="inviting" @close="inviting = false" />
  </DashboardLayout>
</template>
