import React, { useState } from 'react'
import { View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import TabLoader from '../components/TabLoader'
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen'
import AdminUsersScreen from '../screens/admin/AdminUsersScreen'
import AdminMarketScreen from '../screens/admin/AdminMarketScreen'
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen'

const Tab = createBottomTabNavigator()

export default function AdminTabs() {
  const { colors } = useTheme()
  const [loading, setLoading] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      {loading && <TabLoader />}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, borderTopWidth: 1, height: 58, paddingBottom: 6 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
          tabBarIcon: ({ focused, color }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Dashboard: focused ? 'grid' : 'grid-outline',
              Users: focused ? 'people' : 'people-outline',
              Market: focused ? 'pulse' : 'pulse-outline',
              Settings: focused ? 'settings' : 'settings-outline',
            }
            return <Ionicons name={icons[route.name]} size={21} color={color} />
          },
        })}
        screenListeners={{ tabPress: () => { setLoading(true); setTimeout(() => setLoading(false), 600) } }}
      >
        <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
        <Tab.Screen name="Users"     component={AdminUsersScreen}     />
        <Tab.Screen name="Market"    component={AdminMarketScreen}    />
        <Tab.Screen name="Settings"  component={AdminSettingsScreen}  />
      </Tab.Navigator>
    </View>
  )
}
