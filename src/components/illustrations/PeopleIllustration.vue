<template>
  <!-- Nobody to work with yet: two people, and an invitation on its way from one to the other. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="58" ry="6" class="fill-neutral-200/70" />

    <!-- you -->
    <rect x="18" y="44" width="40" height="52" rx="6" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <circle cx="38" cy="62" r="8" class="fill-neutral-800" />
    <path d="M26 88a12 12 0 0 1 24 0" class="fill-neutral-800" />

    <!-- someone not here yet -->
    <rect x="102" y="44" width="40" height="52" rx="6" class="fill-neutral-50 stroke-neutral-300" stroke-width="1.5" stroke-dasharray="4 4" />
    <circle cx="122" cy="62" r="8" class="fill-neutral-200" />
    <path d="M110 88a12 12 0 0 1 24 0" class="fill-neutral-200" />

    <!-- the way between them -->
    <path d="M60 50c10-18 30-22 40-4" class="stroke-neutral-300" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round" />

    <!-- the invitation -->
    <g transform="rotate(-8 80 32)">
      <rect x="66" y="22" width="28" height="20" rx="3" class="fill-white stroke-neutral-400" stroke-width="1.5" />
      <path d="m67 24 13 10 13-10" class="stroke-neutral-400" stroke-width="1.5" stroke-linejoin="round" />
    </g>
    <circle cx="93" cy="22" r="5" class="fill-emerald-500" />
    <path d="M93 19.8v4.4M90.8 22h4.4" class="stroke-white" stroke-width="1.4" stroke-linecap="round" />
  </svg>
</template>
