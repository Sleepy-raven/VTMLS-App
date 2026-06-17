import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

export default function AdminDashboardScreen() {
  const { colors } = useTheme()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async () => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/stats', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.log('Admin stats error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  // Re-fetch every time the Dashboard tab regains focus, so newly registered users or
  // updated stats show up without needing to restart the app.
  useFocusEffect(
    useCallback(() => {
      fetchStats()
    }, [])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchStats()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size={32} color={colors.primary} />
      </View>
    )
  }

  const STATS = [
    { label: 'Total Users',   value: stats?.totalUsers ?? 0,    icon: 'people-outline',          color: '#3B82F6' },
    { label: 'Premium Users', value: stats?.premiumUsers ?? 0,  icon: 'star-outline',            color: '#F59E0B' },
    { label: 'Free Users',    value: stats?.freeUsers ?? 0,     icon: 'person-outline',          color: '#10B981' },
    { label: 'Total Trades',  value: stats?.totalTrades ?? 0,   icon: 'swap-horizontal-outline', color: '#8B5CF6' },
    { label: 'Total Lessons', value: stats?.totalLessons ?? 0,  icon: 'book-outline',            color: '#06B6D4' },
    { label: 'Revenue',       value: 'GHS ' + (stats?.totalRevenue ?? 0).toFixed(2), icon: 'cash-outline', color: '#10B981' },
  ]

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[s.headerSub, { color: colors.isLight ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>Admin Panel</Text>
          <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Dashboard</Text>
        </View>
        <View style={[s.adminBadge, { backgroundColor: colors.primary+'20' }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={[s.adminBadgeText, { color: colors.primary }]}>Admin</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={s.statsGrid}>
          {STATS.map(stat => (
            <View key={stat.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: stat.color+'20' }]}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Recent Users</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {stats?.recentUsers?.map((u: any, i: number) => (
            <View key={u.id} style={[s.userRow, i < stats.recentUsers.length-1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                <Text style={s.avatarText}>{u.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.userName, { color: colors.text }]}>{u.name}</Text>
                <Text style={[s.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.tierText, { color: colors.accent }]}>{u.tier}</Text>
                {u.isPremium && <Text style={[s.premText, { color: colors.gold }]}>⭐ Premium</Text>}
              </View>
            </View>
          ))}
        </View>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Platform Overview</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'Premium Revenue',   value: 'GHS ' + (stats?.totalRevenue ?? 0).toFixed(2) },
            { label: 'Total Lessons',     value: stats?.totalLessons ?? 0 },
            { label: 'Total Challenges',  value: stats?.totalChallenges ?? 0 },
            { label: 'Premium Users',     value: stats?.premiumUsers ?? 0 },
            { label: 'Free Users',        value: stats?.freeUsers ?? 0 },
          ].map((item, i) => (
            <View key={item.label} style={[s.overviewRow, i < 4 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[s.overviewLabel, { color: colors.textSecondary }]}>{item.label}</Text>
              <Text style={[s.overviewValue, { color: colors.text }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerSub: { fontSize: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  adminBadgeText: { fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47%', borderRadius: 12, padding: 12, borderWidth: 1 },
  statIcon: { width: 38, height: 38, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  userName: { fontSize: 13, fontWeight: '600' },
  userEmail: { fontSize: 11, marginTop: 1 },
  tierText: { fontSize: 11, fontWeight: '700' },
  premText: { fontSize: 10, marginTop: 1 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  overviewLabel: { fontSize: 12 },
  overviewValue: { fontSize: 13, fontWeight: '700' },
})
