import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet, StatusBar, Easing } from 'react-native'
import UptrendLoader from '../components/UptrendLoader'
interface Props { onDone: () => void }

export default function SplashScreen({ onDone }: Props) {
  const progress = useRef(new Animated.Value(0)).current
  // VMLTS starts tiny and faint (as if far behind the screen) then rushes toward the
  // viewer, growing large and sharp until it settles at its final standard size.
  const nameScale = useRef(new Animated.Value(0.05)).current
  const nameOpacity = useRef(new Animated.Value(0)).current
  // Tagline ("full meaning") only appears once the fly-in has settled.
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const taglineTranslateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        // Opacity ramps in fast during the first part of the flight (still distant = faint).
        Animated.timing(nameOpacity, { toValue: 1, duration: 350, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        // Fast approach that decelerates sharply as it "arrives" at the viewer, with a
        // slight overshoot past final size before settling — like it flew past and back.
        Animated.timing(nameScale, { toValue: 1.15, duration: 550, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      ]),
      Animated.spring(nameScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 8 }),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(taglineTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: false }),
    ]).start(() => setTimeout(onDone, 300))
  }, [])

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={{ marginBottom: 20 }}>
        <UptrendLoader color="#3B82F6" barColor="#1E2D45" size={140} />
      </View>
      <Animated.Text
        style={[styles.appName, { opacity: nameOpacity, transform: [{ scale: nameScale }] }]}
      >
        VMLTS
      </Animated.Text>
      <Animated.View
        style={{ opacity: taglineOpacity, transform: [{ translateY: taglineTranslateY }], alignItems: 'center' }}
      >
        <Text style={styles.tagline}>VIRTUAL MARKET LEARNING & TRADING SIMULATOR</Text>
        <View style={styles.barBg}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center', gap: 0 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 10 },
  appName: { fontSize: 32, fontWeight: '900', color: '#F0F9FF', letterSpacing: 6, marginBottom: 6 },
  tagline: { fontSize: 10, color: '#60A5FA', letterSpacing: 2, marginBottom: 32, textAlign: 'center', maxWidth: 220 },
  barBg: { width: 160, height: 2, backgroundColor: '#1E2D45', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
})
