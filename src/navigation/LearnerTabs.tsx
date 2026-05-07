import React, { useState } from 'react'
import { View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import TabLoader from '../components/TabLoader'
import HomeScreen from '../screens/learner/HomeScreen'
import MarketScreen from '../screens/learner/MarketScreen'
import NewsScreen from '../screens/learner/NewsScreen'
import LearnScreen from '../screens/learner/LearnScreen'
import ProfileScreen from '../screens/learner/ProfileScreen'

const Tab = createBottomTabNavigator()

export default function LearnerTabs() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
    Home:    { active: 'home',      inactive: 'home-outline'      },
    Markets: { active: 'bar-chart', inactive: 'bar-chart-outline' },
    News:    { active: 'newspaper', inactive: 'newspaper-outline' },
    Learn:   { active: 'book',      inactive: 'book-outline'      },
    Profile: { active: 'person',    inactive: 'person-outline'    },
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && <TabLoader />}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneContainerStyle: { backgroundColor: colors.background },
         tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 58 + insets.bottom,
            paddingBottom: 6 + insets.bottom,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
          tabBarIcon: ({ focused, color }) => {
            const ico = icons[route.name]
            return <Ionicons name={focused ? ico.active : ico.inactive} size={21} color={color} />
          },
        })}
        screenListeners={{ tabPress: () => { setLoading(true); setTimeout(() => setLoading(false), 600) } }}
      >
        <Tab.Screen name="Home"    component={HomeScreen}    />
        <Tab.Screen name="Markets" component={MarketScreen}  />
        <Tab.Screen name="News"    component={NewsScreen}    />
        <Tab.Screen name="Learn"   component={LearnScreen}   />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </View>
  )
}