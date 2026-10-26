export type ThemePref = 'system' | 'light' | 'dark'

const query = window.matchMedia('(prefers-color-scheme: dark)')
let pref: ThemePref = 'system'

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && query.matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function initTheme() {
  query.addEventListener('change', apply)
  apply()
}

export function setThemePref(next: ThemePref) {
  pref = next
  apply()
}
