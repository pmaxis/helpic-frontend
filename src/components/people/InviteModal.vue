<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { usePeopleStore } from '@/stores/people'
import { useForm } from '@/composables/useForm'
import { email, LIMITS, requiredText } from '@/utils/validation'

const emit = defineEmits<{ close: [] }>()

const people = usePeopleStore()
const form = useForm(z.object({ name: requiredText('name', LIMITS.name), email: email() }), { name: '', email: '' })
/** Set once the invitation is emailed: the modal then confirms that. */
const sent = ref(false)

function submit() {
  void form.submit(async (data) => {
    await people.invite(data)
    sent.value = true
  })
}
</script>

<template>
  <Modal :title="$t('inviteModal.title')" @close="emit('close')">
    <i18n-t v-if="sent" keypath="inviteModal.emailed" tag="p" class="text-sm text-neutral-600" scope="global">
      <template #email>
        <span class="font-medium text-neutral-900">{{ form.values.email.trim() }}</span>
      </template>
    </i18n-t>
    <form v-else id="invite-form" class="space-y-4" novalidate @submit.prevent="submit">
      <p class="text-sm text-neutral-500">
        {{ $t('inviteModal.intro') }}
      </p>
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('name')" :label="$t('inviteModal.name')" :placeholder="$t('inviteModal.namePlaceholder')" />
      <BaseInput v-bind="form.field('email')" :label="$t('inviteModal.email')" type="email" :placeholder="$t('inviteModal.emailPlaceholder')" />
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
