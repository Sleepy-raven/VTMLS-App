import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, StatusBar, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

export default function AdminUsersScreen() {
  const { colors } = useTheme()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'premium'|'free'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/users', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.log('Admin users error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = (userId: string, isPremium: boolean, name: string) => {
    Alert.alert(
      isPremium ? 'Cancel Subscription' : 'Grant Premium',
      isPremium
        ? `Cancel ${name}'s premium subscription? They'll immediately lose premium access.`
        : `Grant premium to ${name} for free?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          try {
            const token = await getToken()
            const res = await fetch(BASE_URL + '/admin/users/' + userId + '/tier', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              body: JSON.stringify({ isPremium: !isPremium })
            })
            if (!res.ok) { Alert.alert('Error', 'Could not update user'); return }
            fetchUsers()
          } catch (error) {
            Alert.alert('Error', 'Could not update user')
          }
        }}
      ]
    )
  }

  const handleDelete = (userId: string, name: string) => {
    Alert.alert('Delete User', `Permanently delete ${name}'s account? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken()
          const res = await fetch(BASE_URL + '/admin/users/' + userId, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token },
          })
          const data = await res.json()
          if (!res.ok) { Alert.alert('Could not delete user', data?.message || 'Please try again.'); return }
          fetchUsers()
        } catch (error) {
          Alert.alert('Error', 'Could not delete user')
        }
      }},
    ])
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'premium' ? u.isPremium : !u.isPremium)
    return matchSearch && matchFilter
  })

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Users</Text>
        <Text style={[s.count, { color: colors.isLight ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>{users.length} total</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search users..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.filterRow}>
          {(['all','premium','free'] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={[s.filterBtn, { backgroundColor: filter===f ? colors.primary : colors.card, borderColor: filter===f ? colors.primary : colors.border }]}>
              <Text style={[s.filterText, { color: filter===f ? '#fff' : colors.textSecondary }]}>{f.charAt(0).toUpperCase()+f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {loading ? (
          <Text style={[{ color: colors.textSecondary, textAlign: 'center', padding: 32 }]}>Loading users...</Text>
        ) : filtered.map(user => (
          <View key={user.id} style={[s.userCard, { backgroundColor: colors.card, borderColor: user.deletionRequested ? colors.danger : colors.border }]}>
            {user.deletionRequested && (
              <View style={[s.deletionBanner, { backgroundColor: colors.danger + '15' }]}>
                <Ionicons name="warning" size={13} color={colors.danger} />
                <Text style={[s.deletionBannerText, { color: colors.danger }]}>Requested account deletion</Text>
              </View>
            )}
            <View style={s.userTop}>
              <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                <Text style={s.avatarText}>{user.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.userName, { color: colors.text }]}>{user.name}</Text>
                <Text style={[s.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
              </View>
              {user.deletionRequested && (
                <Ionicons name="warning" size={18} color={colors.danger} style={{ marginRight: user.isPremium ? 6 : 0 }} />
              )}
              {user.isPremium && <View style={[s.premBadge, { backgroundColor: colors.gold+'20' }]}><Text style={[s.premText, { color: colors.gold }]}>⭐ Premium</Text></View>}
            </View>
            <View style={s.userStats}>
              <View style={[s.tierChip, { backgroundColor: colors.accent+'15' }]}>
                <Text style={[s.tierText, { color: colors.accent }]}>{user.tier}</Text>
              </View>
              <Text style={[s.balanceText, { color: colors.text }]}>${user.balance?.toLocaleString()} virtual</Text>
              <Text style={[s.tradesText, { color: colors.textSecondary }]}>{user._count?.trades || 0} trades</Text>
            </View>
            <View style={s.actionRow}>
              <TouchableOpacity
                onPress={() => handleToggleStatus(user.id, user.isPremium, user.name)}
                style={[s.actionBtn, { backgroundColor: user.isPremium ? colors.danger+'15' : colors.gold+'15', borderColor: user.isPremium ? colors.danger+'40' : colors.gold+'40' }]}>
                <Ionicons name={user.isPremium ? 'close-circle-outline' : 'star-outline'} size={14} color={user.isPremium ? colors.danger : colors.gold} />
                <Text style={[s.actionText, { color: user.isPremium ? colors.danger : colors.gold }]}>
                  {user.isPremium ? 'Cancel Subscription' : 'Grant Premium'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(user.id, user.name)}
                style={[s.actionBtn, { backgroundColor: colors.danger+'15', borderColor: colors.danger+'40' }]}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={[s.actionText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  count: { fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, height: 42, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  userCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  deletionBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  deletionBannerText: { fontSize: 11, fontWeight: '700' },
  userTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userName: { fontSize: 14, fontWeight: '600' },
  userEmail: { fontSize: 11, marginTop: 2 },
  premBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  premText: { fontSize: 10, fontWeight: '700' },
  userStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { fontSize: 11, fontWeight: '700' },
  balanceText: { fontSize: 12, fontWeight: '600' },
  tradesText: { fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionText: { fontSize: 11, fontWeight: '700' },
})
