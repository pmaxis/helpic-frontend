<script setup lang="ts">
import { computed, ref } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { usePeopleStore } from '@/stores/people'
import { useForm } from '@/composables/useForm'
import { email, LIMITS, requiredText } from '@/utils/validation'

// Invites a client (a freelancer's) or a freelancer (a client's) by email.
const props = withDefaults(defineProps<{ to?: 'client' | 'freelancer' }>(), { to: 'client' })
const emit = defineEmits<{ close: [] }>()

const people = usePeopleStore()
/** The words that differ by whom the invitation is for. */
const words = computed(() => (props.to === 'freelancer' ? 'inviteModal.freelancer' : 'inviteModal'))
const form = useForm(z.object({ name: requiredText('name', LIMITS.name), email: email() }), { name: '', email: '' })
/** Set once the invitation is emailed: the modal then confirms that. */
const sent = ref(false)

function submit() {
  void form.submit(async (data) => {
    await (props.to === 'freelancer' ? people.inviteFreelancer(data) : people.invite(data))
    sent.value = true
  })
}
</script>

<template>
  <Modal :title="$t(`${words}.title`)" @close="emit('close')">
    <i18n-t v-if="sent" keypath="inviteModal.emailed" tag="p" class="text-sm text-neutral-600" scope="global">
      <template #email>
        <span class="font-medium text-neutral-900">{{ form.values.email.trim() }}</span>
      </template>
    </i18n-t>
    <form v-else id="invite-form" class="space-y-4" novalidate @submit.prevent="submit">
      <p class="text-sm text-neutral-500">
        {{ $t(`${words}.intro`) }}
      </p>
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('name')" :label="$t(`${words}.name`)" :placeholder="$t(`${words}.namePlaceholder`)" />
      <BaseInput v-bind="form.field('email')" :label="$t(`${words}.email`)" type="email" :placeholder="$t(`${words}.emailPlaceholder`)" />
    </form>

    <template #footer>
      <template v-if="sent">
        <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">{{ $t('common.done') }}</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
          {{ $t('inviteModal.create') }}
        </BaseButton>
      </template>
    </template>
  </Modal>
</template>
