<template>
  <!-- All quiet: a log sheet with only calm lines on it, and a check that nothing went wrong. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- a sheet behind -->
    <rect x="50" y="20" width="72" height="80" rx="6" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" />

    <!-- the log -->
    <rect x="38" y="12" width="72" height="84" rx="6" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <rect x="48" y="24" width="8" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="60" y="24" width="38" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="48" y="34" width="8" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="60" y="34" width="30" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="48" y="44" width="8" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="60" y="44" width="34" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="48" y="54" width="8" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="60" y="54" width="24" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="48" y="64" width="8" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="60" y="64" width="32" height="3" rx="1.5" class="fill-neutral-200" />

    <!-- nothing went wrong -->
    <circle cx="108" cy="80" r="14" class="fill-emerald-50 stroke-emerald-600" stroke-width="1.6" />
    <path d="m102 80 4 4 8-8.5" class="stroke-emerald-600" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
