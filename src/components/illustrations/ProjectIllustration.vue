<template>
  <!-- A project: a folder holding its task cards, one of them done, with its progress on the front. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="58" ry="6" class="fill-neutral-200/70" />

    <!-- the back of the folder, with its tab -->
    <path d="M30 34a4 4 0 0 1 4-4h26l8 8h58a4 4 0 0 1 4 4v58a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4z" class="fill-neutral-200 stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />

    <!-- the task cards inside -->
    <g transform="rotate(-6 66 42)">
      <rect x="46" y="20" width="40" height="44" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
      <rect x="53" y="28" width="22" height="3" rx="1.5" class="fill-neutral-300" />
      <rect x="53" y="35" width="26" height="3" rx="1.5" class="fill-neutral-200" />
    </g>
    <g transform="rotate(5 98 40)">
      <rect x="78" y="16" width="40" height="46" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
      <circle cx="87" cy="26" r="4.5" class="fill-emerald-100" />
      <path d="m84.9 26 1.4 1.4 2.8-2.8" class="stroke-emerald-600" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="95" y="24.5" width="16" height="3" rx="1.5" class="fill-neutral-300" />
      <rect x="85" y="34" width="26" height="3" rx="1.5" class="fill-neutral-200" />
    </g>

    <!-- the front of the folder -->
    <path d="M26 54a4 4 0 0 1 4-4h100a4 4 0 0 1 4 4l-4 46a4 4 0 0 1-4 3.6H34a4 4 0 0 1-4-3.6z" class="fill-neutral-100 stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />
    <!-- its progress -->
    <rect x="48" y="80" width="64" height="5" rx="2.5" class="fill-neutral-200" />
    <rect x="48" y="80" width="38" height="5" rx="2.5" class="fill-neutral-800" />
  </svg>
</template>
