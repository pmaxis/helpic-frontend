<script setup lang="ts">
/**
 * Who from the client's side is on a task, as a row of the details list: a
 * multi-select of the client and their team. A contractor sees a task only
 * once they're on it. Anyone who sees the task may change who is on it,
 * except a contractor on a task they didn't set. The freelancer and whoever
 * set the task have rows of their own and always stay on it, so they're not
 * offered here.
 */
import { computed, ref, watch } from 'vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import { useAuthStore } from '@/stores/auth'
import { addTaskParticipant, fetchTaskPeople, removeTaskParticipant } from '@/services/taskPeople'
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

/** The client's side, minus whoever set the task. */
const people = ref<TaskPerson[]>([])
/** Who is picked, kept here so quick clicks don't wait for the server. */
const picked = ref<string[]>([])

async function loadPeople() {
  try {
    people.value = (await fetchTaskPeople(props.task.id)).filter((p) => p.id !== props.task.created_by)
  } catch {
    people.value = []
  }
  picked.value = people.value.filter((p) => p.on_task).map((p) => p.id)
}
watch(() => [props.task.id, props.task.participants.length], loadPeople, { immediate: true })

const canChange = computed(
  () => !auth.isContractor || props.task.created_by === auth.user?.id || props.task.freelancer.id === auth.user?.id,
)

const options = computed(() =>
  people.value.map((p) => ({
    value: p.id,
    label: p.id === auth.user?.id ? `${p.name || p.email} (${t('common.you')})` : `${p.name || p.email} · ${t(`taskPeople.roles.${p.role}`)}`,
  })),
)

/** The ones on the task, for a viewer who can't change them. */
const onTask = computed(() => people.value.filter((p) => picked.value.includes(p.id)))

async function update(next: string[]) {
  const before = picked.value
  picked.value = next
  const added = next.filter((id) => !before.includes(id))
  const removed = before.filter((id) => !next.includes(id))
  try {
    for (const id of added) await addTaskParticipant(props.task.id, id)
    for (const id of removed) await removeTaskParticipant(props.task.id, id)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('taskPeople.failed'))
  }
  emit('changed')
}
</script>

<template>
  <dt :class="canChange ? 'text-neutral-500' : 'self-start text-neutral-500'">{{ $t('taskPeople.title') }}</dt>
  <dd class="min-w-0">
    <MultiSelectInput
      v-if="canChange"
      :model-value="picked"
      :label="$t('taskPeople.title')"
      hide-label
      size="sm"
      :options="options"
      :placeholder="$t('taskPeople.nobody')"
      @update:model-value="update"
    />
    <template v-else>
      <p v-for="p in onTask" :key="p.id" class="truncate text-neutral-800">{{ p.name || p.email }}</p>
      <span v-if="!onTask.length" class="text-neutral-400">{{ $t('taskPeople.nobody') }}</span>
    </template>
  </dd>
</template>
