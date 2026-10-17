<script setup lang="ts">
import { reactive, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import { invitationLink, usePeopleStore } from '@/stores/people'
import { ApiRequestError } from '@/services/api'
import { copyText } from '@/utils/format'
import { toast } from '@/composables/useToasts'

const emit = defineEmits<{ close: [] }>()

const people = usePeopleStore()
const form = reactive({ name: '', email: '' })
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)
/** Set once the invitation exists: the modal then shows its link. */
const link = ref('')

async function submit() {
  fieldErrors.name = form.name.trim() ? '' : 'Name is required'
  fieldErrors.email = form.email.trim() ? '' : 'Email is required'
  formError.value = ''
  if (fieldErrors.name || fieldErrors.email) return

  saving.value = true
  try {
    const inv = await people.invite({ name: form.name.trim(), email: form.email.trim() })
    link.value = invitationLink(inv.token)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(fieldErrors, error.fields)
      formError.value = error.fields ? '' : error.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    saving.value = false
  }
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
        Send this link to <span class="font-medium text-neutral-900">{{ form.email.trim() }}</span>. It works once and
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
      <FormError :message="formError" />
      <BaseInput v-model="form.name" label="Client name" placeholder="Acme Inc. or Jane Doe" :error="fieldErrors.name" required />
      <BaseInput v-model="form.email" label="Client email" type="email" placeholder="client@example.com" :error="fieldErrors.email" required />
    </form>

    <template #footer>
      <template v-if="link">
        <BaseButton variant="ghost" size="sm" :block="false" @click="emit('close')">Done</BaseButton>
        <BaseButton size="sm" :block="false" @click="copy">Copy link</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="emit('close')">Cancel</BaseButton>
        <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving" @click="submit">
          Create invitation
        </BaseButton>
      </template>
    </template>
  </Modal>
</template>
