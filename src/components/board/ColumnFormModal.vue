<script setup lang="ts">
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useBoardStore } from '@/stores/board'
import { STATUSES, statusLabel } from '@/constants/tasks'
import { computed } from 'vue'
import { useForm } from '@/composables/useForm'
import { LIMITS, requiredText } from '@/utils/validation'
import type { BoardColumn } from '@/types/board'
import type { TaskStatus } from '@/types/tasks'

const props = defineProps<{
  /** Edit this column; without it the modal adds a new one. */
  column?: BoardColumn
}>()

const emit = defineEmits<{ close: [] }>()

const board = useBoardStore()
// The category is always set: the select has no empty option.
const schema = z.object({ name: requiredText('thingName', LIMITS.columnName), category: z.string() })
const form = useForm(schema, { name: props.column?.name ?? '', category: props.column?.category ?? 'in_progress' })

const statusOptions = computed(() => STATUSES.map((s) => ({ value: s, label: statusLabel(s) })))

function submit() {
  void form.submit(async (data) => {
    const input = { name: data.name, category: data.category as TaskStatus }
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
      <BaseSelect v-bind="form.field('category')" :label="$t('columnForm.category')" :options="statusOptions" />
      <p class="text-sm text-neutral-500">
        {{
          $t('columnForm.explain', {
            name: form.values.name.trim() || $t('columnForm.thisColumn'),
            category: statusLabel(form.values.category as TaskStatus),
          })
        }}
      </p>
    </form>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ column ? $t('common.save') : $t('columnForm.add') }}
      </BaseButton>
    </template>
  </Modal>
</template>
