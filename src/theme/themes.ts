import type { ThemeId } from '../types'

export interface ThemeMeta {
  id: ThemeId
  name: string
  description: string
  className: string
  scheme: 'light' | 'dark'
  isDefault?: boolean
  /** Flat swatches for the Settings → Appearance mini previews. */
  preview: {
    bg: string
    border: string
    accent: string
    surface: string
    text: string
    line: string
    surfaceShadow?: boolean
  }
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'sorbetes',
    name: 'Sorbetes',
    description: 'warm light',
    className: 'th-sorbetes',
    scheme: 'light',
    isDefault: true,
    preview: {
      bg: '#FAF5EC',
      border: '#ECE2D2',
      accent: '#FF6B5E',
      surface: '#FFFFFF',
      text: '#2B2433',
      line: '#ECE2D2',
      surfaceShadow: true,
    },
  },
  {
    id: 'ube',
    name: 'Ube Latte',
    description: 'dark violet',
    className: 'th-ube',
    scheme: 'dark',
    preview: {
      bg: '#161826',
      border: '#161826',
      accent: '#9184d9',
      surface: '#232532',
      text: '#e9e9ed',
      line: '#3f424d',
    },
  },
  {
    id: 'mint',
    name: 'Mint Ink',
    description: 'dark green',
    className: 'th-mint',
    scheme: 'dark',
    preview: {
      bg: '#0C1410',
      border: '#0C1410',
      accent: '#3ECF8E',
      surface: '#141F19',
      text: '#E6F2EA',
      line: '#24332B',
    },
  },
  {
    id: 'acid',
    name: 'Acid Pop',
    description: 'dark citrus',
    className: 'th-acid',
    scheme: 'dark',
    preview: {
      bg: '#101012',
      border: '#101012',
      accent: '#D4F24B',
      surface: '#1A1A1D',
      text: '#F2F2EE',
      line: '#2C2C30',
    },
  },
]

export const themeById = (id: ThemeId): ThemeMeta =>
  THEMES.find((t) => t.id === id) ?? THEMES[0]

export const DEFAULT_THEME: ThemeId = 'sorbetes'
