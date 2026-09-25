import { readFileSync } from 'fs'
import { Verse } from '../shared/types'
import { getResourcePath } from './utils'

interface RawSurah {
  id: number
  name: string
  transliteration: string
  translation: string
  verses: { id: number; text: string; translation: string }[]
}

const FALLBACK: Verse = {
  arabic: '',
  translation: 'কিছুক্ষণ বিশ্রাম নিন এবং চোখকে একটু আরাম দিন।',
  surahName: '',
  surahArabic: '',
  surahTranslation: '',
  surahNumber: 0,
  verseNumber: 0
}

let surahs: RawSurah[] | null = null

function load(): RawSurah[] {
  if (!surahs) {
    const parsed = JSON.parse(readFileSync(getResourcePath('quran_bn.json'), 'utf-8'))
    surahs = Array.isArray(parsed) ? parsed : []
  }
  return surahs
}

// Uniform over verses (not surahs), so long surahs aren't under-represented.
export function getRandomVerse(): Verse {
  try {
    const all = load()
    const total = all.reduce((n, s) => n + s.verses.length, 0)
    if (total === 0) return FALLBACK
    let pick = Math.floor(Math.random() * total)
    for (const s of all) {
      if (pick < s.verses.length) {
        const v = s.verses[pick]
        return {
          arabic: v.text,
          translation: v.translation,
          surahName: s.transliteration,
          surahArabic: s.name,
          surahTranslation: s.translation,
          surahNumber: s.id,
          verseNumber: v.id
        }
      }
      pick -= s.verses.length
    }
    return FALLBACK
  } catch {
    return FALLBACK
  }
}
