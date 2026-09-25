const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const toBn = (n: number): string => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)])

window.api.getWelcomeVerse().then((v) => {
  const arabic = $('arabic')
  arabic.textContent = v.arabic
  arabic.hidden = !v.arabic

  const translation = $('translation')
  translation.textContent = v.translation
  // Shrink for long verses so everything fits without scrolling.
  const len = v.translation.length
  translation.dataset.size = len > 400 ? 'xs' : len > 220 ? 'sm' : len > 110 ? 'md' : 'lg'
  arabic.dataset.size = v.arabic.length > 300 ? 'xs' : v.arabic.length > 150 ? 'sm' : 'lg'

  $('reference').textContent = v.surahNumber
    ? `সূরা ${v.surahTranslation} (${v.surahName}) · আয়াত ${toBn(v.verseNumber)}`
    : ''
})

$('open-settings').addEventListener('click', () => window.api.welcomeOpenSettings())
$('dismiss').addEventListener('click', () => window.api.welcomeDismiss())
