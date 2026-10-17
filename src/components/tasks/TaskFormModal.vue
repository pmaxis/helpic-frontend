<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { z } from 'zod'
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
import { priceInput } from '@/utils/money'
import { useForm } from '@/composables/useForm'
import { choice, LIMITS, optionalText, price, requiredText } from '@/utils/validation'
import { priorityOptions as priorityChoices } from '@/constants/tasks'
import { t } from '@/i18n'
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
/** What picking the other side asks for. */
const choosePerson = () => (auth.isClient ? t('validation.chooseFreelancer') : t('validation.chooseClient'))

/** A new task from a client goes to a freelancer, unless its project says who. */
const needsPerson = !isEdit.value && auth.isClient && !props.projectId

const schema = z.object({
  // A client must pick a freelancer; a freelancer's empty choice means a
  // personal task.
  person_id: needsPerson ? choice(choosePerson) : z.string(),
  project_id: z.string(),
  title: requiredText('title', LIMITS.taskTitle),
  description: optionalText('description', LIMITS.taskDescription),
  due_on: z.string(),
  price: price(),
  // Always set: the select has no empty option.
  priority: z.string(),
})
const form = useForm(
  schema,
  {
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
    priority: props.task?.priority ?? 'none',
  },
  { serverFields: { [personField]: 'person_id' } },
)
const priorityOptions = computed(() => priorityChoices())

/** The freelancer prices the task: on create, or on edit when it's theirs to price. */
const showPrice = computed(() => (props.task ? props.task.can_set_price : auth.isFreelancer))
const priceCurrency = computed(() => props.task?.currency ?? auth.user?.currency ?? 'USD')

onMounted(() => {
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
})

/** The project the task is being created in, when the caller fixed it. */
const fixedProject = computed(() => (props.projectId ? projects.projects.find((p) => p.id === props.projectId) : undefined))

/** A client can only create a task for a freelancer they work with. */
const nobody = computed(() => !isEdit.value && !props.projectId && auth.isClient && !props.people?.length)
const personOptions = computed(() => [
  ...(auth.isFreelancer ? [{ value: '', label: t('taskForm.personalOption') }] : []),
  ...(props.people ?? []).map((p) => ({ value: p.id, label: p.name || p.email })),
])

/** The other side of the task: the edited task's, or the one picked in the form ('' = personal). */
const pairOther = computed(() => {
  if (props.task) return (auth.isClient ? props.task.freelancer.id : props.task.client?.id) ?? ''
  return form.values.person_id
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
  () => form.values.person_id,
  () => {
    const p = projects.projects.find((x) => x.id === form.values.project_id)
    if (p && !sharesPair(p)) form.values.project_id = ''
  },
)

function submit() {
  void form.submit(async (data) => {
    const priority = data.priority as TaskPriority
    const input: TaskInput = { title: data.title, description: data.description, due_on: data.due_on || null }
    let task: Task
    if (props.task) {
      task = await tasks.updateTask(props.task.id, { ...input, project_id: data.project_id })
      // The price has its own endpoint: the freelancer may set it whoever made the task.
      if (showPrice.value && data.price !== priceInput(props.task.price_cents)) task = await tasks.setPrice(task.id, data.price || null)
      // So has the priority: either side sets it, in any status.
      if (priority !== props.task.priority) task = await tasks.setPriority(task.id, priority)
    } else {
      const create: TaskInput = { ...input, status_id: props.statusId, priority }
      if (showPrice.value && data.price) create.price = data.price
      if (data.project_id) create.project_id = data.project_id
      else if (data.person_id) create[personField] = data.person_id
      task = await tasks.createTask(create)
    }
    emit('saved', task)
  })
}
</script>

<template>
  <Modal
    :title="isEdit ? $t('taskForm.edit') : columnName ? $t('taskForm.newIn', { column: columnName }) : $t('taskForm.new')"
    size="lg"
    @close="emit('close')"
  >
    <div v-if="nobody" class="space-y-2 text-sm text-neutral-600">
      <p>{{ $t('taskForm.nobody') }}</p>
      <p>{{ $t('taskForm.askInvite') }}</p>
    </div>
    <form v-else id="task-form" class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="form.formError" />

      <p v-if="fixedProject" class="text-sm text-neutral-500">
        {{ $t('taskForm.in') }} <span class="font-medium text-neutral-900">{{ fixedProject.name }}</span>
        <template v-if="auth.isClient"> · {{ $t('taskForm.with', { name: fixedProject.freelancer.name || fixedProject.freelancer.email }) }}</template>
        <template v-else-if="fixedProject.client"> · {{ $t('taskForm.for', { name: fixedProject.client.name || fixedProject.client.email }) }}</template>
        <template v-else> · {{ $t('taskForm.personalSuffix') }}</template>
      </p>
      <template v-else>
        <BaseSelect
          v-if="!isEdit && !statusId && personOptions.length > 1"
          v-bind="form.field('person_id')"
          :label="auth.isClient ? $t('taskForm.freelancer') : $t('taskForm.client')"
          :placeholder="auth.isClient ? choosePerson() : undefined"
          :options="personOptions"
        />
        <BaseSelect v-if="projectOptions.length > 1" v-bind="form.field('project_id')" :label="$t('taskForm.project')" :options="projectOptions" />
        <p v-if="!isEdit && auth.isFreelancer && !form.values.person_id" class="text-sm text-neutral-500">
          {{ $t('taskForm.personalNote') }}
        </p>
      </template>

      <BaseInput v-bind="form.field('title')" :label="$t('task.titleLabel')" :placeholder="$t('taskForm.titlePlaceholder')" />
      <BaseTextarea v-bind="form.field('description')" :label="$t('task.description')" :placeholder="$t('task.descriptionPlaceholder')" :rows="6" />
      <div class="grid gap-4" :class="showPrice ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
        <DateInput v-bind="form.field('due_on')" :label="$t('taskForm.dueDate')" :placeholder="$t('taskForm.noDueDate')" />
        <BaseSelect v-bind="form.field('priority')" :label="$t('taskForm.priority')" :options="priorityOptions" />
        <BaseInput
          v-if="showPrice"
          v-bind="form.field('price')"
          :label="$t('taskForm.price', { currency: priceCurrency })"
          :placeholder="$t('taskForm.noPrice')"
        />
      </div>
    </form>

    <template v-if="nobody" #footer>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
    </template>
    <template v-else #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ isEdit ? $t('common.save') : $t('taskForm.create') }}
      </BaseButton>
    </template>
  </Modal>
</template>
