<template>
  <!-- Two-factor sign-in: a phone showing a six-digit code, and a shield that waits for it. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- the phone -->
    <rect x="46" y="10" width="50" height="92" rx="8" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <rect x="64" y="16" width="14" height="3" rx="1.5" class="fill-neutral-200" />
    <!-- its code -->
    <rect x="53" y="44" width="36" height="18" rx="4" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" />
    <circle cx="59" cy="53" r="2" class="fill-neutral-400" />
    <circle cx="65" cy="53" r="2" class="fill-neutral-400" />
    <circle cx="71" cy="53" r="2" class="fill-neutral-400" />
    <circle cx="77" cy="53" r="2" class="fill-neutral-300" />
    <circle cx="83" cy="53" r="2" class="fill-neutral-300" />
    <rect x="58" y="70" width="26" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="62" y="92" width="18" height="3" rx="1.5" class="fill-neutral-200" />

    <!-- the shield -->
    <path d="M112 30l18 6v12c0 12-8 19-18 23-10-4-18-11-18-23V36z" class="fill-emerald-50 stroke-emerald-600" stroke-width="1.6" stroke-linejoin="round" />
    <rect x="105" y="46" width="14" height="11" rx="2" class="fill-white stroke-emerald-600" stroke-width="1.5" />
    <path d="M108 46v-3a4 4 0 0 1 8 0v3" class="stroke-emerald-600" stroke-width="1.5" stroke-linecap="round" />
  </svg>
</template>
