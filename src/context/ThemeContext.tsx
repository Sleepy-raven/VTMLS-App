import React, { createContext, useContext, useState } from 'react'

export type ThemeId =
  | 'dark'
  | 'navy'
  | 'midnight_green'
  | 'deep_purple'
  | 'charcoal_gold'
  | 'ocean_teal'
  | 'white_navy'
  | 'white_emerald'
  | 'white_purple'
  | 'white_gold'
  | 'white_teal'

export interface ThemeMeta {
  id: ThemeId
  label: string
  emoji: string
  premium: boolean
  isLight: boolean
  swatch: string
  accentSwatch?: string
}

export const THEMES: ThemeMeta[] = [
  { id: 'dark',           label: 'Dark',           emoji: '🌙', premium: false, isLight: false, swatch: '#0A0E1A' },
  { id: 'navy',           label: 'Navy Pro',        emoji: '🌊', premium: false, isLight: false, swatch: '#0F2D52' },
  { id: 'midnight_green', label: 'Midnight Green',  emoji: '🌿', premium: true,  isLight: false, swatch: '#0A1A0F' },
  { id: 'deep_purple',    label: 'Deep Purple',     emoji: '💜', premium: true,  isLight: false, swatch: '#0F0A1A' },
  { id: 'charcoal_gold',  label: 'Charcoal Gold',   emoji: '🏙️', premium: true,  isLight: false, swatch: '#111111' },
  { id: 'ocean_teal',     label: 'Ocean Teal',      emoji: '🐬', premium: true,  isLight: false, swatch: '#0A1A2A' },
  { id: 'white_navy',     label: 'White + Navy',    emoji: '☀️', premium: true,  isLight: true,  swatch: '#FFFFFF', accentSwatch: '#1D4ED8' },
  { id: 'white_emerald',  label: 'White + Emerald', emoji: '☀️', premium: true,  isLight: true,  swatch: '#FFFFFF', accentSwatch: '#059669' },
  { id: 'white_purple',   label: 'White + Purple',  emoji: '☀️', premium: true,  isLight: true,  swatch: '#FFFFFF', accentSwatch: '#7C3AED' },
  { id: 'white_gold',     label: 'White + Gold',    emoji: '☀️', premium: true,  isLight: true,  swatch: '#FFFFFF', accentSwatch: '#D97706' },
  { id: 'white_teal',     label: 'White + Teal',    emoji: '☀️', premium: true,  isLight: true,  swatch: '#FFFFFF', accentSwatch: '#0891B2' },
]

export interface Colors {
  background: string
  surface: string
  card: string
  border: string
  primary: string
  primaryDark: string
  accent: string
  danger: string
  warning: string
  gold: string
  text: string
  textSecondary: string
  textMuted: string
  tabBar: string
  headerBg: string
  subTabBg: string
  inputBg: string
  isLight: boolean
}

const buildColors = (id: ThemeId): Colors => {
  switch (id) {
    case 'dark':
      return { background:'#0A0E1A', surface:'#111827', card:'#1A2235', border:'#1E2D45', primary:'#3B82F6', primaryDark:'#2563EB', accent:'#10B981', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#F9FAFB', textSecondary:'#9CA3AF', textMuted:'#4B5563', tabBar:'#0F1624', headerBg:'#0A0E1A', subTabBg:'#111827', inputBg:'#111827', isLight: false }
    case 'navy':
      return { background:'#0F2D52', surface:'#0D2444', card:'#0D2444', border:'#1E3A5F', primary:'#60A5FA', primaryDark:'#3B82F6', accent:'#10B981', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#F0F9FF', textSecondary:'#93C5FD', textMuted:'#60A5FA', tabBar:'#0A1F3D', headerBg:'#0A1F3D', subTabBg:'#0D2444', inputBg:'#0A1F3D', isLight: false }
    case 'midnight_green':
      return { background:'#0A1A0F', surface:'#0D2214', card:'#112918', border:'#1A3D22', primary:'#10B981', primaryDark:'#059669', accent:'#34D399', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#F0FDF4', textSecondary:'#86EFAC', textMuted:'#4ADE80', tabBar:'#071209', headerBg:'#071209', subTabBg:'#0D2214', inputBg:'#0D2214', isLight: false }
    case 'deep_purple':
      return { background:'#0F0A1A', surface:'#160D26', card:'#1C1133', border:'#2D1A4A', primary:'#A855F7', primaryDark:'#9333EA', accent:'#10B981', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#FAF5FF', textSecondary:'#D8B4FE', textMuted:'#A855F7', tabBar:'#0A0712', headerBg:'#0A0712', subTabBg:'#160D26', inputBg:'#160D26', isLight: false }
    case 'charcoal_gold':
      return { background:'#111111', surface:'#1A1A1A', card:'#222222', border:'#333333', primary:'#F59E0B', primaryDark:'#D97706', accent:'#10B981', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#F9FAFB', textSecondary:'#D1D5DB', textMuted:'#6B7280', tabBar:'#0A0A0A', headerBg:'#0A0A0A', subTabBg:'#1A1A1A', inputBg:'#1A1A1A', isLight: false }
    case 'ocean_teal':
      return { background:'#0A1A2A', surface:'#0D2235', card:'#112840', border:'#1A3A52', primary:'#06B6D4', primaryDark:'#0891B2', accent:'#10B981', danger:'#EF4444', warning:'#F59E0B', gold:'#F59E0B', text:'#F0FDFF', textSecondary:'#A5F3FC', textMuted:'#67E8F9', tabBar:'#071219', headerBg:'#071219', subTabBg:'#0D2235', inputBg:'#0D2235', isLight: false }
    case 'white_navy':
      return { background:'#F8FAFC', surface:'#F1F5F9', card:'#FFFFFF', border:'#E2E8F0', primary:'#1D4ED8', primaryDark:'#1E40AF', accent:'#059669', danger:'#DC2626', warning:'#D97706', gold:'#D97706', text:'#0F172A', textSecondary:'#475569', textMuted:'#94A3B8', tabBar:'#FFFFFF', headerBg:'#1D4ED8', subTabBg:'#EFF6FF', inputBg:'#F1F5F9', isLight: true }
    case 'white_emerald':
      return { background:'#F8FAFB', surface:'#F0FDF4', card:'#FFFFFF', border:'#D1FAE5', primary:'#059669', primaryDark:'#047857', accent:'#10B981', danger:'#DC2626', warning:'#D97706', gold:'#D97706', text:'#0F172A', textSecondary:'#475569', textMuted:'#94A3B8', tabBar:'#FFFFFF', headerBg:'#059669', subTabBg:'#F0FDF4', inputBg:'#F0FDF4', isLight: true }
    case 'white_purple':
      return { background:'#FAFAFA', surface:'#FAF5FF', card:'#FFFFFF', border:'#E9D5FF', primary:'#7C3AED', primaryDark:'#6D28D9', accent:'#10B981', danger:'#DC2626', warning:'#D97706', gold:'#D97706', text:'#0F172A', textSecondary:'#475569', textMuted:'#94A3B8', tabBar:'#FFFFFF', headerBg:'#7C3AED', subTabBg:'#FAF5FF', inputBg:'#FAF5FF', isLight: true }
    case 'white_gold':
      return { background:'#FFFBF0', surface:'#FFFBEB', card:'#FFFFFF', border:'#FDE68A', primary:'#D97706', primaryDark:'#B45309', accent:'#059669', danger:'#DC2626', warning:'#D97706', gold:'#D97706', text:'#0F172A', textSecondary:'#475569', textMuted:'#94A3B8', tabBar:'#FFFFFF', headerBg:'#D97706', subTabBg:'#FFFBEB', inputBg:'#FFFBEB', isLight: true }
    case 'white_teal':
      return { background:'#F0FDFF', surface:'#ECFEFF', card:'#FFFFFF', border:'#A5F3FC', primary:'#0891B2', primaryDark:'#0E7490', accent:'#10B981', danger:'#DC2626', warning:'#D97706', gold:'#D97706', text:'#0F172A', textSecondary:'#475569', textMuted:'#94A3B8', tabBar:'#FFFFFF', headerBg:'#0891B2', subTabBg:'#ECFEFF', inputBg:'#ECFEFF', isLight: true }
    default:
      return buildColors('dark')
  }
}

interface ThemeContextType {
  themeId: ThemeId
  colors: Colors
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: 'dark',
  colors: buildColors('dark'),
  setTheme: () => {},
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeId] = useState<ThemeId>('dark')
  const colors = buildColors(themeId)
  const setTheme = (id: ThemeId) => setThemeId(id)
  return (
    <ThemeContext.Provider value={{ themeId, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
