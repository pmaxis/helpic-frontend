<template>
  <!-- An open archive box with two finished task cards going in, one of them done. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="58" ry="6" class="fill-neutral-200/70" />

    <!-- back of the box -->
    <path d="M34 50h92v8H34z" class="fill-neutral-200" />

    <!-- the cards going in -->
    <g transform="rotate(-8 62 40)">
      <rect x="44" y="16" width="38" height="48" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
      <rect x="51" y="25" width="20" height="3" rx="1.5" class="fill-neutral-300" />
      <rect x="51" y="32" width="24" height="3" rx="1.5" class="fill-neutral-200" />
      <rect x="51" y="39" width="16" height="3" rx="1.5" class="fill-neutral-200" />
    </g>
    <g transform="rotate(7 98 36)">
      <rect x="78" y="10" width="40" height="50" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
      <rect x="85" y="19" width="22" height="3" rx="1.5" class="fill-neutral-300" />
      <rect x="85" y="26" width="26" height="3" rx="1.5" class="fill-neutral-200" />
      <!-- done -->
      <circle cx="91" cy="41" r="6" class="fill-emerald-100" />
      <path d="m88.2 41 1.9 1.9 3.7-3.8" class="stroke-emerald-600" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="100" y="39.5" width="12" height="3" rx="1.5" class="fill-neutral-200" />
    </g>

    <!-- front of the box -->
    <path d="M30 56h100l-6 46a4 4 0 0 1-4 3.5H40a4 4 0 0 1-4-3.5z" class="fill-neutral-100 stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />
    <!-- its rim -->
    <rect x="26" y="50" width="108" height="10" rx="3" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <!-- the handle cut-out -->
    <rect x="68" y="72" width="24" height="7" rx="3.5" class="fill-white stroke-neutral-300" stroke-width="1.5" />
  </svg>
</template>
