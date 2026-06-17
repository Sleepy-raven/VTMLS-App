import React, { useState, useRef } from 'react'
import { View, ActivityIndicator, Animated, Dimensions, TouchableWithoutFeedback } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import LoginScreen from '../screens/auth/LoginScreen'
import SplashScreen from '../screens/SplashScreen'
import WelcomeScreen from '../screens/WelcomeScreen'
import LearnerTabs from './LearnerTabs'
import AdminTabs from './AdminTabs'
import LessonDetailScreen from '../screens/learner/LessonDetailScreen'
import AdminLessonsScreen from '../screens/admin/AdminLessonsScreen'
import AdminChallengesScreen from '../screens/admin/AdminChallengesScreen'
import AdminPayoutsScreen from '../screens/admin/AdminPayoutsScreen'
import AdminNotifyScreen from '../screens/admin/AdminNotifyScreen'

type AppState = 'splash' | 'welcome' | 'app'
const Stack = createNativeStackNavigator()
const { width } = Dimensions.get('window')

// React Navigation defaults to a white background for the container and each screen's
// content area. Without this, a blank white frame flashes during screen swaps (e.g.
// Welcome -> Home) before the destination screen's own content paints over it.
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0E1A', card: '#0A0E1A' } }

export default function RootNavigator() {
  const { user, isInitializing } = useAuth()
  const [appState, setAppState] = useState<AppState>('splash')
  const slideAnim = useRef(new Animated.Value(0)).current

  // Hidden entry point: 5 taps anywhere on the pre-login loading screen (within ~1.8s) opens
  // the Admin Sign In form once the Login screen mounts. No visual change to the loader itself.
  const [pendingAdminMode, setPendingAdminMode] = useState(false)
  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)
  const handleLoadingTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current > 1800) tapCountRef.current = 0
    lastTapRef.current = now
    tapCountRef.current += 1
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      setPendingAdminMode(true)
    }
  }

  const handleSplashDone = () => setAppState('welcome')

  const handleEnterApp = () => {
    Animated.timing(slideAnim, { toValue: -width, duration: 400, useNativeDriver: true }).start(() => setAppState('app'))
  }

  // The tabs screen (Home etc.) is mounted as soon as `user` is known — even while Splash/
  // Welcome are still showing — instead of waiting for "Enter App" to finish. It's just hidden
  // behind those two as a full-screen overlay. This way the heavy first-time mount (Tab
  // Navigator, Home's data fetches, socket connection) happens invisibly in the background,
  // and removing the overlay on Enter is instant since nothing new needs to be constructed.
  const showOverlay = !!user && (appState === 'splash' || appState === 'welcome')

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0E1A' } }}>
          {isInitializing ? (
            <Stack.Screen name='Loading'>
              {() => (
                <TouchableWithoutFeedback onPress={handleLoadingTap}>
                  <View style={{ flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size={40} color='#3B82F6' />
                  </View>
                </TouchableWithoutFeedback>
              )}
            </Stack.Screen>
          ) : !user ? (
            <Stack.Screen name='Login'>
              {() => <LoginScreen initialAdminMode={pendingAdminMode} />}
            </Stack.Screen>
          ) : user.role === 'admin' ? (
            <>
              <Stack.Screen name='AdminTabs' component={AdminTabs} />
              <Stack.Screen name='AdminLessons' component={AdminLessonsScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name='AdminChallenges' component={AdminChallengesScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name='AdminPayouts' component={AdminPayoutsScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name='AdminNotify' component={AdminNotifyScreen} options={{ animation: 'slide_from_right' }} />
            </>
          ) : (
            <>
              <Stack.Screen name='LearnerTabs' component={LearnerTabs} />
              <Stack.Screen name='LessonDetail' component={LessonDetailScreen} options={{ animation: 'slide_from_right' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {showOverlay && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {appState === 'splash'
            ? <SplashScreen onDone={handleSplashDone} />
            : (
              <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
                <WelcomeScreen onEnter={handleEnterApp} />
              </Animated.View>
            )}
        </View>
      )}
    </View>
  )
}
