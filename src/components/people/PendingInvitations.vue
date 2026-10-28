<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Invitation } from '@/types/people'

// The invitations someone sent that nobody accepted yet: a freelancer's for
// clients, a client's for freelancers. Each can be revoked after asking.
const props = defineProps<{
  invitations: Invitation[]
  revoke: (id: string) => Promise<void>
}>()

const revoking = ref<Invitation | null>(null)
const revokeBusy = ref(false)

async function confirmRevoke() {
  if (!revoking.value) return
  revokeBusy.value = true
  try {
    await props.revoke(revoking.value.id)
    toast.success(t('invitations.revoked'))
  } catch {
    toast.error(t('invitations.revokeFailed'))
  } finally {
    revokeBusy.value = false
    revoking.value = null
  }
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<template>
  <section class="mt-8">
    <h2 class="text-sm font-semibold text-neutral-900">
      {{ $t('invitations.pending') }}
      <span class="ml-1.5 font-normal text-neutral-400">{{ invitations.length }}</span>
    </h2>
    <ul class="mt-3 grid gap-3">
      <li
        v-for="inv in invitations"
        :key="inv.id"
        class="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 p-4"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-500 ring-1 ring-neutral-200"
          aria-hidden="true"
        >
          {{ initials(inv.name || inv.email) }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="truncate text-sm font-medium text-neutral-900">{{ inv.name || inv.email }}</p>
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="inv.expired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'"
            >
              {{ inv.expired ? $t('invitations.expired') : $t('invitations.expires', { date: formatDate(inv.expires_at) }) }}
            </span>
          </div>
          <p v-if="inv.name" class="mt-0.5 truncate text-xs text-neutral-500">{{ inv.email }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600"
          @click="revoking = inv"
        >
          {{ inv.expired ? $t('invitations.remove') : $t('invitations.revoke') }}
        </button>
      </li>
    </ul>

    <ConfirmDialog
      :open="!!revoking"
      :title="$t('invitations.confirmRevoke')"
      :description="$t('invitations.confirmRevokeText', { email: revoking?.email ?? '' })"
      :confirm-label="$t('invitations.revoke')"
      :loading="revokeBusy"
      @update:open="(v) => { if (!v) revoking = null }"
      @confirm="confirmRevoke"
    />
  </section>
</template>
