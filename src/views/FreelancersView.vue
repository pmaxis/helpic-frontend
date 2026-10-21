<script setup lang="ts">
import { onMounted } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PeopleIllustration from '@/components/illustrations/PeopleIllustration.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import { usePeopleStore } from '@/stores/people'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'

const people = usePeopleStore()

onMounted(async () => {
  try {
    await people.fetchFreelancers()
  } catch {
    toast.error(t('freelancers.loadFailed'))
  }
})
</script>

<template>
  <!-- with nobody yet the page is filled, so the empty state sits in the middle -->
  <DashboardLayout :fill="people.freelancersLoaded && !people.freelancers.length">
    <PageHeader :title="$t('freelancers.title')" />

    <div v-if="people.freelancersLoaded && !people.freelancers.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState class="flex-1 justify-center" :title="$t('freelancers.noneYet')" :description="$t('freelancers.noneYetText')">
        <template #illustration>
          <PeopleIllustration />
        </template>
      </EmptyState>
    </div>

    <ul v-else-if="people.freelancers.length" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="f in people.freelancers" :key="f.id">
        <PersonCard :person="f" />
      </li>
    </ul>
  </DashboardLayout>
</template>
