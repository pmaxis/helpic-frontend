<template>
  <!-- An invitation: an open envelope with the invite card rising out of it, and a person about to be added. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="104" rx="54" ry="6" class="fill-neutral-200/70" />

    <!-- the back of the envelope and its open flap -->
    <path d="M36 56 80 26l44 30v44a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4z" class="fill-neutral-200 stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />

    <!-- the invite card -->
    <rect x="50" y="18" width="60" height="56" rx="4" class="fill-white stroke-neutral-300" stroke-width="1.5" />
    <circle cx="64" cy="33" r="6" class="fill-neutral-800" />
    <rect x="74" y="29" width="26" height="3" rx="1.5" class="fill-neutral-400" />
    <rect x="74" y="35" width="18" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="58" y="48" width="44" height="3" rx="1.5" class="fill-neutral-200" />
    <rect x="66" y="58" width="28" height="7" rx="3.5" class="fill-neutral-800" />

    <!-- the front of the envelope -->
    <path d="M36 60v40a4 4 0 0 0 4 4h80a4 4 0 0 0 4-4V60L80 86z" class="fill-neutral-100 stroke-neutral-300" stroke-width="1.5" stroke-linejoin="round" />

    <!-- someone to add -->
    <circle cx="122" cy="40" r="11" class="fill-emerald-100 stroke-emerald-500" stroke-width="1.5" />
    <circle cx="120" cy="37.5" r="2.6" class="stroke-emerald-600" stroke-width="1.4" />
    <path d="M115 45.5a5 5 0 0 1 10 0" class="stroke-emerald-600" stroke-width="1.4" stroke-linecap="round" />
    <path d="M127.5 36v5M125 38.5h5" class="stroke-emerald-600" stroke-width="1.4" stroke-linecap="round" />
  </svg>
</template>
