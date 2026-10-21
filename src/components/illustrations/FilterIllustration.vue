<template>
  <!-- Nothing matches: a filter funnel over an empty, dashed slot where a card would be. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- the slot nothing landed in -->
    <rect x="40" y="56" width="80" height="44" rx="5" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" stroke-dasharray="4 4" />
    <rect x="52" y="70" width="36" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="52" y="78" width="24" height="3" rx="1.5" class="fill-neutral-200" />

    <!-- the funnel -->
    <path d="M50 14h60a3 3 0 0 1 2.3 4.9L90 44v12.5a3 3 0 0 1-1.6 2.7l-12 6A3 3 0 0 1 72 62.5V44L47.7 18.9A3 3 0 0 1 50 14z" class="fill-white stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M56 22h48" class="stroke-neutral-200" stroke-width="3" stroke-linecap="round" />

    <!-- a few statuses that didn't get through -->
    <circle cx="40" cy="30" r="4" class="fill-sky-200" />
    <circle cx="122" cy="24" r="4" class="fill-amber-200" />
    <circle cx="128" cy="40" r="3" class="fill-emerald-200" />
  </svg>
</template>
