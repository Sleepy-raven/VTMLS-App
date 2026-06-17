import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

export default function AdminPayoutsScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid')

  const fetchPayouts = async () => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/payouts', { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      setPayouts(data.payouts || [])
    } catch (error) {
      console.log('Admin payouts error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayouts() }, [])

  // Tapping the red button pays the user immediately (credits their balance server-side) —
  // no confirmation dialog, since this button *is* the admin's verification step.
  const handleMarkPaid = async (id: number) => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/payouts/' + id + '/mark-paid', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) { Alert.alert('Error', 'Could not update payout'); return }
      fetchPayouts()
    } catch (error) {
      Alert.alert('Error', 'Could not update payout')
    }
  }

  const filtered = payouts.filter(p => filter === 'all' ? true : filter === 'paid' ? p.paid : !p.paid)

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Prize Payouts</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
        {(['unpaid', 'paid', 'all'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[s.filterBtn, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}>
            <Text style={[s.filterText, { color: filter === f ? '#fff' : colors.textSecondary }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 32 }}>Loading payouts...</Text>
        ) : filtered.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 32 }}>
            {filter === 'unpaid' ? 'No pending payouts' : 'No payouts to show'}
          </Text>
        ) : filtered.map((p: any) => (
          <View key={p.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.userName, { color: colors.text }]}>{p.userName}</Text>
              <Text style={[s.userEmail, { color: colors.textSecondary }]}>{p.userEmail}</Text>
              <Text style={[s.challenge, { color: colors.accent }]}>{p.challengeTitle}</Text>
              {p.cashPrize && <Text style={[s.prize, { color: colors.gold }]}>{p.cashPrize}</Text>}
            </View>
            {p.paid ? (
              <View style={[s.statusBtn, { backgroundColor: '#22C55E' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={s.markBtnText}>Paid</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => handleMarkPaid(p.id)} style={[s.statusBtn, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="close-circle" size={14} color="#fff" />
                <Text style={s.markBtnText}>Not Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  userName: { fontSize: 14, fontWeight: '700' },
  userEmail: { fontSize: 11, marginTop: 1 },
  challenge: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  prize: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  markBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
