<script setup lang="ts">
/**
 * Who is on a task, as one multi-select. The author stays picked. The client's
 * side can swap the freelancer for another one who can take the task, or take
 * them off a project's task (outside a project a task keeps one). The
 * freelancer doesn't hand their task to someone else. The rest are the
 * client's team: a contractor sees a task only once they're on it.
 */
import { computed, ref, watch } from 'vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import { useAuthStore } from '@/stores/auth'
import { addTaskParticipant, assignTaskFreelancer, fetchTaskPeople, removeTaskParticipant } from '@/services/taskPeople'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Task, TaskPerson } from '@/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  /** Who is on the task changed: it needs loading again. */
  changed: []
}>()

const auth = useAuthStore()

const people = ref<TaskPerson[]>([])
/** Who is picked, kept here so quick clicks don't wait for the server. */
const picked = ref<string[]>([])

const authorId = computed(() => props.task.created_by)
const freelancerIds = computed(() => new Set(people.value.filter((p) => p.role === 'freelancer').map((p) => p.id)))

async function loadPeople() {
  try {
    people.value = props.task.client ? await fetchTaskPeople(props.task.id) : []
  } catch {
    people.value = []
  }
  // A personal task is its owner's alone; only they see it, in their own role.
  if (!props.task.client && props.task.freelancer) {
    people.value = [{ ...props.task.freelancer, role: auth.isClient ? 'owner' : 'freelancer', on_task: true }]
  }
  const ids = new Set(people.value.filter((p) => p.on_task || p.id === authorId.value).map((p) => p.id))
  ids.add(authorId.value)
  picked.value = people.value.map((p) => p.id).filter((id) => ids.has(id))
}
watch(() => [props.task.id, props.task.freelancer?.id, props.task.client?.id, props.task.participants.length], loadPeople, { immediate: true })

const canChange = computed(
  () =>
    !props.task.archived_at &&
    (!auth.isContractor || props.task.created_by === auth.user?.id || props.task.freelancer?.id === auth.user?.id),
)

function personLabel(p: { id: string; name: string; email: string; role: TaskPerson['role'] }): string {
  const name = p.id === auth.user?.id ? `${p.name || p.email} (${t('common.you')})` : p.name || p.email
  return `${name} · ${t(`taskPeople.roles.${p.role}`)}`
}

/** Whether the viewer picks the task's freelancer: the client's side does. */
const picksFreelancer = computed(() => auth.isClient)
const assigneeId = computed(() => props.task.freelancer?.id ?? '')

const options = computed(() =>
  people.value
    .filter((p) => picksFreelancer.value || p.role !== 'freelancer' || p.id === assigneeId.value)
    .map((p) => ({ value: p.id, label: personLabel(p) })),
)
/** Who can't be taken off here: the author, and the freelancer when they can't be. */
const locked = computed(() => {
  const keep = [authorId.value]
  if (assigneeId.value && (!picksFreelancer.value || !props.task.project)) keep.push(assigneeId.value)
  return keep
})
const onTask = computed(() => people.value.filter((p) => picked.value.includes(p.id)))

async function update(next: string[]) {
  const withAuthor = [...new Set([authorId.value, ...next])]
  const before = picked.value
  const beforeAssignee = props.task.freelancer?.id ?? ''
  const checked = withAuthor.filter((id) => freelancerIds.value.has(id))
  const addedAssignee = checked.find((id) => id !== beforeAssignee && !before.includes(id))
  let assignee = beforeAssignee
  if (addedAssignee) assignee = addedAssignee
  else if (beforeAssignee && !withAuthor.includes(beforeAssignee)) assignee = ''

  const nextPicked = withAuthor.filter((id) => !freelancerIds.value.has(id) || id === assignee || id === authorId.value)
  if (assignee && people.value.some((p) => p.id === assignee) && !nextPicked.includes(assignee)) nextPicked.push(assignee)
  if (nextPicked.length === before.length && nextPicked.every((id) => before.includes(id)) && assignee === beforeAssignee) return
  picked.value = people.value.map((p) => p.id).filter((id) => nextPicked.includes(id))

  const team = (ids: string[]) => ids.filter((id) => !freelancerIds.value.has(id) && id !== authorId.value)
  const added = team(nextPicked).filter((id) => !before.includes(id))
  const removed = team(before).filter((id) => !nextPicked.includes(id))
  try {
    if (assignee !== beforeAssignee) await assignTaskFreelancer(props.task.id, assignee)
    for (const id of added) await addTaskParticipant(props.task.id, id)
    for (const id of removed) await removeTaskParticipant(props.task.id, id)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('taskPeople.failed'))
  }
  emit('changed')
}
</script>

<template>
  <dt class="text-neutral-500">{{ $t('taskPeople.title') }}</dt>
  <dd class="min-w-0">
    <MultiSelectInput
      v-if="canChange"
      :model-value="picked"
      :label="$t('taskPeople.title')"
      hide-label
      size="sm"
      :options="options"
      :locked="locked"
      :placeholder="$t('taskPeople.nobody')"
      @update:model-value="update"
    />
    <template v-else>
      <p v-for="p in onTask" :key="p.id" class="truncate text-neutral-800">{{ personLabel(p) }}</p>
      <span v-if="!onTask.length" class="text-neutral-400">{{ $t('taskPeople.nobody') }}</span>
    </template>
  </dd>
</template>
