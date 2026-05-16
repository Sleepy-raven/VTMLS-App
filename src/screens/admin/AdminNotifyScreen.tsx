import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, StatusBar, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { getToken } from '../../services/api'
import { BASE_URL } from '../../config'

const AUDIENCES = [
  { id: 'all', label: 'All Users' },
  { id: 'premium', label: 'Premium Only' },
  { id: 'free', label: 'Free Only' },
] as const

export default function AdminNotifyScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'all' | 'premium' | 'free'>('all')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Please fill in a title and message.')
      return
    }
    setSending(true)
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert('Could not send', data?.message || 'Please try again.'); return }
      if ((data.sent || 0) === 0) {
        Alert.alert('No devices to notify', data.message || 'No users in this audience have notifications enabled yet.')
      } else {
        Alert.alert('Sent', `Notification delivered to ${data.sent} of ${data.total} device(s).`)
        setTitle(''); setBody('')
      }
    } catch (error) {
      Alert.alert('Error', 'Could not send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Send Notification</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.hint, { color: colors.textSecondary }]}>
          Sends a real push notification to every user's device that has notifications enabled. Users who haven't granted permission won't receive it.
        </Text>

        <Text style={[s.label, { color: colors.textSecondary }]}>Audience</Text>
        <View style={s.audienceRow}>
          {AUDIENCES.map(a => (
            <TouchableOpacity key={a.id} onPress={() => setAudience(a.id)}
              style={[s.audienceBtn, { backgroundColor: audience === a.id ? colors.primary : colors.card, borderColor: audience === a.id ? colors.primary : colors.border }]}>
              <Text style={[s.audienceText, { color: audience === a.id ? '#fff' : colors.textSecondary }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { color: colors.textSecondary }]}>Title</Text>
        <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={title} onChangeText={setTitle} placeholder="e.g. New Premium Feature!" placeholderTextColor={colors.textMuted} maxLength={65} />

        <Text style={[s.label, { color: colors.textSecondary }]}>Message</Text>
        <TextInput style={[s.input, s.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={body} onChangeText={setBody} placeholder="Notification message" placeholderTextColor={colors.textMuted} multiline numberOfLines={5} maxLength={178} />

        <TouchableOpacity style={[s.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend} disabled={sending}>
          <Ionicons name="paper-plane-outline" size={16} color="#fff" />
          <Text style={s.sendBtnText}>{sending ? 'Sending...' : 'Send Notification'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  audienceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  audienceBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  audienceText: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { height: 110, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, marginBottom: 40, borderRadius: 12, padding: 14 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
