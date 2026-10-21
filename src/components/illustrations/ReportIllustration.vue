<template>
  <!-- A work report: a sheet listing finished tasks with their prices, and a total. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- a sheet behind -->
    <rect x="56" y="10" width="62" height="86" rx="4" transform="rotate(6 87 53)" class="fill-neutral-100 stroke-neutral-300" stroke-width="1.5" />

    <!-- the report -->
    <rect x="42" y="12" width="64" height="90" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <!-- its title -->
    <rect x="50" y="21" width="30" height="4" rx="2" class="fill-neutral-400" />
    <rect x="50" y="29" width="20" height="3" rx="1.5" class="fill-neutral-200" />

    <!-- the tasks, each with a check and a price -->
    <g>
      <circle cx="53" cy="44" r="3" class="fill-emerald-100" />
      <path d="m51.6 44 1 1 1.9-1.9" class="stroke-emerald-600" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="59" y="42.5" width="24" height="3" rx="1.5" class="fill-neutral-200" />
      <rect x="88" y="42.5" width="10" height="3" rx="1.5" class="fill-neutral-300" />
    </g>
    <g>
      <circle cx="53" cy="54" r="3" class="fill-emerald-100" />
      <path d="m51.6 54 1 1 1.9-1.9" class="stroke-emerald-600" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="59" y="52.5" width="18" height="3" rx="1.5" class="fill-neutral-200" />
      <rect x="88" y="52.5" width="10" height="3" rx="1.5" class="fill-neutral-300" />
    </g>
    <g>
      <circle cx="53" cy="64" r="3" class="fill-emerald-100" />
      <path d="m51.6 64 1 1 1.9-1.9" class="stroke-emerald-600" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="59" y="62.5" width="22" height="3" rx="1.5" class="fill-neutral-200" />
      <rect x="88" y="62.5" width="10" height="3" rx="1.5" class="fill-neutral-300" />
    </g>

    <!-- the total -->
    <path d="M50 74h48" class="stroke-neutral-200" stroke-width="1.5" />
    <rect x="50" y="80" width="16" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="82" y="79" width="16" height="5" rx="2.5" class="fill-neutral-800" />
  </svg>
</template>
