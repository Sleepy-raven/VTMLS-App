import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ASSETS } from '../data/markets'

interface AssetLogoProps { symbol: string; size?: number }

export default function AssetLogo({ symbol, size = 40 }: AssetLogoProps) {
  const asset = ASSETS.find(a => a.symbol === symbol)
  const bg = asset?.bg || '#3B82F620'
  const color = asset?.color || '#3B82F6'
  const icon = asset?.icon || symbol.slice(0, 2)
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.icon, { color, fontSize: size * 0.28 }]}>{icon}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  icon: { fontWeight: '800' },
})
