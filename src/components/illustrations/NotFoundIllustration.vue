<template>
  <!-- Not found: a blank, faded sheet, and a magnifier that found nothing on it. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="104" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- the sheet that isn't there any more -->
    <rect x="42" y="14" width="62" height="90" rx="4" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" stroke-dasharray="4 4" />
    <rect x="51" y="25" width="26" height="4" rx="2" class="fill-neutral-200" />
    <rect x="51" y="36" width="40" height="3" rx="1.5" class="fill-neutral-100" />
    <rect x="51" y="43" width="32" height="3" rx="1.5" class="fill-neutral-100" />

    <!-- the magnifier -->
    <path d="m111 84 14 14" class="stroke-neutral-800" stroke-width="6" stroke-linecap="round" />
    <circle cx="98" cy="70" r="19" class="fill-white stroke-neutral-800" stroke-width="3" />
    <!-- the question it's left with -->
    <path d="M92.5 65a5.5 5.5 0 1 1 8 4.9c-1.6.8-2.5 1.9-2.5 3.6" class="stroke-neutral-400" stroke-width="2.6" stroke-linecap="round" />
    <circle cx="98" cy="79" r="1.6" class="fill-neutral-400" />
  </svg>
</template>
