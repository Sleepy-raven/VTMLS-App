import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, StatusBar, Alert, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

export default function AdminMarketScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [intervalMs, setIntervalMs] = useState('')
  const [savedIntervalMs, setSavedIntervalMs] = useState<number | null>(null)
  const [savingInterval, setSavingInterval] = useState(false)

  const fetchAll = async () => {
    try {
      const token = await getToken()
      const [assetsRes, settingsRes] = await Promise.all([
        fetch(BASE_URL + '/admin/market/assets', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(BASE_URL + '/admin/market/settings', { headers: { Authorization: 'Bearer ' + token } }),
      ])
      const assetsData = await assetsRes.json()
      const settingsData = await settingsRes.json()
      setAssets(assetsData.assets || [])
      if (settingsData.tickIntervalMs) {
        setSavedIntervalMs(settingsData.tickIntervalMs)
        setIntervalMs(String(settingsData.tickIntervalMs))
      }
    } catch (error) {
      console.log('Admin market error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleToggleAsset = async (id: number, currentActive: boolean, symbol: string) => {
    setToggling(id)
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/market/assets/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (!res.ok) { Alert.alert('Error', 'Could not update ' + symbol); return }
      setAssets(prev => prev.map(a => a.id === id ? { ...a, active: !currentActive } : a))
    } catch (error) {
      Alert.alert('Error', 'Could not update ' + symbol)
    } finally {
      setToggling(null)
    }
  }

  const handleSaveInterval = async () => {
    const ms = parseInt(intervalMs, 10)
    if (!ms || ms < 250 || ms > 10000) {
      Alert.alert('Invalid interval', 'Enter a value between 250 and 10000 milliseconds.')
      return
    }
    setSavingInterval(true)
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/market/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tickIntervalMs: ms }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert('Error', data?.message || 'Could not update interval'); return }
      setSavedIntervalMs(ms)
      Alert.alert('Saved', 'Price updates now every ' + ms + 'ms. Takes effect within a couple seconds.')
    } catch (error) {
      Alert.alert('Error', 'Could not update interval')
    } finally {
      setSavingInterval(false)
    }
  }

  const activeCount = assets.filter(a => a.active).length

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text, flex: 1 }]}>Market Control</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Text style={[s.sectionLabel, { color: colors.text }]}>UPDATE INTERVAL</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.hint, { color: colors.textSecondary }]}>
            How often live prices tick, in milliseconds. Lower = faster-moving market. Current: {savedIntervalMs ? savedIntervalMs + 'ms' : '...'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <TextInput
              style={[s.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={intervalMs}
              onChangeText={setIntervalMs}
              keyboardType="number-pad"
              placeholder="1000"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              onPress={handleSaveInterval}
              disabled={savingInterval}
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: savingInterval ? 0.7 : 1 }]}>
              <Text style={s.saveBtnText}>{savingInterval ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: colors.text, marginTop: 20 }]}>
          ACTIVE ASSETS ({activeCount}/{assets.length})
        </Text>
        {loading ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 32 }}>Loading assets...</Text>
        ) : assets.map((a: any) => (
          <View key={a.id} style={[s.assetRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.symbol, { color: colors.text }]}>{a.symbol}</Text>
                {a.premiumOnly && <Text style={[s.premBadge, { color: colors.gold }]}>⭐ PRO</Text>}
              </View>
              <Text style={[s.meta, { color: colors.textSecondary }]}>
                Base {a.basePrice} · Pip {a.pip} · {a.active ? 'Live & tradeable' : 'Hidden from app'}
              </Text>
            </View>
            <Switch
              value={a.active}
              onValueChange={() => handleToggleAsset(a.id, a.active, a.symbol)}
              disabled={toggling === a.id}
              trackColor={{ true: colors.primary }}
            />
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
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1 },
  hint: { fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  assetRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  symbol: { fontSize: 14, fontWeight: '700' },
  premBadge: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 3 },
})
