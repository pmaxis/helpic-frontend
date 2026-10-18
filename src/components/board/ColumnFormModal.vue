<script setup lang="ts">
import { computed } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { useBoardStore } from '@/stores/board'
import { columnName } from '@/constants/tasks'
import { useForm } from '@/composables/useForm'
import { LIMITS, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { BoardColumn } from '@/types/board'

const props = defineProps<{
  /** Edit this column; without it the modal adds a new one. */
  column?: BoardColumn
}>()

const emit = defineEmits<{ close: [] }>()

const board = useBoardStore()
const fallback =
  board.categories.find((c) => c.effect === 'open' && !c.allows_delete)?.id ?? board.categories[0]?.id ?? ''
const schema = z.object({
  name: requiredText('thingName', LIMITS.columnName),
  category_id: z.string().min(1, t('columnForm.category')),
})
const form = useForm(schema, { name: props.column?.name ?? '', category_id: props.column?.category_id || fallback })

const options = computed(() => board.categories.map((c) => ({ value: c.id, label: columnName(c.name) })))
const chosen = computed(() => board.categories.find((c) => c.id === form.values.category_id))

function submit() {
  void form.submit(async (data) => {
    const input = { name: data.name, category_id: data.category_id }
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
      <BaseSelect v-bind="form.field('category_id')" :label="$t('columnForm.category')" :options="options" />
      <p v-if="chosen" class="text-sm text-neutral-500">
        {{ $t('columnForm.explain', { category: columnName(chosen.name) }) }}
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
