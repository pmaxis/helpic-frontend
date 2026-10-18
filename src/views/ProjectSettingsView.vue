<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormError from '@/components/auth/FormError.vue'
import ProjectPeople from '@/components/projects/ProjectPeople.vue'
import { useProjectsStore } from '@/stores/projects'
import { useForm } from '@/composables/useForm'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import { LIMITS, optionalText, requiredText } from '@/utils/validation'
import type { Project } from '@/types/projects'

const projects = useProjectsStore()
const route = useRoute()
const router = useRouter()

const TABS = [{ value: 'info' }, { value: 'people' }] as const
type Tab = (typeof TABS)[number]['value']

/** The open tab lives in the URL (?tab=people) so it can be linked to. */
const tab = computed<Tab>({
  get: () => TABS.find((item) => item.value === route.query.tab)?.value ?? 'info',
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'info' ? undefined : value } }),
})

const id = computed(() => String(route.params.id))
const project = ref<Project | null>(null)
const notFound = ref(false)
const peopleCount = ref(0)
const confirmDelete = ref(false)
const deleting = ref(false)

const schema = z.object({
  name: requiredText('thingName', LIMITS.projectName),
  description: optionalText('description', LIMITS.projectDescription),
})
const form = useForm(schema, { name: '', description: '' })

async function load() {
  notFound.value = false
  peopleCount.value = 0
  try {
    const loaded = await projects.fetchProject(id.value)
    if (!loaded.can_edit) {
      await router.replace({ name: 'project-detail', params: { id: loaded.id } })
      return
    }
    project.value = loaded
    form.reset({ name: loaded.name, description: loaded.description })
  } catch (error) {
    project.value = null
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(t('project.loadFailed'))
  }
}

watch(id, () => void load(), { immediate: true })

function save() {
  const current = project.value
  if (!current) return
  void form.submit(async (data) => {
    project.value = await projects.updateProject(current.id, { name: data.name, description: data.description })
    toast.success(t('project.saved'))
  })
}

async function remove() {
  deleting.value = true
  try {
    await projects.deleteProject(id.value)
    toast.success(t('project.deleted'))
    await router.replace('/projects')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('project.deleteFailed'))
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}
</script>

<template>
  <DashboardLayout>
    <nav class="flex items-center gap-1.5 self-start text-sm text-neutral-500" :aria-label="$t('project.breadcrumb')">
      <RouterLink
        :to="{ name: 'project-detail', params: { id } }"
        class="-ml-1.5 mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        :aria-label="$t('project.backToProject')"
        :title="$t('project.backToProject')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </RouterLink>
      <RouterLink to="/projects" class="hover:text-neutral-900">{{ $t('projects.title') }}</RouterLink>
      <template v-if="project">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-neutral-300" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <RouterLink :to="{ name: 'project-detail', params: { id: project.id } }" class="truncate hover:text-neutral-900">{{ project.name }}</RouterLink>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-neutral-300" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span class="text-neutral-700">{{ $t('project.settings') }}</span>
      </template>
    </nav>

    <div v-if="notFound" class="mt-6">
      <EmptyState :title="$t('project.notFound')" :description="$t('project.notFoundText')" />
    </div>

    <template v-else-if="project">
      <PageHeader class="mt-3" :title="$t('project.settingsTitle')" :description="project.name">
        <template #actions>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-red-50 hover:text-red-600"
            :aria-label="$t('project.delete')"
            :title="$t('project.delete')"
            @click="confirmDelete = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        </template>
      </PageHeader>

      <nav class="mt-5 flex gap-6 border-b border-neutral-200" :aria-label="$t('project.sections')">
        <button
          v-for="item in TABS"
          :key="item.value"
          type="button"
          class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
          :class="tab === item.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
          :aria-current="tab === item.value ? 'page' : undefined"
          @click="tab = item.value"
        >
          {{ $t(`project.tabs.${item.value}`) }}<span v-if="item.value === 'people' && peopleCount" class="ml-1.5 font-normal text-neutral-400">{{ peopleCount }}</span>
        </button>
      </nav>

      <div class="mt-6">
        <section v-show="tab === 'info'" class="rounded-xl border border-neutral-200 p-5">
          <form class="space-y-4" novalidate @submit.prevent="save">
            <FormError :message="form.formError" />
            <BaseInput v-bind="form.field('name')" :label="$t('projectForm.name')" :placeholder="$t('projectForm.namePlaceholder')" />
            <BaseTextarea
              v-bind="form.field('description')"
              :label="$t('projectForm.description')"
              :placeholder="$t('projectForm.descriptionPlaceholder')"
              :rows="4"
            />
            <div class="flex justify-end">
              <BaseButton type="submit" size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting">{{ $t('common.save') }}</BaseButton>
            </div>
          </form>
        </section>

        <div v-show="tab === 'people'">
          <ProjectPeople
            :key="project.id"
            :project-id="project.id"
            :author-id="project.created_by"
            :can-invite="!!project.client"
            :personal="!project.client"
            @loaded="peopleCount = $event"
          />
        </div>
      </div>
    </template>

    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="$t('project.confirmDelete')"
      :description="$t('project.confirmDeleteText')"
      :loading="deleting"
      @confirm="remove"
    />
  </DashboardLayout>
</template>
