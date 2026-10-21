// Puts on the theme picked in Settings (or the system's) before anything is
// drawn, so a dark page never flashes white. src/composables/useTheme.ts keeps
// it in step afterwards.
;(function () {
  var theme
  try {
    theme = localStorage.getItem('helpic:theme')
  } catch (e) {
    // storage may be unavailable (private mode)
  }
  var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
