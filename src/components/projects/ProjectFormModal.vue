<script setup lang="ts">
import { computed } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useForm } from '@/composables/useForm'
import { choice, LIMITS, optionalText, requiredText } from '@/utils/validation'
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
const personField = auth.isClient ? 'freelancer_id' : 'client_id'

/** A client starts a project with a freelancer; a freelancer's empty choice is a personal project. */
const schema = z.object({
  person_id: !isEdit.value && auth.isClient ? choice(() => t('validation.chooseFreelancer')) : z.string(),
  name: requiredText('thingName', LIMITS.projectName),
  description: optionalText('description', LIMITS.projectDescription),
})
const form = useForm(
  schema,
  {
    person_id: auth.isClient && props.people?.length === 1 ? props.people[0].id : '',
    name: props.project?.name ?? '',
    description: props.project?.description ?? '',
  },
  { serverFields: { [personField]: 'person_id' } },
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
      : await projects.createProject(data.person_id ? { ...input, [personField]: data.person_id } : input)
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
      <BaseSelect
        v-if="!isEdit && personOptions.length > 1"
        v-bind="form.field('person_id')"
        :label="auth.isClient ? $t('projectForm.freelancer') : $t('projectForm.client')"
        :placeholder="auth.isClient ? $t('validation.chooseFreelancer') : undefined"
        :options="personOptions"
      />
      <p v-if="!isEdit && auth.isFreelancer && !form.values.person_id" class="text-sm text-neutral-500">
        {{ $t('projectForm.personalNote') }}
      </p>
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
