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
  person_id: !isEdit.value && auth.isClient ? choice('Choose a freelancer') : z.string(),
  name: requiredText('Name', LIMITS.projectName),
  description: optionalText('Description', LIMITS.projectDescription),
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
  ...(auth.isFreelancer ? [{ value: '', label: 'Personal — no client' }] : []),
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
  <Modal :title="isEdit ? 'Edit project' : 'New project'" @close="emit('close')">
    <div v-if="nobody" class="space-y-2 text-sm text-neutral-600">
      <p>Projects are shared with a freelancer you work with, and you don't have one yet.</p>
      <p>Ask your freelancer to send you an invitation link.</p>
    </div>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="form.formError" />
      <BaseSelect
        v-if="!isEdit && personOptions.length > 1"
        v-bind="form.field('person_id')"
        :label="auth.isClient ? 'Freelancer' : 'Client'"
        :placeholder="auth.isClient ? 'Choose a freelancer' : undefined"
        :options="personOptions"
      />
      <p v-if="!isEdit && auth.isFreelancer && !form.values.person_id" class="text-sm text-neutral-500">
        A personal project — only you see it.
      </p>
      <BaseInput v-bind="form.field('name')" label="Name" placeholder="Website redesign" />
      <BaseTextarea v-bind="form.field('description')" label="Description" placeholder="Goals, scope, links…" :rows="4" />
    </form>

    <template v-if="nobody" #footer>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">Close</BaseButton>
    </template>
    <template v-else #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">Cancel</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ isEdit ? 'Save' : 'Create project' }}
      </BaseButton>
    </template>
  </Modal>
</template>
