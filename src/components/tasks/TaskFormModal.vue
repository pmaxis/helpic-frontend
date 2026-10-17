<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import DateInput from '@/components/ui/DateInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { ApiRequestError } from '@/services/api'
import { priceInput } from '@/utils/money'
import { PRIORITIES } from '@/constants/tasks'
import type { Task, TaskInput, TaskPriority } from '@/types/tasks'
import type { Project } from '@/types/projects'
import type { Link } from '@/types/people'

const props = defineProps<{
  /** Edit this task; without it the modal creates a new one. */
  task?: Task
  /** Who the task can be for: a client's freelancers or a freelancer's clients. */
  people?: Link[]
  /** Pre-selected person when creating; "personal" picks a personal task. */
  personId?: string
  /** Create the task in this project; the project decides who it is with. */
  projectId?: string
  /** The board column the new task goes into; its board fixes who the task is with. */
  statusId?: string
  /** That column's name, shown in the title. */
  columnName?: string
}>()

const emit = defineEmits<{
  close: []
  saved: [task: Task]
}>()

const auth = useAuthStore()
const tasks = useTasksStore()
const projects = useProjectsStore()
const isEdit = computed(() => !!props.task)
/** The field naming the other side: a client picks a freelancer and vice versa. */
const personField = auth.isClient ? 'freelancer_id' : 'client_id'
const personLabel = auth.isClient ? 'freelancer' : 'client'

const form = reactive({
  // A client must pick a freelancer; a freelancer's empty choice means a
  // personal task.
  person_id:
    props.personId && props.personId !== 'personal'
      ? props.personId
      : auth.isClient && props.people?.length === 1
        ? props.people[0].id
        : '',
  project_id: props.projectId ?? props.task?.project?.id ?? '',
  title: props.task?.title ?? '',
  description: props.task?.description ?? '',
  due_on: props.task?.due_on ?? '',
  price: priceInput(props.task?.price_cents ?? null),
  priority: (props.task?.priority ?? 'none') as TaskPriority,
})
const priorityOptions = PRIORITIES.map((p) => ({ value: p.value, label: p.label }))

/** The freelancer prices the task: on create, or on edit when it's theirs to price. */
const showPrice = computed(() => (props.task ? props.task.can_set_price : auth.isFreelancer))
const priceCurrency = computed(() => props.task?.currency ?? auth.user?.currency ?? 'USD')
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

onMounted(() => {
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
})

/** The project the task is being created in, when the caller fixed it. */
const fixedProject = computed(() => (props.projectId ? projects.projects.find((p) => p.id === props.projectId) : undefined))

/** A client can only create a task for a freelancer they work with. */
const nobody = computed(() => !isEdit.value && !props.projectId && auth.isClient && !props.people?.length)
const personOptions = computed(() => [
  ...(auth.isFreelancer ? [{ value: '', label: 'Personal — no client' }] : []),
  ...(props.people ?? []).map((p) => ({ value: p.id, label: p.name || p.email })),
])

/** The other side of the task: the edited task's, or the one picked in the form ('' = personal). */
const pairOther = computed(() => {
  if (props.task) return (auth.isClient ? props.task.freelancer.id : props.task.client?.id) ?? ''
  return form.person_id
})

/** Projects with the same freelancer and client as the task. */
function sharesPair(p: Project): boolean {
  return auth.isClient ? p.freelancer.id === pairOther.value : (p.client?.id ?? '') === pairOther.value
}

const projectOptions = computed(() => [
  { value: '', label: 'No project' },
  ...projects.projects.filter(sharesPair).map((p) => ({ value: p.id, label: p.name })),
])

// Picking someone else drops a project that belongs to another pair.
watch(
  () => form.person_id,
  () => {
    const p = projects.projects.find((x) => x.id === form.project_id)
    if (p && !sharesPair(p)) form.project_id = ''
  },
)

async function submit() {
  for (const k of Object.keys(fieldErrors)) fieldErrors[k] = ''
  formError.value = ''
  const needsPerson = !isEdit.value && auth.isClient && !form.project_id
  if (needsPerson && !form.person_id) fieldErrors[personField] = `Choose a ${personLabel}`
  if (!form.title.trim()) fieldErrors.title = 'Title is required'
  if (fieldErrors[personField] || fieldErrors.title) return

  const input: TaskInput = {
    title: form.title.trim(),
    description: form.description.trim(),
    due_on: form.due_on || null,
  }
  saving.value = true
  try {
    let task: Task
    if (props.task) {
      task = await tasks.updateTask(props.task.id, { ...input, project_id: form.project_id })
      // The price has its own endpoint: the freelancer may set it whoever made the task.
      const price = form.price.trim()
      if (showPrice.value && price !== priceInput(props.task.price_cents)) task = await tasks.setPrice(task.id, price || null)
      // So has the priority: either side sets it, in any status.
      if (form.priority !== props.task.priority) task = await tasks.setPriority(task.id, form.priority)
    } else {
      const create: TaskInput = { ...input, status_id: props.statusId, priority: form.priority }
      if (showPrice.value && form.price.trim()) create.price = form.price.trim()
      if (form.project_id) create.project_id = form.project_id
      else if (form.person_id) create[personField] = form.person_id
      task = await tasks.createTask(create)
    }
    emit('saved', task)
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
  <Modal :title="isEdit ? 'Edit task' : columnName ? `New task in ${columnName}` : 'New task'" size="lg" @close="emit('close')">
    <div v-if="nobody" class="space-y-2 text-sm text-neutral-600">
      <p>Tasks go to a freelancer you work with, and you don't have one yet.</p>
      <p>Ask your freelancer to send you an invitation link.</p>
    </div>
    <form v-else id="task-form" class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="formError" />

      <p v-if="fixedProject" class="text-sm text-neutral-500">
        In <span class="font-medium text-neutral-900">{{ fixedProject.name }}</span>
        <template v-if="auth.isClient"> · with {{ fixedProject.freelancer.name || fixedProject.freelancer.email }}</template>
        <template v-else-if="fixedProject.client"> · for {{ fixedProject.client.name || fixedProject.client.email }}</template>
        <template v-else> · personal</template>
      </p>
      <template v-else>
        <BaseSelect
          v-if="!isEdit && !statusId && personOptions.length > 1"
          v-model="form.person_id"
          :label="auth.isClient ? 'Freelancer' : 'Client'"
          :placeholder="auth.isClient ? `Choose a ${personLabel}` : undefined"
          :options="personOptions"
          :error="fieldErrors[personField]"
        />
        <BaseSelect
          v-if="projectOptions.length > 1"
          v-model="form.project_id"
          label="Project"
          :options="projectOptions"
          :error="fieldErrors.project_id"
        />
        <p v-if="!isEdit && auth.isFreelancer && !form.person_id" class="text-sm text-neutral-500">
          A personal task — only you see it.
        </p>
      </template>

      <BaseInput v-model="form.title" label="Title" placeholder="What needs to be done?" :error="fieldErrors.title" required />
      <BaseTextarea
        v-model="form.description"
        label="Description"
        placeholder="Details, links, acceptance criteria…"
        :rows="6"
        :error="fieldErrors.description"
      />
      <div class="grid gap-4" :class="showPrice ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
        <DateInput v-model="form.due_on" label="Due date" placeholder="No due date" :error="fieldErrors.due_on" />
        <BaseSelect v-model="form.priority" label="Priority" :options="priorityOptions" :error="fieldErrors.priority" />
        <BaseInput
          v-if="showPrice"
          v-model="form.price"
          :label="`Price, ${priceCurrency}`"
          placeholder="No price"
          :error="fieldErrors.price"
        />
      </div>
    </form>

    <template v-if="nobody" #footer>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">Close</BaseButton>
    </template>
    <template v-else #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="emit('close')">Cancel</BaseButton>
      <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving" @click="submit">
        {{ isEdit ? 'Save' : 'Create task' }}
      </BaseButton>
    </template>
  </Modal>
</template>
