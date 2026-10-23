<template>
  <!-- A timeline with nothing on it yet: empty steps along a line, and a clock waiting. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- the card -->
    <rect x="38" y="14" width="80" height="88" rx="6" class="fill-white stroke-neutral-300" stroke-width="1.5" />

    <!-- the line and its empty steps -->
    <path d="M54 30v56" class="stroke-neutral-200" stroke-width="2" stroke-linecap="round" />
    <circle cx="54" cy="32" r="4.5" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <rect x="64" y="27" width="34" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="64" y="33" width="24" height="3" rx="1.5" class="fill-neutral-200" />
    <circle cx="54" cy="58" r="4.5" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <rect x="64" y="53" width="28" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="64" y="59" width="36" height="3" rx="1.5" class="fill-neutral-200" />
    <circle cx="54" cy="84" r="4.5" class="fill-white stroke-neutral-300" stroke-dasharray="2.5 2" stroke-width="1.5" />
    <rect x="64" y="79" width="22" height="3" rx="1.5" class="fill-neutral-200" />

    <!-- the clock -->
    <circle cx="116" cy="24" r="14" class="fill-emerald-50 stroke-emerald-600" stroke-width="1.6" />
    <path d="M116 16.5V24l5 3" class="stroke-emerald-600" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
