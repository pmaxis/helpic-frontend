<script setup lang="ts">
import { onMounted } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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
  <DashboardLayout>
    <PageHeader :title="$t('freelancers.title')" />

    <div v-if="people.freelancersLoaded && !people.freelancers.length" class="mt-6">
      <EmptyState :title="$t('freelancers.noneYet')" :description="$t('freelancers.noneYetText')" />
    </div>

    <ul v-else-if="people.freelancers.length" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="f in people.freelancers" :key="f.id">
        <PersonCard :person="f" />
      </li>
    </ul>
  </DashboardLayout>
</template>
