<template>
  <!-- A board with nothing on it yet: three columns, one card waiting to be placed. -->
  <svg viewBox="0 0 160 120" fill="none" class="h-28 w-36" aria-hidden="true">
    <!-- ground -->
    <ellipse cx="80" cy="108" rx="60" ry="6" class="fill-neutral-200/70" />

    <!-- the board -->
    <rect x="18" y="18" width="124" height="82" rx="6" class="fill-white stroke-neutral-300" stroke-width="1.5" />

    <!-- its columns, each with a coloured status dot -->
    <g>
      <rect x="26" y="26" width="34" height="66" rx="3" class="fill-neutral-50" />
      <circle cx="32" cy="32" r="2.5" class="fill-sky-400" />
      <rect x="37" y="30.5" width="16" height="3" rx="1.5" class="fill-neutral-300" />
      <rect x="30" y="40" width="26" height="16" rx="2.5" class="fill-white stroke-neutral-200" stroke-width="1.2" stroke-dasharray="3 3" />
    </g>
    <g>
      <rect x="63" y="26" width="34" height="66" rx="3" class="fill-neutral-50" />
      <circle cx="69" cy="32" r="2.5" class="fill-amber-400" />
      <rect x="74" y="30.5" width="16" height="3" rx="1.5" class="fill-neutral-300" />
    </g>
    <g>
      <rect x="100" y="26" width="34" height="66" rx="3" class="fill-neutral-50" />
      <circle cx="106" cy="32" r="2.5" class="fill-emerald-500" />
      <rect x="111" y="30.5" width="16" height="3" rx="1.5" class="fill-neutral-300" />
    </g>

    <!-- a card on its way in -->
    <g transform="rotate(-10 52 66)">
      <rect x="38" y="58" width="30" height="20" rx="3" class="fill-white stroke-neutral-400" stroke-width="1.5" />
      <rect x="43" y="64" width="18" height="2.5" rx="1.25" class="fill-neutral-400" />
      <rect x="43" y="70" width="12" height="2.5" rx="1.25" class="fill-neutral-200" />
    </g>
  </svg>
</template>
