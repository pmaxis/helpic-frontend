<script setup lang="ts">
/**
 * A client's company and its people. The owner (the client a freelancer
 * invited) names it, invites members by link and removes them; members work
 * with the company's freelancers but don't see its reports. A member sees
 * whose team they're on.
 */
import { computed, onMounted, ref } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormError from '@/components/auth/FormError.vue'
import { fetchTeam, inviteToTeam, removeTeamMember, renameTeam, revokeTeamInvite, teamInviteLink } from '@/services/team'
import { copyText, formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { email, LIMITS, optionalText } from '@/utils/validation'
import type { Team, TeamInvite, TeamMember } from '@/types/team'

const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'company', label: 'Company' },
  { value: 'invite', label: 'Invite' },
  { value: 'members', label: 'Members' },
] as const
type Tab = (typeof TABS)[number]['value']

/** The open tab lives in the URL (?tab=invite), like on the settings page. */
const tab = computed<Tab>({
  get: () => TABS.find((t) => t.value === route.query.tab)?.value ?? 'company',
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'company' ? undefined : value } }),
})

const team = ref<Team | null>(null)
const loadError = ref('')

async function load() {
  try {
    team.value = await fetchTeam()
    nameForm.reset({ name: team.value.name })
  } catch {
    loadError.value = 'Could not load the team.'
  }
}
onMounted(load)

const isOwner = computed(() => team.value?.role === 'owner')

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

// --- the company's name --------------------------------------------------------------

const nameForm = useForm(z.object({ name: optionalText('The name', LIMITS.companyName) }), { name: '' })
const nameDirty = computed(() => !!team.value && nameForm.values.name.trim() !== team.value.name)

function saveName() {
  if (!nameDirty.value) return
  void nameForm.submit(async (data) => {
    team.value = await renameTeam(data.name)
    nameForm.reset({ name: team.value.name })
    toast.success('Company name saved')
  })
}

// --- inviting -------------------------------------------------------------------------

const inviteForm = useForm(z.object({ email: email(), name: optionalText('Name', LIMITS.name) }), { email: '', name: '' })
/** The link of the invitation just made, shown to copy. */
const freshLink = ref('')

function invite() {
  void inviteForm.submit(async (data) => {
    const inv = await inviteToTeam(data.email, data.name)
    team.value?.invites?.unshift(inv)
    freshLink.value = teamInviteLink(inv.token)
    inviteForm.reset()
    void copy(freshLink.value)
  })
}

async function copy(link: string) {
  if (await copyText(link)) toast.success('Invitation link copied')
  else toast.error('Could not copy the link')
}

// --- revoking and removing -------------------------------------------------------------

const revoking = ref<TeamInvite | null>(null)
const removing = ref<TeamMember | null>(null)
const busy = ref(false)

async function revoke() {
  const inv = revoking.value
  if (!inv || !team.value) return
  busy.value = true
  try {
    await revokeTeamInvite(inv.id)
    team.value.invites = team.value.invites?.filter((i) => i.id !== inv.id)
    if (freshLink.value.endsWith(inv.token)) freshLink.value = ''
    toast.success('Invitation revoked')
  } catch {
    toast.error('Could not revoke the invitation')
  } finally {
    busy.value = false
    revoking.value = null
  }
}

async function remove() {
  const m = removing.value
  if (!m || !team.value) return
  busy.value = true
  try {
    await removeTeamMember(m.id)
    team.value.members = team.value.members?.filter((x) => x.id !== m.id)
    toast.success(`${m.name || m.email} is off the team`)
  } catch {
    toast.error('Could not remove the member')
  } finally {
    busy.value = false
    removing.value = null
  }
}
</script>

<template>
  <DashboardLayout>
    <PageHeader title="Team" />
    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <!-- a member: whose team this is -->
    <section v-else-if="team && !isOwner" class="mt-6 rounded-xl border border-neutral-200 p-5">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
          {{ initials(team.name || team.owner.name || team.owner.email) }}
        </span>
        <div class="min-w-0">
          <p class="truncate font-medium text-neutral-900">{{ team.name || `${team.owner.name || team.owner.email}'s team` }}</p>
          <p class="truncate text-sm text-neutral-500">Run by {{ team.owner.name || team.owner.email }}</p>
        </div>
      </div>
      <p class="mt-4 text-sm text-neutral-600">
        You work for this company: you see its freelancers, projects and tasks, and set tasks for its freelancers. Its reports
        stay with {{ team.owner.name || team.owner.email }}.
      </p>
    </section>

    <!-- the owner: the company, its invitations and its people, as tabs -->
    <template v-else-if="team">
      <nav class="mt-5 flex gap-6 border-b border-neutral-200" aria-label="Team sections">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
          :class="tab === t.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
          :aria-current="tab === t.value ? 'page' : undefined"
          @click="tab = t.value"
        >
          {{ t.label }}<span v-if="t.value === 'invite' && team.invites?.length" class="ml-1.5 font-normal text-neutral-400">{{ team.invites.length }}</span><span v-if="t.value === 'members' && team.members?.length" class="ml-1.5 font-normal text-neutral-400">{{ team.members.length }}</span>
        </button>
      </nav>

      <div class="mt-6 space-y-4">
        <!-- company -->
        <section v-if="tab === 'company'" class="rounded-xl border border-neutral-200 p-5">
          <p class="text-sm text-neutral-500">
            Bring in your employees and contractors. They see the work with your freelancers and can set tasks; the reports stay yours.
          </p>
          <form class="mt-4 flex flex-wrap items-start gap-3" novalidate @submit.prevent="saveName">
            <BaseInput v-bind="nameForm.field('name')" label="Company name" placeholder="e.g. Acme Inc" class="min-w-56 flex-1" />
            <BaseButton type="submit" :block="false" class="mt-[26px] h-[38px]" :loading="nameForm.submitting" :disabled="!nameDirty">Save</BaseButton>
          </form>
          <FormError class="mt-3" :message="nameForm.formError" />
        </section>

        <!-- invite -->
        <template v-else-if="tab === 'invite'">
          <section class="rounded-xl border border-neutral-200 p-5">
            <p class="text-sm text-neutral-500">They get a link, set a password and join with a new account.</p>
            <form class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start" novalidate @submit.prevent="invite">
              <BaseInput v-bind="inviteForm.field('email')" label="Email" type="email" placeholder="name@company.com" />
              <BaseInput v-bind="inviteForm.field('name')" label="Name" placeholder="Pre-fills their sign-up" />
              <BaseButton type="submit" :block="false" class="h-[38px] sm:mt-[26px]" :loading="inviteForm.submitting">Invite</BaseButton>
            </form>
            <FormError class="mt-3" :message="inviteForm.formError" />
            <div v-if="freshLink" class="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200 ring-inset">
              <span class="min-w-0 flex-1 truncate font-mono text-xs text-neutral-700">{{ freshLink }}</span>
              <BaseButton variant="ghost" size="sm" :block="false" @click="copy(freshLink)">Copy link</BaseButton>
            </div>
          </section>

          <section v-if="team.invites?.length" class="rounded-xl border border-neutral-200" aria-labelledby="team-invites">
            <h2 id="team-invites" class="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-900">Pending invitations</h2>
            <ul class="divide-y divide-neutral-100">
              <li v-for="inv in team.invites" :key="inv.id" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-neutral-900">{{ inv.name || inv.email }}</p>
                  <p class="truncate text-xs text-neutral-500">
                    {{ inv.name ? `${inv.email} · ` : '' }}{{ inv.expired ? 'Expired' : `Valid until ${formatDate(inv.expires_at)}` }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <BaseButton v-if="!inv.expired" variant="ghost" size="sm" :block="false" @click="copy(teamInviteLink(inv.token))">Copy link</BaseButton>
                  <button type="button" class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="revoking = inv">Revoke</button>
                </div>
              </li>
            </ul>
          </section>
        </template>

        <!-- members -->
        <section v-else class="rounded-xl border border-neutral-200">
          <ul class="divide-y divide-neutral-100">
            <!-- the owner first -->
            <li class="flex items-center gap-3 px-5 py-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
                {{ initials(team.owner.name || team.owner.email) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-neutral-900">{{ team.owner.name || team.owner.email }} <span class="text-neutral-400">· you</span></p>
                <p class="truncate text-xs text-neutral-500">Owner — sees the reports</p>
              </div>
            </li>
            <li v-for="m in team.members" :key="m.id" class="flex items-center gap-3 px-5 py-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                {{ initials(m.name || m.email) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-neutral-900">{{ m.name || m.email }}</p>
                <p class="truncate text-xs text-neutral-500">{{ m.email }} · joined {{ formatDate(m.joined_at) }}</p>
              </div>
              <button type="button" class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="removing = m">Remove</button>
            </li>
            <li v-if="!team.members?.length" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-neutral-400">
              No members yet.
              <button type="button" class="font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline" @click="tab = 'invite'">Invite someone</button>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <ConfirmDialog
      :open="!!revoking"
      title="Revoke this invitation?"
      description="The link stops working."
      confirm-label="Revoke"
      :loading="busy"
      @update:open="(v: boolean) => { if (!v) revoking = null }"
      @confirm="revoke"
    />
    <ConfirmDialog
      :open="!!removing"
      :title="`Remove ${removing?.name || removing?.email} from the team?`"
      description="They no longer see your freelancers, projects and tasks. The tasks they set stay."
      confirm-label="Remove"
      :loading="busy"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="remove"
    />
  </DashboardLayout>
</template>
