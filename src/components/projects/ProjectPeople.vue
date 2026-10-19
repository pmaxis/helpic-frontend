<script setup lang="ts">
/**
 * Who is on a project. The author invites a freelancer, a client, an employee
 * or a contractor from here; that invitation is what lets them see the project.
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { inviteToProject, fetchProjectPeople, removeProjectParticipant } from '@/services/projectPeople'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { ProjectPerson } from '@/types/projects'

const props = defineProps<{
  projectId: string
  /** The author's id; they stay, and only they invite and remove. */
  authorId: string
  canInvite: boolean
  /** A personal project has no client, so there is nobody else to invite. */
  personal: boolean
}>()

const emit = defineEmits<{
  loaded: [count: number]
}>()

const participants = ref<ProjectPerson[]>([])
const candidates = ref<ProjectPerson[]>([])
const personIds = ref<string[]>([])
const sending = ref(false)
const removing = ref<ProjectPerson | null>(null)
const removeBusy = ref(false)

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

async function load() {
  try {
    const people = await fetchProjectPeople(props.projectId)
    participants.value = people.participants
    candidates.value = people.candidates
    personIds.value = personIds.value.filter((id) => people.candidates.some((p) => p.id === id))
    emit('loaded', people.participants.length)
  } catch {
    participants.value = []
    candidates.value = []
    emit('loaded', 0)
  }
}
watch(() => props.projectId, load, { immediate: true })

const options = computed(() =>
  candidates.value.map((p) => ({
    value: p.id,
    label: `${p.name || p.email} · ${t(`project.roles.${p.role}`)}`,
  })),
)

async function send() {
  if (!personIds.value.length) return
  sending.value = true
  try {
    const people = await inviteToProject(props.projectId, personIds.value)
    participants.value = people.participants
    candidates.value = people.candidates
    personIds.value = []
    emit('loaded', people.participants.length)
    toast.success(t('project.invited'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('project.inviteFailed'))
  } finally {
    sending.value = false
  }
}

async function remove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    const people = await removeProjectParticipant(props.projectId, removing.value.id)
    participants.value = people.participants
    candidates.value = people.candidates
    personIds.value = []
    emit('loaded', people.participants.length)
    toast.success(t('project.removed'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('project.removeFailed'))
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}
</script>

<template>
  <section class="rounded-xl border border-neutral-200 p-5">
    <h2 class="text-sm font-semibold text-neutral-900">{{ canInvite ? $t('project.inviteTitle') : $t('project.participants') }}</h2>
    <p class="mt-1 text-sm text-neutral-500">
      {{ personal ? $t('project.personalPeople') : $t('project.inviteText') }}
    </p>
    <form v-if="canInvite && candidates.length" class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="send">
      <MultiSelectInput
        v-model="personIds"
        :label="$t('project.person')"
        :placeholder="$t('project.choosePeople')"
        :options="options"
        class="min-w-56 flex-1"
      />
      <BaseButton type="submit" :block="false" class="h-[38px]" :loading="sending" :disabled="!personIds.length || sending">
        {{ $t('project.invite') }}
      </BaseButton>
    </form>
    <p v-else-if="canInvite && !personal" class="mt-3 text-sm text-neutral-500">{{ $t('project.nobodyToInvite') }}</p>
  </section>

  <ul class="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
    <li v-for="p in participants" :key="p.id" class="flex items-center gap-3 bg-white px-4 py-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700"
        aria-hidden="true"
      >
        {{ initials(p.name || p.email) }}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-neutral-900">
          {{ p.name || p.email }}
          <span v-if="p.id === authorId" class="ml-1.5 font-normal text-neutral-400">{{ $t('project.author') }}</span>
        </p>
        <p class="truncate text-sm text-neutral-500">
          <template v-if="p.name">{{ p.email }} · </template>{{ $t(`project.roles.${p.role}`) }}
        </p>
      </div>
      <BaseButton
        v-if="canInvite && p.id !== authorId"
        type="button"
        variant="ghost"
        size="sm"
        :block="false"
        @click="removing = p"
      >
        {{ $t('common.remove') }}
      </BaseButton>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!removing"
    :title="$t('project.confirmRemove', { name: removing?.name || removing?.email || '' })"
    :description="$t('project.confirmRemoveText')"
    :confirm-label="$t('common.remove')"
    :loading="removeBusy"
    @update:open="(v) => { if (!v) removing = null }"
    @confirm="remove"
  />
</template>
