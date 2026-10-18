<script setup lang="ts">
/**
 * A client's company and its people. The owner (the client a freelancer
 * invited) names it, invites people by email as members or contractors,
 * changes their role and removes them. Both work with the company's
 * freelancers but don't see its reports; a contractor sees only the tasks
 * they set or were added to. Someone on the team sees whose team it is.
 */
import { computed, onMounted, ref } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormError from '@/components/auth/FormError.vue'
import { fetchTeam, inviteToTeam, removeTeamMember, renameTeam, revokeTeamInvite, setTeamMemberRole } from '@/services/team'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { email, LIMITS, optionalText } from '@/utils/validation'
import { t } from '@/i18n'
import { TEAM_ROLES, type Team, type TeamInvite, type TeamMember, type TeamRole } from '@/types/team'

const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'company' },
  { value: 'invite' },
  { value: 'members' },
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
    loadError.value = t('team.loadFailed')
  }
}
onMounted(load)

const isOwner = computed(() => team.value?.role === 'owner')

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

// --- the company's name --------------------------------------------------------------

const nameForm = useForm(z.object({ name: optionalText('companyName', LIMITS.companyName) }), { name: '' })
const nameDirty = computed(() => !!team.value && nameForm.values.name.trim() !== team.value.name)

function saveName() {
  if (!nameDirty.value) return
  void nameForm.submit(async (data) => {
    team.value = await renameTeam(data.name)
    nameForm.reset({ name: team.value.name })
    toast.success(t('team.nameSaved'))
  })
}

// --- inviting -------------------------------------------------------------------------

const inviteForm = useForm(z.object({ email: email(), name: optionalText('name', LIMITS.name), role: z.enum(TEAM_ROLES) }), {
  email: '',
  name: '',
  role: 'member' as TeamRole,
})
const roleOptions = computed(() => TEAM_ROLES.map((r) => ({ value: r, label: t(`team.roles.${r}`) })))

function invite() {
  void inviteForm.submit(async (data) => {
    const inv = await inviteToTeam(data.email, data.name, data.role)
    team.value?.invites?.unshift(inv)
    inviteForm.reset()
    toast.success(t('team.emailed', { email: inv.email }))
  })
}

// --- roles ------------------------------------------------------------------------------

/** The member whose role is being saved, to dim their row meanwhile. */
const savingRole = ref('')

async function changeRole(m: TeamMember, role: string) {
  if (role === m.role || !TEAM_ROLES.includes(role as TeamRole)) return
  savingRole.value = m.id
  try {
    team.value = await setTeamMemberRole(m.id, role as TeamRole)
    toast.success(t('team.roleChanged', { name: m.name || m.email, role: t(`team.roles.${role}`).toLowerCase() }))
  } catch {
    toast.error(t('team.roleFailed'))
  } finally {
    savingRole.value = ''
  }
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
    toast.success(t('team.revoked'))
  } catch {
    toast.error(t('team.revokeFailed'))
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
    toast.success(t('team.removed', { name: m.name || m.email }))
  } catch {
    toast.error(t('team.removeFailed'))
  } finally {
    busy.value = false
    removing.value = null
  }
}
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('team.title')" />
    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <!-- a member: whose team this is -->
    <section v-else-if="team && !isOwner" class="mt-6 rounded-xl border border-neutral-200 p-5">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
          {{ initials(team.name || team.owner.name || team.owner.email) }}
        </span>
        <div class="min-w-0">
          <p class="truncate font-medium text-neutral-900">{{ team.name || $t('joinTeam.teamOf', { name: team.owner.name || team.owner.email }) }}</p>
          <p class="truncate text-sm text-neutral-500">{{ $t('team.runBy', { name: team.owner.name || team.owner.email }) }}</p>
        </div>
      </div>
      <p class="mt-4 text-sm text-neutral-600">
        {{ $t(team.role === 'contractor' ? 'team.contractorText' : 'team.memberText', { name: team.owner.name || team.owner.email }) }}
      </p>
    </section>

    <!-- the owner: the company, its invitations and its people, as tabs -->
    <template v-else-if="team">
      <nav class="mt-5 flex gap-6 border-b border-neutral-200" :aria-label="$t('team.sections')">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
          :class="tab === t.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
          :aria-current="tab === t.value ? 'page' : undefined"
          @click="tab = t.value"
        >
          {{ $t(`team.tabs.${t.value}`) }}<span v-if="t.value === 'invite' && team.invites?.length" class="ml-1.5 font-normal text-neutral-400">{{ team.invites.length }}</span><span v-if="t.value === 'members' && team.members?.length" class="ml-1.5 font-normal text-neutral-400">{{ team.members.length }}</span>
        </button>
      </nav>

      <div class="mt-6 space-y-4">
        <!-- company -->
        <section v-if="tab === 'company'" class="rounded-xl border border-neutral-200 p-5">
          <form class="flex flex-wrap items-start gap-3" novalidate @submit.prevent="saveName">
            <BaseInput v-bind="nameForm.field('name')" :label="$t('team.companyName')" :placeholder="$t('team.companyPlaceholder')" class="min-w-56 flex-1" />
            <BaseButton type="submit" :block="false" class="mt-[26px] h-[38px]" :loading="nameForm.submitting" :disabled="!nameDirty">{{ $t('common.save') }}</BaseButton>
          </form>
          <FormError class="mt-3" :message="nameForm.formError" />
        </section>

        <!-- invite -->
        <template v-else-if="tab === 'invite'">
          <section class="rounded-xl border border-neutral-200 p-5">
            <form
              class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_auto] lg:items-start"
              novalidate
              @submit.prevent="invite"
            >
              <BaseInput v-bind="inviteForm.field('email')" :label="$t('team.email')" type="email" :placeholder="$t('team.emailPlaceholder')" />
              <BaseInput v-bind="inviteForm.field('name')" :label="$t('team.name')" :placeholder="$t('team.namePlaceholder')" />
              <BaseSelect
                :model-value="inviteForm.values.role"
                :label="$t('team.role')"
                :options="roleOptions"
                @update:model-value="inviteForm.values.role = $event as TeamRole"
              />
              <BaseButton type="submit" :block="false" class="h-[38px] sm:mt-[26px]" :loading="inviteForm.submitting">{{ $t('team.invite') }}</BaseButton>
            </form>
            <FormError class="mt-3" :message="inviteForm.formError" />
          </section>

          <section v-if="team.invites?.length" class="rounded-xl border border-neutral-200" aria-labelledby="team-invites">
            <h2 id="team-invites" class="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-900">{{ $t('team.pending') }}</h2>
            <ul class="divide-y divide-neutral-100">
              <li v-for="inv in team.invites" :key="inv.id" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-neutral-900">{{ inv.name || inv.email }}</p>
                  <p class="truncate text-xs text-neutral-500">
                    {{ inv.name ? `${inv.email} · ` : '' }}{{ $t('team.asRole', { role: $t(`team.roles.${inv.role}`).toLowerCase() }) }} ·
                    {{ inv.expired ? $t('team.expired') : $t('team.validUntil', { date: formatDate(inv.expires_at) }) }}
                  </p>
                </div>
                <button type="button" class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="revoking = inv">{{ $t('team.revoke') }}</button>
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
                <p class="truncate text-sm text-neutral-900">{{ team.owner.name || team.owner.email }} <span class="text-neutral-400">· {{ $t('common.you') }}</span></p>
                <p class="truncate text-xs text-neutral-500">{{ $t('team.owner') }}</p>
              </div>
            </li>
            <li
              v-for="m in team.members"
              :key="m.id"
              class="flex flex-wrap items-center gap-3 px-5 py-3 transition-opacity"
              :class="savingRole === m.id ? 'pointer-events-none opacity-60' : ''"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                {{ initials(m.name || m.email) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-neutral-900">{{ m.name || m.email }}</p>
                <p class="truncate text-xs text-neutral-500">{{ $t('team.joined', { email: m.email, date: formatDate(m.joined_at) }) }}</p>
              </div>
              <SelectInput
                class="w-40"
                :model-value="m.role"
                :options="roleOptions"
                :aria-label="$t('team.roleFor', { name: m.name || m.email })"
                :title="$t(`team.roleHints.${m.role}`)"
                @update:model-value="changeRole(m, $event)"
              />
              <button type="button" class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="removing = m">{{ $t('team.remove') }}</button>
            </li>
            <li v-if="!team.members?.length" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-neutral-400">
              {{ $t('team.noMembers') }}
              <button type="button" class="font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline" @click="tab = 'invite'">{{ $t('team.inviteSomeone') }}</button>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <ConfirmDialog
      :open="!!revoking"
      :title="$t('team.confirmRevoke')"
      :description="$t('team.confirmRevokeText')"
      :confirm-label="$t('team.revoke')"
      :loading="busy"
      @update:open="(v: boolean) => { if (!v) revoking = null }"
      @confirm="revoke"
    />
    <ConfirmDialog
      :open="!!removing"
      :title="$t('team.confirmRemove', { name: removing?.name || removing?.email })"
      :description="$t('team.confirmRemoveText')"
      :confirm-label="$t('team.remove')"
      :loading="busy"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="remove"
    />
  </DashboardLayout>
</template>
