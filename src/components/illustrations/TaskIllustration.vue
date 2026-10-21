<template>
  <!-- Tasks: a checklist card, one item done and two to go, with a new task about to be added. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="102" rx="52" ry="6" class="fill-neutral-200/70" />

    <!-- a card behind -->
    <rect x="52" y="14" width="64" height="82" rx="4" transform="rotate(-6 84 55)" class="fill-neutral-100 stroke-neutral-300" stroke-width="1.5" />

    <!-- the checklist -->
    <rect x="46" y="12" width="66" height="90" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <rect x="55" y="22" width="28" height="4" rx="2" class="fill-neutral-400" />

    <!-- done -->
    <rect x="55" y="36" width="9" height="9" rx="2.5" class="fill-emerald-100 stroke-emerald-500" stroke-width="1.2" />
    <path d="m57.4 40.5 1.6 1.6 3.1-3.1" class="stroke-emerald-600" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="69" y="39" width="30" height="3" rx="1.5" class="fill-neutral-200" />
    <!-- to do -->
    <rect x="55" y="52" width="9" height="9" rx="2.5" class="fill-white stroke-neutral-300" stroke-width="1.2" />
    <rect x="69" y="55" width="24" height="3" rx="1.5" class="fill-neutral-300" />
    <rect x="55" y="68" width="9" height="9" rx="2.5" class="fill-white stroke-neutral-300" stroke-width="1.2" />
    <rect x="69" y="71" width="28" height="3" rx="1.5" class="fill-neutral-300" />

    <!-- a new one -->
    <circle cx="112" cy="90" r="10" class="fill-neutral-900" />
    <path d="M112 85.5v9M107.5 90h9" class="stroke-white" stroke-width="1.8" stroke-linecap="round" />
  </svg>
</template>
