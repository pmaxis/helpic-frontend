<script setup lang="ts">
import { computed } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useBoardStore } from '@/stores/board'
import { useForm } from '@/composables/useForm'
import { LIMITS, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { BoardColumn, StatusCategory } from '@/types/board'

const props = defineProps<{
  /** Edit this column; without it the modal adds a new one. */
  column?: BoardColumn
}>()

const emit = defineEmits<{ close: [] }>()

const board = useBoardStore()
const schema = z.object({
  name: requiredText('thingName', LIMITS.columnName),
  status_category: z.string().min(1, t('columnForm.category')),
})
const form = useForm(schema, {
  name: props.column?.name ?? '',
  status_category: props.column?.status_category || 'in_progress',
})

const options = computed(() => [
  { value: 'todo', label: t('columnForm.todo') },
  { value: 'in_progress', label: t('columnForm.inProgress') },
  { value: 'done', label: t('columnForm.done') },
])

function submit() {
  void form.submit(async (data) => {
    const input = { name: data.name, status_category: data.status_category as StatusCategory }
    if (props.column) await board.updateColumn(props.column.id, input)
    else await board.createColumn(input)
    emit('close')
  })
}
</script>

<template>
  <Modal :title="column ? $t('columnForm.edit') : $t('columnForm.new')" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('name')" :label="$t('columnForm.name')" :placeholder="$t('columnForm.namePlaceholder')" />
      <BaseSelect v-bind="form.field('status_category')" :label="$t('columnForm.category')" :options="options" />
    </form>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ column ? $t('common.save') : $t('columnForm.add') }}
      </BaseButton>
    </template>
  </Modal>
</template>
