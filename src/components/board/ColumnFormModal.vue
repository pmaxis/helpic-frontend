<script setup lang="ts">
import { reactive, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useBoardStore } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { STATUS_LABELS } from '@/constants/tasks'
import type { BoardColumn } from '@/types/board'
import type { TaskStatus } from '@/types/tasks'

const props = defineProps<{
  /** Edit this column; without it the modal adds a new one. */
  column?: BoardColumn
}>()

const emit = defineEmits<{ close: [] }>()

const board = useBoardStore()
const form = reactive({ name: props.column?.name ?? '', category: (props.column?.category ?? 'in_progress') as TaskStatus })
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

const statusOptions = (Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))

async function submit() {
  fieldErrors.name = form.name.trim() ? '' : 'Name is required'
  formError.value = ''
  if (fieldErrors.name) return
  saving.value = true
  try {
    const input = { name: form.name.trim(), category: form.category }
    if (props.column) await board.updateColumn(props.column.id, input)
    else await board.createColumn(input)
    emit('close')
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
  <Modal :title="column ? 'Edit column' : 'New column'" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="formError" />
      <BaseInput v-model="form.name" label="Name" placeholder="Review" :error="fieldErrors.name" required />
      <BaseSelect
        :model-value="form.category"
        label="Category"
        :options="statusOptions"
        :error="fieldErrors.category"
        @update:model-value="form.category = $event as TaskStatus"
      />
      <p class="text-sm text-neutral-500">
        Tasks in this column get the status “{{ form.name.trim() || 'this column' }}” and count as {{ STATUS_LABELS[form.category] }}
        — that decides who may move them here and whether they count as open.
      </p>
    </form>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="emit('close')">Cancel</BaseButton>
      <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving" @click="submit">
        {{ column ? 'Save' : 'Add column' }}
      </BaseButton>
    </template>
  </Modal>
</template>
