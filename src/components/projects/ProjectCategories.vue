<script setup lang="ts">
/**
 * The project's categories. The author names them and decides what their tasks
 * count as, and who may move a card into them.
 */
import { onMounted, ref, watch } from 'vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useBoardStore } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { columnName } from '@/constants/tasks'
import { t } from '@/i18n'
import { toast } from '@/composables/useToasts'
import type { BoardCategory, CategoryInput } from '@/types/board'

const props = defineProps<{ projectId: string }>()

const board = useBoardStore()

const effects = [
  { value: 'open', label: t('categories.open') },
  { value: 'done', label: t('categories.done') },
  { value: 'closed', label: t('categories.closed') },
]

type Draft = CategoryInput

const edits = ref<Record<string, Draft>>({})
const draft = ref<Draft>({ name: '', effect: 'open', participants_can_move: true, allows_delete: false })
const adding = ref(false)
const savingId = ref<string | null>(null)
const removing = ref<BoardCategory | null>(null)
const removeBusy = ref(false)

watch(
  () => board.categories,
  (cats) => {
    const next: Record<string, Draft> = {}
    for (const c of cats) {
      next[c.id] =
        savingId.value === c.id && edits.value[c.id]
          ? edits.value[c.id]
          : { name: c.name, effect: c.effect, participants_can_move: c.participants_can_move, allows_delete: c.allows_delete }
    }
    edits.value = next
  },
  { immediate: true, deep: true },
)

async function load() {
  try {
    await board.fetchBoard({ project: props.projectId })
  } catch {
    toast.error(t('categories.loadFailed'))
  }
}

onMounted(() => void load())
watch(() => props.projectId, () => void load())

function payload(input: Draft): Draft {
  return {
    name: input.name.trim(),
    effect: input.effect,
    participants_can_move: input.participants_can_move,
    allows_delete: input.effect === 'open' && input.allows_delete,
  }
}

function fail(error: unknown) {
  toast.error(error instanceof ApiRequestError ? error.message : t('categories.saveFailed'))
}

async function add() {
  const input = payload(draft.value)
  if (!input.name || adding.value) return
  adding.value = true
  try {
    await board.createCategory(input)
    draft.value = { name: '', effect: 'open', participants_can_move: true, allows_delete: false }
  } catch (error) {
    fail(error)
  } finally {
    adding.value = false
  }
}

async function save(id: string) {
  const input = edits.value[id]
  if (!input || !payload(input).name || savingId.value) return
  savingId.value = id
  try {
    await board.updateCategory(id, payload(input))
  } catch (error) {
    fail(error)
  } finally {
    savingId.value = null
  }
}

function menu(cat: BoardCategory): MenuAction[] {
  return [
    { label: t('common.save'), onSelect: () => void save(cat.id) },
    { label: t('board.delete'), danger: true, onSelect: () => (removing.value = cat) },
  ]
}

async function remove() {
  const cat = removing.value
  if (!cat) return
  removeBusy.value = true
  try {
    await board.deleteCategory(cat.id)
    removing.value = null
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('categories.deleteFailed'))
  } finally {
    removeBusy.value = false
  }
}
</script>

<template>
  <p class="text-sm text-neutral-500">{{ $t('categories.intro') }}</p>
  <ul class="mt-4 grid gap-3">
    <li v-for="cat in board.categories" :key="cat.id" class="rounded-lg border border-neutral-200 p-3">
      <template v-if="edits[cat.id]">
        <div class="flex items-end gap-2">
          <BaseInput v-model="edits[cat.id].name" :label="$t('categories.name')" class="min-w-0 flex-1" />
          <BaseSelect v-model="edits[cat.id].effect" :label="$t('categories.effect')" :options="effects" class="min-w-0 flex-1" />
          <ActionMenu :actions="menu(cat)" :label="$t('categories.options')" size="md" />
        </div>
        <div class="mt-3 grid gap-x-8 gap-y-2 border-t border-neutral-200 pt-3 sm:grid-cols-2">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm text-neutral-700">{{ $t('categories.participants') }}</span>
            <ToggleSwitch v-model="edits[cat.id].participants_can_move" :label="$t('categories.participants')" />
          </div>
          <div v-if="edits[cat.id].effect === 'open'" class="flex items-center justify-between gap-3">
            <span class="text-sm text-neutral-700">{{ $t('categories.allowsDelete') }}</span>
            <ToggleSwitch v-model="edits[cat.id].allows_delete" :label="$t('categories.allowsDelete')" />
          </div>
        </div>
      </template>
    </li>
  </ul>

  <form class="mt-4 border-t border-neutral-200 pt-4" @submit.prevent="add">
    <div class="flex items-end gap-2">
      <BaseInput v-model="draft.name" :label="$t('categories.new')" :placeholder="$t('categories.namePlaceholder')" class="min-w-0 flex-1" />
      <BaseSelect v-model="draft.effect" :label="$t('categories.effect')" :options="effects" class="min-w-0 flex-1" />
      <BaseButton type="submit" size="sm" :block="false" class="h-[38px]" :loading="adding" :disabled="!draft.name.trim() || adding">
        {{ $t('categories.add') }}
      </BaseButton>
    </div>
    <div class="mt-3 grid gap-x-8 gap-y-2 border-t border-neutral-200 pt-3 sm:grid-cols-2">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-neutral-700">{{ $t('categories.participants') }}</span>
        <ToggleSwitch v-model="draft.participants_can_move" :label="$t('categories.participants')" />
      </div>
      <div v-if="draft.effect === 'open'" class="flex items-center justify-between gap-3">
        <span class="text-sm text-neutral-700">{{ $t('categories.allowsDelete') }}</span>
        <ToggleSwitch v-model="draft.allows_delete" :label="$t('categories.allowsDelete')" />
      </div>
    </div>
  </form>

  <ConfirmDialog
    :open="!!removing"
    :title="$t('categories.confirmDelete', { name: removing ? columnName(removing.name) : '' })"
    :description="$t('categories.confirmDeleteText')"
    :loading="removeBusy"
    @update:open="removing = null"
    @confirm="remove"
  />
</template>
