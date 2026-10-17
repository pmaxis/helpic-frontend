<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { invitationLink, usePeopleStore } from '@/stores/people'
import { copyText } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import { useForm } from '@/composables/useForm'
import { email, LIMITS, requiredText } from '@/utils/validation'

const emit = defineEmits<{ close: [] }>()

const people = usePeopleStore()
const form = useForm(z.object({ name: requiredText('name', LIMITS.name), email: email() }), { name: '', email: '' })
/** Set once the invitation exists: the modal then shows its link. */
const link = ref('')

function submit() {
  void form.submit(async (data) => {
    const inv = await people.invite(data)
    link.value = invitationLink(inv.token)
  })
}

async function copy() {
  if (await copyText(link.value)) toast.success(t('clients.linkCopied'))
  else toast.error(t('errors.copyFailed'))
}
</script>

<template>
  <Modal :title="$t('inviteModal.title')" @close="emit('close')">
    <div v-if="link" class="space-y-3">
      <i18n-t keypath="inviteModal.emailed" tag="p" class="text-sm text-neutral-600" scope="global">
        <template #email>
          <span class="font-medium text-neutral-900">{{ form.values.email.trim() }}</span>
        </template>
      </i18n-t>
      <input
        :value="link"
        readonly
        class="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <form v-else id="invite-form" class="space-y-4" novalidate @submit.prevent="submit">
      <p class="text-sm text-neutral-500">
        {{ $t('inviteModal.intro') }}
      </p>
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('name')" :label="$t('inviteModal.name')" :placeholder="$t('inviteModal.namePlaceholder')" />
      <BaseInput v-bind="form.field('email')" :label="$t('inviteModal.email')" type="email" :placeholder="$t('inviteModal.emailPlaceholder')" />
    </form>

    <template #footer>
      <template v-if="link">
        <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">{{ $t('common.done') }}</BaseButton>
        <BaseButton size="sm" :block="false" @click="copy">{{ $t('common.copyLink') }}</BaseButton>
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
