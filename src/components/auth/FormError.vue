<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <p
    v-if="message"
    role="alert"
    class="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
  >
    {{ message }}
  </p>
</template>
