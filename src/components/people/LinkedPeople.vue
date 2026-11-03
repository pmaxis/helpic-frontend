<script setup lang="ts">
import { computed, ref } from 'vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Link } from '@/types/people'

// The people someone works with: a freelancer's clients, a client's
// freelancers. With end, a card offers to stop working together, after
// asking, only when the backend says nothing open holds it; should that
// change meanwhile, its refusal says why.
const props = defineProps<{
  people: Link[]
  /** Whose side is listed: the confirmation words what changes for each. */
  side: 'client' | 'freelancer'
  end?: (id: string) => Promise<void>
}>()

const ending = ref<Link | null>(null)
const endBusy = ref(false)
const endingName = computed(() => (ending.value ? ending.value.name || ending.value.email : ''))

async function confirmEnd() {
  if (!ending.value || !props.end) return
  const name = endingName.value
  endBusy.value = true
  try {
    await props.end(ending.value.id)
    toast.success(t('people.ended', { name }))
  } catch (e) {
    toast.error(e instanceof ApiRequestError && e.status === 409 ? e.message : t('people.endFailed'))
  } finally {
    endBusy.value = false
    ending.value = null
  }
}
</script>

<template>
  <ul class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <li v-for="p in people" :key="p.id">
      <PersonCard :person="p">
        <template v-if="end && p.can_end" #actions>
          <ActionMenu
            :label="$t('people.options', { name: p.name || p.email })"
            variant="plain"
            :actions="[{ label: $t('people.end'), danger: true, onSelect: () => (ending = p) }]"
          />
        </template>
      </PersonCard>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!ending"
    :title="$t('people.confirmEnd', { name: endingName })"
    :description="side === 'client' ? $t('people.confirmEndClient') : $t('people.confirmEndFreelancer')"
    :confirm-label="$t('people.endConfirm')"
    :loading="endBusy"
    @update:open="(v) => { if (!v) ending = null }"
    @confirm="confirmEnd"
  />
</template>
