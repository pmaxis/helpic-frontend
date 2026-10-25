<script setup lang="ts">
/** A policy's text laid out: headings (each an anchor), paragraphs and lists, never HTML. */
import { computed } from 'vue'
import { parsePolicy, sectionId } from '@/utils/policyText'

const props = defineProps<{ body: string }>()

/** The blocks, each heading with its anchor. */
const blocks = computed(() => {
  let n = 0
  return parsePolicy(props.body).map((b) => ({ ...b, id: b.kind === 'heading' ? sectionId(++n) : undefined }))
})
</script>

<template>
  <div class="space-y-4 text-[15px] leading-7 text-neutral-700">
    <template v-for="(b, i) in blocks" :key="i">
      <h2 v-if="b.kind === 'heading'" :id="b.id" class="scroll-mt-24 pt-6 text-xl font-semibold tracking-tight text-neutral-900 first:pt-0">{{ b.text }}</h2>
      <ul v-else-if="b.kind === 'list'" class="list-disc space-y-2 pl-5 marker:text-neutral-400">
        <li v-for="(item, j) in b.items" :key="j" class="pl-1">{{ item }}</li>
      </ul>
      <p v-else>{{ b.text }}</p>
    </template>
  </div>
</template>
