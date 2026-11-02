<script setup lang="ts">
/** A form's field of formatted text: a label, the WYSIWYG editor (Markdown) and an error. */
import { computed, defineAsyncComponent, ref, useId } from 'vue'
import type RichTextEditorType from '@/components/ui/RichTextEditor.vue'
// The editor is big: it loads the first time it's opened.
const RichTextEditor = defineAsyncComponent(() => import('@/components/ui/RichTextEditor.vue'))

withDefaults(
  defineProps<{
    modelValue: string
    label: string
    placeholder?: string
    rows?: number
    error?: string
    required?: boolean
  }>(),
  { rows: 4 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const fieldId = useId()
const labelId = computed(() => `${fieldId}-label`)
const errorId = computed(() => `${fieldId}-error`)
const editor = ref<InstanceType<typeof RichTextEditorType> | null>(null)
</script>

<template>
  <div>
    <!-- a <label> can't point at an editable box: it's named by id, and a click on it focuses the box -->
    <span :id="labelId" class="block text-sm font-medium text-neutral-700" @click="editor?.focus()">
      {{ label }}<template v-if="required"><span class="ml-0.5 text-red-500" aria-hidden="true">*</span><span class="sr-only"> {{ $t('ui.required') }}</span></template>
    </span>
    <RichTextEditor
      :id="fieldId"
      ref="editor"
      class="mt-1.5"
      :model-value="modelValue"
      :labelledby="labelId"
      :placeholder="placeholder"
      :rows="rows"
      :invalid="!!error"
      :describedby="error ? errorId : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>
  </div>
</template>
