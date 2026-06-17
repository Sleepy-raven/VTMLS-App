import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, StatusBar, Alert, Modal, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

export default function AdminChallengesScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('')
  const [cashPrize, setCashPrize] = useState('')
  const [total, setTotal] = useState('')
  const [isPremium, setIsPremium] = useState(false)

  const fetchChallenges = async () => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/challenges', { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      setChallenges(data.challenges || [])
    } catch (error) {
      console.log('Admin challenges error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchChallenges() }, [])

  const resetForm = () => { setTitle(''); setReward(''); setCashPrize(''); setTotal(''); setIsPremium(false) }

  const handleCreate = async () => {
    if (!title.trim() || !reward.trim() || !total.trim()) {
      Alert.alert('Missing fields', 'Please fill in title, reward and total.')
      return
    }
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: title.trim(), reward: reward.trim(), cashPrize: cashPrize.trim() || null, total: parseInt(total, 10) || 0, isPremium }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert('Could not create challenge', data?.message || 'Please try again.'); return }
      setShowAdd(false)
      resetForm()
      fetchChallenges()
    } catch (error) {
      Alert.alert('Error', 'Could not create challenge')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: number, title: string) => {
    Alert.alert('Delete Challenge', `Remove "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken()
          const res = await fetch(BASE_URL + '/admin/challenges/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
          if (!res.ok) { Alert.alert('Error', 'Could not delete challenge'); return }
          fetchChallenges()
        } catch (error) {
          Alert.alert('Error', 'Could not delete challenge')
        }
      }},
    ])
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text, flex: 1 }]}>Manage Challenges</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={[s.addBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 32 }}>Loading challenges...</Text>
        ) : challenges.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 32 }}>No challenges yet</Text>
        ) : challenges.map((c: any) => (
          <View key={c.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{c.title}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <Text style={[s.meta, { color: colors.textSecondary }]}>{c.reward}</Text>
                {c.cashPrize && <Text style={[s.meta, { color: colors.accent }]}>{c.cashPrize}</Text>}
                <Text style={[s.meta, { color: colors.textMuted }]}>Target: {c.total}</Text>
                {c.isPremium && <Text style={[s.premBadge, { color: colors.gold }]}>⭐ Premium</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDelete(c.id, c.title)} style={s.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.text }]}>New Challenge</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, { color: colors.textSecondary }]}>Title</Text>
            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={title} onChangeText={setTitle} placeholder="Challenge title" placeholderTextColor={colors.textMuted} />

            <Text style={[s.label, { color: colors.textSecondary }]}>Reward</Text>
            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={reward} onChangeText={setReward} placeholder="e.g. Complete 10 trades" placeholderTextColor={colors.textMuted} />

            <Text style={[s.label, { color: colors.textSecondary }]}>Cash Prize (optional)</Text>
            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={cashPrize} onChangeText={setCashPrize} placeholder="e.g. $50" placeholderTextColor={colors.textMuted} />

            <Text style={[s.label, { color: colors.textSecondary }]}>Target Total</Text>
            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={total} onChangeText={setTotal} placeholder="e.g. 10" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />

            <View style={[s.switchRow]}>
              <Text style={[s.label, { color: colors.textSecondary, marginBottom: 0 }]}>Premium only</Text>
              <Switch value={isPremium} onValueChange={setIsPremium} trackColor={{ true: colors.primary }} />
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleCreate} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'Creating...' : 'Create Challenge'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  addBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 11 },
  premBadge: { fontSize: 10, fontWeight: '700' },
  deleteBtn: { padding: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  saveBtn: { marginTop: 24, marginBottom: 40, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
