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

function pickLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void sendLogo(file)
}

// Dropped onto the logo's box. A counter, since dragleave fires on children.
const dragDepth = ref(0)

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
}

function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value++
}

function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value = 0
  const file = e.dataTransfer?.files[0]
  if (file && !uploading.value && !removing.value) void sendLogo(file)
}

async function sendLogo(file: File) {
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
        <template #below>
          <div class="relative" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
            <div v-if="logo" class="flex flex-col gap-4 rounded-xl border border-neutral-200 p-3 sm:flex-row sm:items-center">
              <!-- a report is white paper, in the dark theme too -->
              <div class="light-palette flex h-24 items-center justify-center rounded-lg border border-neutral-200 bg-white px-6 sm:w-56 sm:shrink-0">
                <img :src="logo" :alt="$t('settings.reports.logoAlt')" class="max-h-16 max-w-full object-contain" />
              </div>
              <p class="min-w-0 flex-1 text-sm text-neutral-500">{{ $t('settings.reports.logoOnReports') }}</p>
              <div class="grid grid-flow-col [grid-auto-columns:1fr] gap-2 sm:w-fit">
                <BaseButton variant="ghost" size="sm" :block="false" :loading="uploading" :disabled="uploading || removing" @click="fileInput?.click()">
                  {{ $t('settings.reports.replaceLogo') }}
                </BaseButton>
                <BaseButton variant="ghost" size="sm" :block="false" :loading="removing" :disabled="uploading || removing" @click="dropLogo">
                  {{ $t('settings.reports.removeLogo') }}
                </BaseButton>
              </div>
            </div>
            <button
              v-else
              type="button"
              class="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:pointer-events-none"
              :disabled="uploading"
              @click="fileInput?.click()"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500" aria-hidden="true">
                <svg v-if="uploading" viewBox="0 0 24 24" fill="none" class="h-5 w-5 animate-spin">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".25" stroke-width="2.5" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </svg>
              </span>
              <span class="text-sm text-neutral-600">
                <template v-if="uploading">{{ $t('settings.reports.logoUploading') }}</template>
                <template v-else>
                  <span class="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2">{{ $t('settings.reports.uploadLogo') }}</span>
                  {{ $t('settings.reports.logoOrDrop') }}
                </template>
              </span>
              <span class="text-xs text-neutral-400">{{ $t('settings.reports.logoLimits') }}</span>
            </button>

            <!-- shown while a file is dragged over the box -->
            <div
              v-if="dragDepth > 0"
              class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-900 bg-white/90 text-sm font-medium text-neutral-900"
              aria-hidden="true"
            >
              {{ logo ? $t('settings.reports.logoDropToReplace') : $t('settings.reports.logoDrop') }}
            </div>
          </div>
          <p v-if="logoError" class="mt-2 text-sm text-neutral-600" role="alert">{{ logoError }}</p>
          <input ref="fileInput" type="file" class="sr-only" :accept="LOGO_TYPES.join(',')" tabindex="-1" aria-hidden="true" @change="pickLogo" />
        </template>
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
