<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PeopleIllustration from '@/components/illustrations/PeopleIllustration.vue'
import InviteModal from '@/components/people/InviteModal.vue'
import PendingInvitations from '@/components/people/PendingInvitations.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'

const auth = useAuthStore()
const people = usePeopleStore()
const loaded = ref(false)
const inviting = ref(false)

// The company's owner chooses its freelancers: only they invite, and see the invitations.
onMounted(async () => {
  try {
    await Promise.all([people.fetchFreelancers(), auth.isTeamOwner ? people.fetchFreelancerInvitations() : undefined])
  } catch {
    toast.error(t('freelancers.loadFailed'))
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <!-- with nobody yet the page is filled, so the empty state sits in the middle -->
  <DashboardLayout :fill="loaded && !people.freelancers.length && !people.freelancerInvitations.length">
    <PageHeader :title="$t('freelancers.title')">
      <template v-if="auth.isTeamOwner" #actions>
        <BaseButton size="sm" :block="false" @click="inviting = true">{{ $t('freelancers.invite') }}</BaseButton>
      </template>
    </PageHeader>

    <div v-if="loaded && !people.freelancers.length && !people.freelancerInvitations.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState
        class="flex-1 justify-center"
        :title="$t('freelancers.noneYet')"
        :description="auth.isTeamOwner ? $t('freelancers.noneYetText') : $t('freelancers.noneYetMember')"
      >
        <template #illustration>
          <PeopleIllustration />
        </template>
        <BaseButton v-if="auth.isTeamOwner" size="sm" :block="false" @click="inviting = true">{{ $t('freelancers.invite') }}</BaseButton>
      </EmptyState>
    </div>

    <template v-else-if="loaded">
      <ul v-if="people.freelancers.length" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="f in people.freelancers" :key="f.id">
          <PersonCard :person="f" />
        </li>
      </ul>

      <PendingInvitations
        v-if="people.freelancerInvitations.length"
        :invitations="people.freelancerInvitations"
        :revoke="people.revokeFreelancerInvitation"
      />
    </template>

    <InviteModal v-if="inviting" to="freelancer" @close="inviting = false" />
  </DashboardLayout>
</template>
