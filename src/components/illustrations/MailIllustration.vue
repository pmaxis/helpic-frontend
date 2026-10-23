<template>
  <!-- An empty outbox: a sealed envelope that went out, and a check that nothing is stuck. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- an envelope behind -->
    <rect x="52" y="24" width="72" height="50" rx="6" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" />

    <!-- the envelope -->
    <rect x="36" y="36" width="80" height="56" rx="6" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <path d="m38 40 38 27 38-27" class="stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />
    <path d="m38 90 27-20M114 90 87 70" class="stroke-neutral-200" stroke-width="1.5" stroke-linecap="round" />

    <!-- nothing is stuck -->
    <circle cx="114" cy="86" r="14" class="fill-emerald-50 stroke-emerald-600" stroke-width="1.6" />
    <path d="m108 86 4 4 8-8.5" class="stroke-emerald-600" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
