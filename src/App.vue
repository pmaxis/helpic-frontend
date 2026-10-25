<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ui/ToastHost.vue'
import CookieNotice from '@/components/ui/CookieNotice.vue'
</script>

<template>
  <RouterView />
  <ToastHost />
  <CookieNotice />
</template>
