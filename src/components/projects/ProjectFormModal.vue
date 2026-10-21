<script setup lang="ts">
import { computed } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useForm } from '@/composables/useForm'
import { LIMITS, optionalText, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { Project, ProjectInput } from '@/types/projects'
import type { Link } from '@/types/people'

const props = defineProps<{
  /** Edit this project; without it the modal creates a new one. */
  project?: Project
  /** Who the project can be with: a client's freelancers or a freelancer's clients. */
  people?: Link[]
}>()

const emit = defineEmits<{
  close: []
  saved: [project: Project]
}>()

const auth = useAuthStore()
const projects = useProjectsStore()
const isEdit = computed(() => !!props.project)
/** A client starts a project with one or more freelancers; a freelancer's empty choice is a personal project. */
const schema = z.object({
  freelancer_ids:
    !isEdit.value && auth.isClient
      ? z.array(z.string()).min(1, { error: () => t('validation.chooseFreelancer') })
      : z.array(z.string()),
  person_id: z.string(),
  name: requiredText('thingName', LIMITS.projectName),
  description: optionalText('description', LIMITS.projectDescription),
})
const form = useForm(
  schema,
  {
    freelancer_ids: auth.isClient && props.people?.length === 1 ? [props.people[0].id] : [],
    person_id: '',
    name: props.project?.name ?? '',
    description: props.project?.description ?? '',
  },
  { serverFields: { freelancer_id: 'freelancer_ids', freelancer_ids: 'freelancer_ids', client_id: 'person_id' } },
)

/** A client can only start a project with a freelancer they work with. */
const nobody = computed(() => !isEdit.value && auth.isClient && !props.people?.length)
const personOptions = computed(() => [
  ...(auth.isFreelancer ? [{ value: '', label: t('projectForm.personalOption') }] : []),
  ...(props.people ?? []).map((p) => ({ value: p.id, label: p.name || p.email })),
])

function submit() {
  void form.submit(async (data) => {
    const input: ProjectInput = { name: data.name, description: data.description }
    const project = props.project
      ? await projects.updateProject(props.project.id, input)
      : await projects.createProject(
          auth.isClient
            ? { ...input, freelancer_ids: data.freelancer_ids }
            : data.person_id
              ? { ...input, client_id: data.person_id }
              : input,
        )
    emit('saved', project)
  })
}
</script>

<template>
  <Modal :title="isEdit ? $t('projectForm.edit') : $t('projectForm.new')" @close="emit('close')">
    <div v-if="nobody" class="space-y-2 text-sm text-neutral-600">
      <p>{{ $t('projectForm.nobody') }}</p>
      <p>{{ $t('projectForm.askInvite') }}</p>
    </div>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="form.formError" />
      <MultiSelectInput
        v-if="!isEdit && auth.isClient && (people?.length ?? 0) > 1"
        v-bind="form.field('freelancer_ids')"
        :label="$t('projectForm.freelancer')"
        :placeholder="$t('validation.chooseFreelancer')"
        :options="personOptions"
      />
      <BaseSelect
        v-else-if="!isEdit && auth.isFreelancer && personOptions.length > 1"
        v-bind="form.field('person_id')"
        :label="$t('projectForm.client')"
        :options="personOptions"
      />
      <BaseInput v-bind="form.field('name')" :label="$t('projectForm.name')" :placeholder="$t('projectForm.namePlaceholder')" />
      <BaseTextarea
        v-bind="form.field('description')"
        :label="$t('projectForm.description')"
        :placeholder="$t('projectForm.descriptionPlaceholder')"
        :rows="4"
      />
    </form>

    <template v-if="nobody" #footer>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
    </template>
    <template v-else #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ isEdit ? $t('common.save') : $t('projectForm.create') }}
      </BaseButton>
    </template>
  </Modal>
</template>
