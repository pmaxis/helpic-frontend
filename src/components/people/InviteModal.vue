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
import { useForm } from '@/composables/useForm'
import { email, LIMITS, requiredText } from '@/utils/validation'

const emit = defineEmits<{ close: [] }>()

const people = usePeopleStore()
const form = useForm(z.object({ name: requiredText('Name', LIMITS.name), email: email() }), { name: '', email: '' })
/** Set once the invitation exists: the modal then shows its link. */
const link = ref('')

function submit() {
  void form.submit(async (data) => {
    const inv = await people.invite(data)
    link.value = invitationLink(inv.token)
  })
}

async function copy() {
  if (await copyText(link.value)) toast.success('Link copied')
  else toast.error('Could not copy — select the link and copy it manually')
}
</script>

<template>
  <Modal title="Invite a client" @close="emit('close')">
    <div v-if="link" class="space-y-3">
      <p class="text-sm text-neutral-600">
        Send this link to <span class="font-medium text-neutral-900">{{ form.values.email.trim() }}</span>. It works once and
        expires in 14 days.
      </p>
      <input
        :value="link"
        readonly
        class="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <form v-else id="invite-form" class="space-y-4" novalidate @submit.prevent="submit">
      <p class="text-sm text-neutral-500">
        You'll get a link to send to your client. They set a password and can then give you tasks.
      </p>
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('name')" label="Client name" placeholder="Acme Inc. or Jane Doe" />
      <BaseInput v-bind="form.field('email')" label="Client email" type="email" placeholder="client@example.com" />
    </form>

    <template #footer>
      <template v-if="link">
        <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">Done</BaseButton>
        <BaseButton size="sm" :block="false" @click="copy">Copy link</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">Cancel</BaseButton>
        <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
          Create invitation
        </BaseButton>
      </template>
    </template>
  </Modal>
</template>
