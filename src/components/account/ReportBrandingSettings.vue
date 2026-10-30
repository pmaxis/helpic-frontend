<script setup lang="ts">
/**
 * Settings › Reports: how a freelancer's reports look to their clients — a
 * logo over the title, an accent color on the rules, and business details at
 * the end. Drafts show a change at once; sent reports keep the look they
 * were sent with.
 */
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import { ApiRequestError } from '@/services/api'
import { fetchBranding, LOGO_TYPES, logoDataURL, MAX_LOGO_BYTES, removeLogo, saveBranding, uploadLogo } from '@/services/branding'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Branding } from '@/types/reports'

/** As the backend checks them. */
const MAX_DETAILS = 1000
const MAX_DETAILS_LINES = 15

/** Accents that read well on white, as rules and in print. */
const SWATCHES = ['#1d4ed8', '#0f766e', '#15803d', '#b45309', '#b91c1c', '#be185d', '#6d28d9', '#334155']

const branding = ref<Branding | null>(null)
const loadFailed = ref(false)

onMounted(async () => {
  try {
    take(await fetchBranding())
  } catch {
    loadFailed.value = true
  }
})

/** Takes the look the server answered with; the logo is fetched again only when it's a new one. */
function take(b: Branding) {
  const newLogo = b.logo_id !== branding.value?.logo_id
  branding.value = b
  resetDetails()
  if (newLogo || !logo.value) void showLogo(b.logo_id)
}

// --- logo ---------------------------------------------------------------------------

const logo = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const removing = ref(false)
const logoError = ref('')

async function showLogo(id: string | null) {
  if (!id) {
    logo.value = ''
    return
  }
  try {
    logo.value = await logoDataURL(id)
  } catch {
    logo.value = ''
  }
}

async function pickLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  logoError.value = ''
  if (!LOGO_TYPES.includes(file.type)) {
    logoError.value = t('settings.reports.logoType')
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    logoError.value = t('settings.reports.logoSize')
    return
  }
  uploading.value = true
  try {
    take(await uploadLogo(file))
    toast.success(t('settings.reports.logoSaved'))
  } catch (error) {
    logoError.value = error instanceof ApiRequestError ? (error.fields?.file ?? error.message) : t('settings.reports.logoFailed')
  } finally {
    uploading.value = false
  }
}

async function dropLogo() {
  removing.value = true
  try {
    take(await removeLogo())
    toast.success(t('settings.reports.logoRemoved'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('errors.generic'))
  } finally {
    removing.value = false
  }
}

// --- accent ------------------------------------------------------------------------

const savingColor = ref(false)

/** Saved as soon as it's picked; null goes back to plain black. */
async function saveColor(color: string | null) {
  const b = branding.value
  if (!b || color === b.color) return
  savingColor.value = true
  try {
    // The saved details go with it, so unsaved edits to them stay in the form.
    branding.value = await saveBranding({ color, details: b.details })
    toast.success(t('settings.reports.colorSaved'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? (error.fields?.color ?? error.message) : t('errors.generic'))
  } finally {
    savingColor.value = false
  }
}

// --- business details ------------------------------------------------------------------

const details = ref('')
const detailsError = ref('')
const savingDetails = ref(false)

function resetDetails() {
  details.value = branding.value?.details ?? ''
  detailsError.value = ''
}
const detailsDirty = computed(() => !!branding.value && details.value.trim() !== branding.value.details)

async function saveDetails() {
  const b = branding.value
  if (!b) return
  const text = details.value.trim()
  if (text.length > MAX_DETAILS) {
    detailsError.value = t('settings.reports.detailsTooLong')
    return
  }
  if (text.split('\n').length > MAX_DETAILS_LINES) {
    detailsError.value = t('settings.reports.detailsTooManyLines', { n: MAX_DETAILS_LINES })
    return
  }
  savingDetails.value = true
  detailsError.value = ''
  try {
    take(await saveBranding({ color: b.color, details: text }))
    toast.success(t('settings.reports.detailsSaved'))
  } catch (error) {
    if (error instanceof ApiRequestError && error.fields?.details) detailsError.value = error.fields.details
    else toast.error(error instanceof ApiRequestError ? error.message : t('errors.generic'))
  } finally {
    savingDetails.value = false
  }
}
</script>

<template>
  <SettingsGroup :title="$t('settings.reports.title')" :description="$t('settings.reports.text')">
    <p v-if="loadFailed" class="px-5 py-4 text-sm text-neutral-500">{{ $t('settings.reports.loadFailed') }}</p>
    <template v-else-if="branding">
      <SettingsRow :label="$t('settings.reports.logo')" :hint="$t('settings.reports.logoText')">
        <template #extra>
          <p v-if="logoError" class="mt-1.5 text-sm text-neutral-600" role="alert">{{ logoError }}</p>
        </template>
        <div class="flex items-center gap-3">
          <div
            class="flex h-14 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-1.5"
            :class="logo ? 'border-solid bg-white' : ''"
          >
            <img v-if="logo" :src="logo" :alt="$t('settings.reports.logoAlt')" class="max-h-full max-w-full object-contain" />
            <span v-else class="text-xs text-neutral-400">{{ $t('settings.reports.noLogo') }}</span>
          </div>
          <div class="grid gap-1.5">
            <BaseButton variant="ghost" size="sm" :block="false" :loading="uploading" :disabled="uploading || removing" @click="fileInput?.click()">
              {{ branding.logo_id ? $t('settings.reports.replaceLogo') : $t('settings.reports.uploadLogo') }}
            </BaseButton>
            <BaseButton
              v-if="branding.logo_id"
              variant="ghost"
              size="sm"
              :block="false"
              :loading="removing"
              :disabled="uploading || removing"
              @click="dropLogo"
            >
              {{ $t('settings.reports.removeLogo') }}
            </BaseButton>
          </div>
          <input ref="fileInput" type="file" class="sr-only" :accept="LOGO_TYPES.join(',')" tabindex="-1" aria-hidden="true" @change="pickLogo" />
        </div>
      </SettingsRow>

      <SettingsRow :label="$t('settings.reports.color')" :hint="$t('settings.reports.colorText')">
        <div class="flex flex-wrap items-center gap-2" :class="savingColor ? 'pointer-events-none opacity-60' : ''" role="radiogroup" :aria-label="$t('settings.reports.color')">
          <button
            type="button"
            role="radio"
            :aria-checked="branding.color === null"
            :title="$t('settings.reports.noColor')"
            :aria-label="$t('settings.reports.noColor')"
            class="h-7 w-7 rounded-full bg-neutral-900 ring-offset-2 transition-shadow"
            :class="branding.color === null ? 'ring-2 ring-neutral-900' : 'hover:ring-2 hover:ring-neutral-300'"
            @click="saveColor(null)"
          />
          <button
            v-for="c in SWATCHES"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="branding.color === c"
            :title="c"
            :aria-label="c"
            class="h-7 w-7 rounded-full ring-offset-2 transition-shadow"
            :class="branding.color === c ? 'ring-2 ring-neutral-900' : 'hover:ring-2 hover:ring-neutral-300'"
            :style="{ backgroundColor: c }"
            @click="saveColor(c)"
          />
          <label
            class="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-offset-2"
            :class="branding.color && !SWATCHES.includes(branding.color) ? 'ring-2 ring-neutral-900' : 'hover:ring-2 hover:ring-neutral-300'"
            :title="$t('settings.reports.customColor')"
            :style="{ background: branding.color && !SWATCHES.includes(branding.color) ? branding.color : 'conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }"
          >
            <span class="sr-only">{{ $t('settings.reports.customColor') }}</span>
            <input
              type="color"
              class="absolute inset-0 cursor-pointer opacity-0"
              :value="branding.color ?? '#171717'"
              @change="saveColor(($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </SettingsRow>

      <SettingsRow :label="$t('settings.reports.details')" :hint="$t('settings.reports.detailsText')">
        <template #below>
          <form class="space-y-3" novalidate @submit.prevent="saveDetails">
            <BaseTextarea
              v-model="details"
              :label="$t('settings.reports.details')"
              :placeholder="$t('settings.reports.detailsPlaceholder')"
              :rows="5"
              :error="detailsError"
            />
            <div v-if="detailsDirty || savingDetails" class="ml-auto grid grid-flow-col [grid-auto-columns:1fr] gap-2 w-fit">
              <BaseButton variant="ghost" size="sm" :block="false" :disabled="savingDetails" @click="resetDetails">{{ $t('common.cancel') }}</BaseButton>
              <BaseButton type="submit" size="sm" :block="false" :loading="savingDetails" :disabled="savingDetails">{{ $t('common.save') }}</BaseButton>
            </div>
          </form>
        </template>
      </SettingsRow>
    </template>
  </SettingsGroup>
</template>
