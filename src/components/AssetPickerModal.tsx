import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import AssetLogo from './AssetLogo'
import { ASSETS } from '../data/markets'

interface Props {
  visible: boolean
  onClose: () => void
  excludeSymbols: string[]
  onSelect: (symbol: string) => void
  isPremium?: boolean
}

export default function AssetPickerModal({ visible, onClose, excludeSymbols, onSelect, isPremium = false }: Props) {
  const { colors } = useTheme()
  // Only show assets this user's tier can actually trade — free users shouldn't be able
  // to add premium-only assets to their watchlist/My Assets from here.
  const available = ASSETS.filter(a => !excludeSymbols.includes(a.symbol) && (isPremium || !a.premiumOnly))
  const lockedCount = !isPremium
    ? ASSETS.filter(a => !excludeSymbols.includes(a.symbol) && a.premiumOnly).length
    : 0

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>Add Asset</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {available.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>All assets already added</Text>
            ) : available.map(a => (
              <TouchableOpacity
                key={a.symbol}
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(a.symbol); onClose() }}>
                <AssetLogo symbol={a.symbol} size={32} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.sym, { color: colors.text }]}>{a.symbol}</Text>
                  <Text style={[styles.name, { color: colors.textSecondary }]}>{a.name}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {lockedCount > 0 && (
            <View style={styles.lockedRow}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 6 }}>
                {lockedCount} more asset{lockedCount === 1 ? '' : 's'} available with Premium
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, maxHeight: '75%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:     { fontSize: 17, fontWeight: '800' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  sym:       { fontSize: 13, fontWeight: '700' },
  name:      { fontSize: 11, marginTop: 2 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
})
