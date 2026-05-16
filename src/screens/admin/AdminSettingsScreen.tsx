import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

export default function AdminSettingsScreen() {
  const { colors } = useTheme()
  const { user, logout } = useAuth()
  const navigation = useNavigation<any>()

  const TOOLS = [
    { icon: 'school-outline',    label: 'Manage Lessons',     onPress: () => navigation.navigate('AdminLessons') },
    { icon: 'trophy-outline',    label: 'Manage Challenges',  onPress: () => navigation.navigate('AdminChallenges') },
    { icon: 'cash-outline',      label: 'Prize Payouts',      onPress: () => navigation.navigate('AdminPayouts') },
    { icon: 'mail-outline',      label: 'Send Notification',  onPress: () => navigation.navigate('AdminNotify') },
  ]

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Settings</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <View style={[s.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>{user?.name.charAt(0)}</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={[s.userName, { color: colors.text }]}>{user?.name}</Text>
            <Text style={[s.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            <View style={[s.badge, { backgroundColor: colors.primary+'20' }]}>
              <Text style={[s.badgeText, { color: colors.primary }]}>🛡 Administrator</Text>
            </View>
          </View>
        </View>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Admin Tools</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TOOLS.map((item, i) => (
            <TouchableOpacity key={item.label} onPress={item.onPress} style={[s.menuItem, i < TOOLS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Ionicons name={item.icon as any} size={18} color={colors.textSecondary} />
              <Text style={[s.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.signOutBtn, { backgroundColor: colors.danger+'15', borderColor: colors.danger+'40' }]} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[s.signOutText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  badge: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  menuLabel: { flex: 1, fontSize: 14 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 36 },
  signOutText: { fontSize: 14, fontWeight: '700' },
})
