import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, THEMES, ThemeId } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

interface Props { onShowPremium: () => void; hidePremium?: boolean }

export default function ThemeSelector({ onShowPremium, hidePremium }: Props) {
  const { colors, themeId, setTheme } = useTheme()
  const { user } = useAuth()

  const freeThemes = THEMES.filter(t => !t.premium)
  const premiumThemes = THEMES.filter(t => t.premium)

  const handleSelect = (id: ThemeId, isPremiumTheme: boolean) => {
    if (isPremiumTheme && !user?.isPremium) { onShowPremium(); return }
    setTheme(id)
  }

  const ThemeItem = ({ theme }: { theme: typeof THEMES[0] }) => {
    const isLocked = theme.premium && !user?.isPremium
    const isActive = themeId === theme.id
    return (
      <TouchableOpacity
        onPress={() => handleSelect(theme.id, theme.premium)}
        style={[styles.themeItem, isActive && { borderColor: colors.primary, borderWidth: 2 }]}
      >
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: theme.swatch, borderWidth: 1, borderColor: colors.border }]} />
          {theme.accentSwatch && (
            <View style={[styles.accentSwatch, { backgroundColor: theme.accentSwatch }]} />
          )}
        </View>
        <Text style={[styles.themeLabel, { color: colors.text }]} numberOfLines={1}>{theme.label}</Text>
        {isActive && <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginTop: 2 }} />}
        {isLocked && <Ionicons name="lock-closed" size={12} color={colors.gold} style={{ marginTop: 2 }} />}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FREE THEMES</Text>
      <View style={styles.grid}>
        {freeThemes.map(t => <ThemeItem key={t.id} theme={t} />)}
      </View>

      {!hidePremium && (
        <>
          <View style={styles.divider} />

          <View style={styles.premiumHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PREMIUM THEMES</Text>
            {!user?.isPremium && (
              <TouchableOpacity onPress={onShowPremium}>
                <Text style={[styles.unlockText, { color: colors.gold }]}>Unlock ↗</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.subLabel, { color: colors.textMuted }]}>Dark bases</Text>
          <View style={styles.grid}>
            {premiumThemes.filter(t => !t.isLight).map(t => <ThemeItem key={t.id} theme={t} />)}
          </View>

          <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 10 }]}>White + accent</Text>
          <View style={styles.grid}>
            {premiumThemes.filter(t => t.isLight).map(t => <ThemeItem key={t.id} theme={t} />)}
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  subLabel: { fontSize: 9, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeItem: { width: 64, alignItems: 'center', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: 'transparent' },
  swatchRow: { flexDirection: 'row', marginBottom: 6 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  accentSwatch: { width: 14, height: 28, borderRadius: 7, marginLeft: -8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  themeLabel: { fontSize: 8, fontWeight: '600', textAlign: 'center' },
  premiumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  unlockText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1E2D4530', marginVertical: 12 },
})
