<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { ApiRequestError } from '@/services/api'
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

const form = reactive({
  person_id: auth.isClient && props.people?.length === 1 ? props.people[0].id : '',
  name: props.project?.name ?? '',
  description: props.project?.description ?? '',
})
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

/** A client can only start a project with a freelancer they work with. */
const nobody = computed(() => !isEdit.value && auth.isClient && !props.people?.length)
const personOptions = computed(() => [
  ...(auth.isFreelancer ? [{ value: '', label: 'Personal — no client' }] : []),
  ...(props.people ?? []).map((p) => ({ value: p.id, label: p.name || p.email })),
])

async function submit() {
  for (const k of Object.keys(fieldErrors)) fieldErrors[k] = ''
  formError.value = ''
  if (!isEdit.value && auth.isClient && !form.person_id) fieldErrors[personField] = 'Choose a freelancer'
  if (!form.name.trim()) fieldErrors.name = 'Name is required'
  if (fieldErrors[personField] || fieldErrors.name) return

  const input: ProjectInput = { name: form.name.trim(), description: form.description.trim() }
  saving.value = true
  try {
    const project = props.project
      ? await projects.updateProject(props.project.id, input)
      : await projects.createProject(form.person_id ? { ...input, [personField]: form.person_id } : input)
    emit('saved', project)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(fieldErrors, error.fields)
      formError.value = error.fields ? '' : error.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :title="isEdit ? 'Edit project' : 'New project'" @close="emit('close')">
    <div v-if="nobody" class="space-y-2 text-sm text-neutral-600">
      <p>Projects are shared with a freelancer you work with, and you don't have one yet.</p>
      <p>Ask your freelancer to send you an invitation link.</p>
    </div>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="formError" />
      <BaseSelect
        v-if="!isEdit && personOptions.length > 1"
        v-model="form.person_id"
        :label="auth.isClient ? 'Freelancer' : 'Client'"
        :placeholder="auth.isClient ? 'Choose a freelancer' : undefined"
        :options="personOptions"
        :error="fieldErrors[personField]"
      />
      <p v-if="!isEdit && auth.isFreelancer && !form.person_id" class="text-sm text-neutral-500">
        A personal project — only you see it.
      </p>
      <BaseInput v-model="form.name" label="Name" placeholder="Website redesign" :error="fieldErrors.name" required />
      <BaseTextarea v-model="form.description" label="Description" placeholder="Goals, scope, links…" :rows="4" :error="fieldErrors.description" />
    </form>

    <template v-if="nobody" #footer>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">Close</BaseButton>
    </template>
    <template v-else #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="emit('close')">Cancel</BaseButton>
      <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving" @click="submit">
        {{ isEdit ? 'Save' : 'Create project' }}
      </BaseButton>
    </template>
  </Modal>
</template>
