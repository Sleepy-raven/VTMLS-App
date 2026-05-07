import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import UptrendLoader from './UptrendLoader'

export default function TabLoader() {
  const { colors } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.background + 'EE' }]}>
      <UptrendLoader color={colors.primary} barColor={colors.primary + '20'} size={110} />
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 8 }]}>
        Loading market data...
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
})