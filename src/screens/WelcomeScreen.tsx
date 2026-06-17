import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

interface Props { onEnter: () => void }

export default function WelcomeScreen({ onEnter }: Props) {
  const { user } = useAuth()
  const { colors } = useTheme()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  const hour = new Date().getHours()
  let greeting = 'Good morning,'
  let emoji = '🌅'
  if (hour >= 12 && hour < 17) { greeting = 'Welcome back,'; emoji = '☀️' }
  else if (hour >= 17 && hour < 21) { greeting = 'Good evening,'; emoji = '🌆' }
  else if (hour >= 21 || hour < 5) { greeting = 'Good night,'; emoji = '🌙' }

  const isLondonOpen = hour >= 8 && hour < 17
  const isNYOpen = hour >= 13 && hour < 22
  const sessionMsg = isLondonOpen
    ? '● London Session is Open'
    : isNYOpen
    ? '● New York Session is Open'
    : '● Markets Closed — Review Performance'

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: '#0A1F3D' }]}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={[styles.name, { color: colors.primary }]}>{user?.name}</Text>
        <View style={[styles.sessionBadge, {
          backgroundColor: isLondonOpen || isNYOpen ? '#10B98120' : '#F59E0B20',
          borderColor: isLondonOpen || isNYOpen ? '#10B98140' : '#F59E0B40',
        }]}>
          <Text style={[styles.sessionText, { color: isLondonOpen || isNYOpen ? '#10B981' : '#F59E0B' }]}>
            {sessionMsg}
          </Text>
        </View>
        <Text style={styles.hint}>
          {isLondonOpen
            ? 'EUR/USD, GBP/USD & Gold are most active'
            : isNYOpen
            ? 'USD pairs & US Indices are most active'
            : 'Markets reopen Sunday 10pm GMT'}
        </Text>
        <TouchableOpacity style={[styles.enterBtn, { backgroundColor: colors.primary }]} onPress={onEnter}>
          <Text style={styles.enterBtnText}>Enter App</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 52, marginBottom: 16 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#F0F9FF', marginBottom: 4 },
  name: { fontSize: 28, fontWeight: '900', marginBottom: 20 },
  sessionBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  sessionText: { fontSize: 11, fontWeight: '700' },
  hint: { fontSize: 12, color: '#93C5FD', textAlign: 'center', lineHeight: 18, marginBottom: 36 },
  enterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  enterBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
