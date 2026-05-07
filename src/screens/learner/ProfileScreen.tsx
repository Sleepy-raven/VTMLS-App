import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert, Platform, Modal, Switch, Linking, TextInput, KeyboardAvoidingView, ActivityIndicator, Image } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import PremiumModal from '../../components/PremiumModal'
import ThemeSelector from '../../components/ThemeSelector'
import { authAPI, getToken, learnAPI, tradeAPI, paymentAPI } from '../../services/api'
// SDK 54 deprecated downloadAsync/writeAsStringAsync in the new expo-file-system API in
// favor of File/Directory classes — importing the legacy module keeps this code working as-is.
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { BASE_URL } from '../../config'

// Hermes (RN's JS engine) has no built-in btoa/Buffer for binary data, so PDF bytes need a
// manual base64 encoder before FileSystem.writeAsStringAsync can save them.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function bytesToBase64(bytes: Uint8Array): string {
  let result = ''
  let i = 0
  for (; i + 3 <= bytes.length; i += 3) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
    result += BASE64_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)]
    result += BASE64_CHARS[bytes[i + 2] & 63]
  }
  const remaining = bytes.length - i
  if (remaining === 1) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[(bytes[i] & 3) << 4]
    result += '=='
  } else if (remaining === 2) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
    result += BASE64_CHARS[(bytes[i + 1] & 15) << 2]
    result += '='
  }
  return result
}

const TIERS = ['Beginner', 'Intermediate', 'Advanced']

const XP_TIERS: Record<string, { max: number; next: string }> = {
  Beginner:     { max: 500,  next: 'Intermediate' },
  Intermediate: { max: 1000, next: 'Advanced'     },
  Advanced:     { max: 1000, next: 'Advanced'      },
}

export default function ProfileScreen() {
  const { colors } = useTheme()
  const { user, logout, upgradeToPremium, refreshUser, updateProfile } = useAuth()
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhotoBase64, setEditPhotoBase64] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [showPremium, setShowPremium] = useState(false)
  const [cancellingSub, setCancellingSub] = useState(false)
  const [resetting, setResetting] = useState(false)
 const [tradeHistory, setTradeHistory] = useState<any[]>([])
  const [lessonProgress, setLessonProgress] = useState<any[]>([])
  const [certProgress, setCertProgress] = useState<any>({
    forexFundamentals: { completed: 0, total: 0, earned: false },
    certifiedForexTrader: { completed: 0, total: 0, earned: false },
  })
  const [downloadingCert, setDownloadingCert] = useState<string | null>(null)
  const [showDeleteCode, setShowDeleteCode] = useState(false)
  const [deleteCode, setDeleteCode] = useState('')
  const [requestingDeletion, setRequestingDeletion] = useState(false)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const [openTradesCount, setOpenTradesCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState(true)
  const [tradeAlerts, setTradeAlerts] = useState(true)
  const [newsAlerts, setNewsAlerts] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('vmlts_notif_prefs').then(raw => {
      if (raw) {
        const p = JSON.parse(raw)
        setPriceAlerts(p.priceAlerts ?? true)
        setTradeAlerts(p.tradeAlerts ?? true)
        setNewsAlerts(p.newsAlerts ?? false)
      }
    })
  }, [])

  const savePrefs = (next: { priceAlerts: boolean; tradeAlerts: boolean; newsAlerts: boolean }) => {
    AsyncStorage.setItem('vmlts_notif_prefs', JSON.stringify(next))
  }

  const tierIndex = TIERS.indexOf(user?.tier || 'Beginner')
  const tierProgress = ((tierIndex + 1) / TIERS.length) * 100
  const tier = user?.tier || 'Beginner'

  // XP computed from trade history
  const wins = tradeHistory.filter((t: any) => (t.pnl || 0) > 0).length
  const xp = tradeHistory.length * 20 + wins * 10
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const pnlToday = tradeHistory
    .filter((t: any) => t.closedAt && new Date(t.closedAt) >= todayStart)
    .reduce((s: number, t: any) => s + (t.pnl || 0), 0)
  const tierInfo = XP_TIERS[tier] || XP_TIERS['Beginner']
  const xpCapped = Math.min(xp, tierInfo.max)

  useFocusEffect(
    useCallback(() => {
    const init = async () => {
      try {
        const profileData = await authAPI.getProfile()
        const u = profileData.user
        upgradeToPremium({
          id: u.id, name: u.name, email: u.email,
          role: u.role.toLowerCase(), isPremium: u.isPremium,
          balance: u.balance,
          tier: u.tier.charAt(0) + u.tier.slice(1).toLowerCase(),
        })
      } catch (error) { console.log('Profile refresh error:', error) }
    }
    init()

    const loadStats = async () => {
      try {
        const histData = await tradeAPI.getTradeHistory()
        setTradeHistory(histData.trades || [])
      } catch (error) { console.log('Trade history fetch error:', error) }
      try {
        const openData = await tradeAPI.getOpenTrades()
        setOpenTradesCount((openData.trades || []).length)
      } catch (error) { console.log('Open trades fetch error:', error) }
      try {
        const progressData = await learnAPI.getLessonProgress()
        setLessonProgress(progressData.progress || [])
      } catch (error) { console.log('Lesson progress fetch error:', error) }
      try {
        const certData = await learnAPI.getCertificateProgress()
        setCertProgress(certData)
      } catch (error) { console.log('Certificate progress fetch error:', error) }
    }
    loadStats()
    }, [])
  )

  const handleResetBalance = () => {
    Alert.alert(
      'Reset Balance',
      'This will reset your balance to ' + (user?.isPremium ? '$10,000' : '$1,000') + ' and close all open trades. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: async () => {
            setResetting(true)
            try {
              const token = await getToken()
              const res = await fetch(BASE_URL + '/auth/reset-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              })
              const data = await res.json()
              if (res.ok) {
                upgradeToPremium({ ...user!, balance: data.balance })
                Alert.alert('Done', 'Balance reset to $' + data.balance.toLocaleString())
              } else {
                Alert.alert('Error', data.message || 'Reset failed')
              }
            } catch (error) {
              Alert.alert('Error', 'Could not reset balance')
            } finally { setResetting(false) }
          },
        },
      ]
    )
  }

  const handleDownloadCertificate = async (type: 'forexFundamentals' | 'certifiedForexTrader', title: string) => {
    console.log('[cert] download tapped:', type)
    setDownloadingCert(type)
    try {
      const token = await getToken()
      const fileUri = FileSystem.documentDirectory + title.replace(/\s+/g, '_') + '.pdf'
      const url = BASE_URL + '/learn/certificates/' + type + '/download'
      console.log('[cert] fetching from:', url)

      // POST with the name in a JSON body, not a URL query string — the learner's display
      // name can contain emoji/unicode that percent-encodes to multi-byte sequences the
      // server was rejecting with a 403 before this even reached the certificate logic.
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: user?.name || 'VMLTS Learner' }),
      })
      console.log('[cert] fetch status:', res.status)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        Alert.alert('Not available', err.message || ('Server responded with status ' + res.status));
        return
      }

      const buffer = await res.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const base64 = bytesToBase64(bytes)
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
      console.log('[cert] wrote file:', fileUri, bytes.byteLength, 'bytes')

      const canShare = await Sharing.isAvailableAsync()
      console.log('[cert] sharing available:', canShare)
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: title })
      } else {
        Alert.alert('Downloaded', 'Certificate saved.')
      }
    } catch (error: any) {
      console.log('[cert] download error:', error)
      Alert.alert('Error', error?.message || 'Could not download certificate')
    } finally {
      setDownloadingCert(null)
    }
  }

  const handleRequestDeletion = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your VMLTS account, including your balance, trade history, and progress. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: async () => {
          setRequestingDeletion(true)
          try {
            await authAPI.requestDeletionCode()
            setDeleteCode('')
            setShowDeleteCode(true)
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Could not send verification code. Please try again.')
          } finally {
            setRequestingDeletion(false)
          }
        }},
      ]
    )
  }

  const handleConfirmDeletion = async () => {
    if (!deleteCode.trim()) {
      Alert.alert('Missing code', 'Please enter the code sent to your email.')
      return
    }
    setConfirmingDeletion(true)
    try {
      await authAPI.confirmDeletion(deleteCode.trim())
      setShowDeleteCode(false)
      setDeleteCode('')
      Alert.alert('Request sent', 'Your account deletion request has been sent to our team for review.')
    } catch (error: any) {
      Alert.alert('Invalid code', error?.message || 'Please check the code and try again.')
    } finally {
      setConfirmingDeletion(false)
    }
  }

  const openEditProfile = () => {
    setEditName(user?.name || '')
    setEditPhotoBase64(null)
    setShowEditProfile(true)
  }

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    })
    if (!result.canceled && result.assets?.[0]?.base64) {
      setEditPhotoBase64(result.assets[0].base64)
    }
  }

  const handleSaveProfile = async () => {
    const trimmed = editName.trim()
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name.')
      return
    }
    const fields: { name?: string; profilePhoto?: string } = {}
    if (trimmed !== user?.name) fields.name = trimmed
    if (editPhotoBase64) fields.profilePhoto = editPhotoBase64
    if (!fields.name && !fields.profilePhoto) {
      setShowEditProfile(false)
      return
    }
    setSavingProfile(true)
    try {
      const result = await updateProfile(fields)
      if (!result.success) {
        Alert.alert('Error', result.error || 'Could not update profile')
        return
      }
      setShowEditProfile(false)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Cancel your Premium subscription? You\'ll immediately lose access to premium lessons, full news coverage, theme styles and advanced analytics.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        { text: 'Cancel Subscription', style: 'destructive', onPress: async () => {
          setCancellingSub(true)
          try {
            await paymentAPI.cancelSubscription()
            await refreshUser()
            Alert.alert('Subscription Cancelled', 'You are now on the Free plan.')
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Could not cancel subscription. Please try again.')
          } finally {
            setCancellingSub(false)
          }
        }},
      ]
    )
  }

  const closeChangePw = () => {
    setShowChangePw(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert('Missing fields', 'Please fill in all three fields.')
      return
    }
    if (!(newPw.length >= 6 && /[A-Za-z]/.test(newPw) && /[0-9\W_]/.test(newPw))) {
      Alert.alert('Weak password', 'Password must be at least 6 characters and include letters and numbers or symbols.')
      return
    }
    if (newPw !== confirmPw) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.')
      return
    }
    setChangingPw(true)
    try {
      await authAPI.changePassword(currentPw, newPw)
      closeChangePw()
      Alert.alert('Success', 'Your password has been changed.')
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not change password. Try again.')
    } finally {
      setChangingPw(false)
    }
  }

  // Initials for avatar
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

        {/* User Card */}
        <TouchableOpacity activeOpacity={0.7} onPress={openEditProfile} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {user?.profilePhoto
              ? <Image source={{ uri: 'data:image/jpeg;base64,' + user.profilePhoto }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{initials}</Text>}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              <Ionicons name="pencil" size={10} color="#fff" />
            </View>
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            <Text style={[styles.userTierXp, { color: colors.primary }]}>
              {tier + ' Trader · ' + xpCapped + ' XP'}
            </Text>
          </View>
          {user?.isPremium
            ? <View style={[styles.proBadge, { backgroundColor: colors.gold + '20', borderColor: colors.gold + '40' }]}>
                <Ionicons name="star" size={11} color={colors.gold} />
                <Text style={[styles.proBadgeText, { color: colors.gold }]}>PRO</Text>
              </View>
            : <TouchableOpacity style={[styles.proBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '30' }]} onPress={() => setShowPremium(true)}>
                <Text style={[styles.proBadgeText, { color: colors.primary }]}>Upgrade</Text>
              </TouchableOpacity>
          }
        </TouchableOpacity>

        {/* Portfolio Stats */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Portfolio</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Balance',     value: '$' + (user?.balance || 0).toLocaleString(), color: colors.primary },
            { label: 'P&L Today',   value: (pnlToday >= 0 ? '+$' : '-$') + Math.abs(pnlToday).toFixed(2), color: pnlToday >= 0 ? colors.accent : colors.danger },
            { label: 'Win Rate',    value: tradeHistory.length > 0 ? Math.round((wins / tradeHistory.length) * 100) + '%' : '0%', color: colors.warning },
            { label: 'Open Trades', value: String(openTradesCount),                     color: colors.text    },
          ].map(stat => (
            <View key={stat.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.resetBtn, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}
          onPress={handleResetBalance} disabled={resetting}>
          <Ionicons name="refresh-outline" size={18} color={colors.warning} />
          <Text style={[styles.resetBtnText, { color: colors.warning }]}>
            {resetting ? 'Resetting...' : 'Reset Balance to ' + (user?.isPremium ? '$10,000' : '$1,000')}
          </Text>
        </TouchableOpacity>

        {/* Risk Profile */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Risk Profile</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tierHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
            <Text style={[styles.tierTitle, { color: colors.text }]}>{tier} Trader</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: tierProgress + '%' as any, backgroundColor: colors.accent }]} />
          </View>
          <View style={styles.tierSteps}>
            {TIERS.map((t, i) => (
              <View key={t} style={styles.tierStep}>
                <View style={[styles.tierDot, { backgroundColor: i <= tierIndex ? colors.accent : colors.border }]} />
                <Text style={[styles.tierLabel, { color: i <= tierIndex ? colors.accent : colors.textMuted }]}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.tierHint, { color: colors.textSecondary }]}>Complete challenges to advance your tier</Text>
        </View>

        {/* Certificates */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Certificates</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.certRow}>
            <View style={[styles.certIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="ribbon" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.certTitle, { color: colors.text }]}>Forex Fundamentals</Text>
              <Text style={[styles.certSub, { color: colors.textSecondary }]}>
                {certProgress.forexFundamentals.earned
                  ? 'Unlocked! 🎉'
                  : `${certProgress.forexFundamentals.completed}/${certProgress.forexFundamentals.total} basic lessons completed`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.dlBtn, { backgroundColor: colors.primary + '20', opacity: certProgress.forexFundamentals.earned ? 1 : 0.5 }]}
              disabled={!certProgress.forexFundamentals.earned || downloadingCert === 'forexFundamentals'}
              onPress={() => handleDownloadCertificate('forexFundamentals', 'Forex Fundamentals Certificate')}>
              {downloadingCert === 'forexFundamentals'
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="download-outline" size={16} color={colors.primary} />}
            </TouchableOpacity>
          </View>
          <View style={[styles.certDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.certRow, { opacity: user?.isPremium ? 1 : 0.5 }]}>
            <View style={[styles.certIcon, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name="ribbon" size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.certTitle, { color: colors.text }]}>Certified Forex Trader</Text>
              <Text style={[styles.certSub, { color: colors.textSecondary }]}>
                {!user?.isPremium
                  ? '🔒 Premium only'
                  : certProgress.certifiedForexTrader.earned
                    ? 'Unlocked! 🎉'
                    : `${certProgress.certifiedForexTrader.completed}/${certProgress.certifiedForexTrader.total} advanced lessons completed`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.dlBtn, { backgroundColor: colors.gold + '20', opacity: (user?.isPremium && certProgress.certifiedForexTrader.earned) ? 1 : 0.5 }]}
              disabled={!user?.isPremium || !certProgress.certifiedForexTrader.earned || downloadingCert === 'certifiedForexTrader'}
              onPress={() => {
                if (!user?.isPremium) { setShowPremium(true); return }
                if (certProgress.certifiedForexTrader.earned) handleDownloadCertificate('certifiedForexTrader', 'Certified Forex Trader Certificate')
              }}>
              {downloadingCert === 'certifiedForexTrader'
                ? <ActivityIndicator size="small" color={colors.gold} />
                : <Ionicons name={user?.isPremium ? 'download-outline' : 'lock-closed'} size={16} color={colors.gold} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
        <ThemeSelector onShowPremium={() => setShowPremium(true)} />

        {/* Settings */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
   {[
            { icon: 'notifications-outline', label: 'Notifications',   onPress: () => setShowNotifications(true) },
            { icon: 'lock-closed-outline',   label: 'Change Password', onPress: () => setShowChangePw(true) },
            { icon: 'help-circle-outline',   label: 'Help & Support',  onPress: () => setShowHelp(true) },
          ].map((item, i) => (
            <TouchableOpacity key={item.label} onPress={item.onPress}
              style={[styles.menuItem, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Ionicons name={item.icon as any} size={18} color={colors.textSecondary} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancel Subscription — only shown to premium users */}
        {user?.isPremium && (
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40', marginBottom: 12 }]}
            onPress={handleCancelSubscription}
            disabled={cancellingSub}>
            <Ionicons name="close-circle-outline" size={18} color={colors.warning} />
            <Text style={[styles.signOutText, { color: colors.warning }]}>
              {cancellingSub ? 'Cancelling...' : 'Cancel Subscription'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '40' }]} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '40', marginTop: 12 }]}
          onPress={handleRequestDeletion}
          disabled={requestingDeletion}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>
            {requestingDeletion ? 'Sending code...' : 'Delete Account'}
          </Text>
        </TouchableOpacity>

   </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Notifications</Text>

            {[
              { label: 'Price Alerts', sub: 'Get notified on major price moves', value: priceAlerts, set: setPriceAlerts, key: 'priceAlerts' },
              { label: 'Trade Alerts', sub: 'Updates when your trades open or close', value: tradeAlerts, set: setTradeAlerts, key: 'tradeAlerts' },
              { label: 'News Alerts', sub: 'Breaking market news notifications', value: newsAlerts, set: setNewsAlerts, key: 'newsAlerts' },
            ].map(row => (
              <View key={row.label} style={styles.notifRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifLabel, { color: colors.text }]}>{row.label}</Text>
                  <Text style={[styles.notifSub, { color: colors.textSecondary }]}>{row.sub}</Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={(v) => {
                    row.set(v)
                    savePrefs({
                      priceAlerts: row.key === 'priceAlerts' ? v : priceAlerts,
                      tradeAlerts: row.key === 'tradeAlerts' ? v : tradeAlerts,
                      newsAlerts: row.key === 'newsAlerts' ? v : newsAlerts,
                    })
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            ))}

            <TouchableOpacity onPress={() => setShowNotifications(false)} style={[styles.sheetCloseBtn, { backgroundColor: colors.border }]}>
              <Text style={[styles.sheetCloseTxt, { color: colors.text }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={closeChangePw}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Change Password</Text>

              <Text style={[styles.pwLabel, { color: colors.textSecondary }]}>Current Password</Text>
              <TextInput
                style={[styles.pwInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={currentPw}
                onChangeText={setCurrentPw}
              />

              <Text style={[styles.pwLabel, { color: colors.textSecondary }]}>New Password</Text>
              <TextInput
                style={[styles.pwInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={newPw}
                onChangeText={setNewPw}
              />

              <Text style={[styles.pwLabel, { color: colors.textSecondary }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.pwInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={confirmPw}
                onChangeText={setConfirmPw}
              />

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={changingPw}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.primary, marginTop: 16, opacity: changingPw ? 0.7 : 1 }]}>
                <Text style={[styles.sheetCloseTxt, { color: '#fff' }]}>{changingPw ? 'Saving...' : 'Save New Password'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeChangePw} style={[styles.sheetCloseBtn, { backgroundColor: colors.border, marginTop: 10 }]}>
                <Text style={[styles.sheetCloseTxt, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Edit Profile</Text>

            <TouchableOpacity onPress={handlePickPhoto} style={{ alignSelf: 'center', marginBottom: 20 }}>
              <View style={[styles.editAvatarLarge, { backgroundColor: colors.primary }]}>
                {editPhotoBase64
                  ? <Image source={{ uri: 'data:image/jpeg;base64,' + editPhotoBase64 }} style={styles.editAvatarLargeImage} />
                  : user?.profilePhoto
                    ? <Image source={{ uri: 'data:image/jpeg;base64,' + user.profilePhoto }} style={styles.editAvatarLargeImage} />
                    : <Text style={styles.editAvatarLargeText}>{initials}</Text>}
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.card, width: 26, height: 26, borderRadius: 13, bottom: 0, right: 0 }]}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              </View>
              <Text style={[styles.pwLabel, { color: colors.primary, textAlign: 'center', marginTop: 8 }]}>Change Photo</Text>
            </TouchableOpacity>

            <Text style={[styles.pwLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.pwInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={editName}
              onChangeText={setEditName}
            />

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={savingProfile}
              style={[styles.sheetCloseBtn, { backgroundColor: colors.primary, marginTop: 16, opacity: savingProfile ? 0.7 : 1 }]}>
              <Text style={[styles.sheetCloseTxt, { color: '#fff' }]}>{savingProfile ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowEditProfile(false)} style={[styles.sheetCloseBtn, { backgroundColor: colors.border, marginTop: 10 }]}>
              <Text style={[styles.sheetCloseTxt, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account — verification code Modal */}
      <Modal visible={showDeleteCode} transparent animationType="slide" onRequestClose={() => setShowDeleteCode(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Confirm Account Deletion</Text>
            <Text style={[styles.pwLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
              We sent a 6-digit verification code to {user?.email || 'your email'}. Enter it below to send your deletion request to our team.
            </Text>

            <Text style={[styles.pwLabel, { color: colors.textSecondary }]}>Verification Code</Text>
            <TextInput
              style={[styles.pwInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={deleteCode}
              onChangeText={setDeleteCode}
            />

            <TouchableOpacity
              onPress={handleConfirmDeletion}
              disabled={confirmingDeletion}
              style={[styles.sheetCloseBtn, { backgroundColor: colors.danger, marginTop: 16, opacity: confirmingDeletion ? 0.7 : 1 }]}>
              <Text style={[styles.sheetCloseTxt, { color: '#fff' }]}>{confirmingDeletion ? 'Confirming...' : 'Confirm Deletion Request'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowDeleteCode(false)} style={[styles.sheetCloseBtn, { backgroundColor: colors.border, marginTop: 10 }]}>
              <Text style={[styles.sheetCloseTxt, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Help & Support Modal */}
      <Modal visible={showHelp} transparent animationType="slide" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Help & Support</Text>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {[
                { q: 'How do I place a trade?', a: 'Go to Markets, pick an asset, open the Trade tab, set your lot size and tap Buy or Sell.' },
                { q: 'How do I reset my balance?', a: 'Go to Profile and tap "Reset Balance" under Portfolio.' },
                { q: 'Why is my chart missing indicators?', a: 'Add indicators manually using the toolbar inside the chart \u2014 tap the indicators icon on the TradingView chart.' },
                { q: 'How do I add an asset to my watchlist?', a: 'On the Home tab, tap the + next to WATCHLIST, or on Markets \u2192 Quotes, select "My Assets" and tap the +.' },
                { q: 'How are lessons and challenges scored?', a: 'Lessons are marked complete when you finish reading and tap "Mark as Complete." Challenges track your real trading activity automatically \u2014 tap any challenge to see your progress.' },
                { q: 'What do the trade grades (A\u2013F) mean?', a: 'After closing a trade, you get a grade based on entry timing, stop-loss usage, risk/reward ratio, and exit timing. Tap a graded trade in your history to see the full breakdown.' },
                { q: 'How do I upgrade to Premium?', a: 'Tap "Upgrade" on your Profile or any "Unlock" banner around the app to see Premium plans and pricing.' },
                { q: 'How do I change my password?', a: 'Go to Profile \u2192 Change Password, enter your current password and a new one.' },
                { q: 'Is my trading real money?', a: 'No \u2014 VMLTS is a simulator. Your balance is virtual, used to practice trading strategies risk-free.' },
              ].map(item => (
                <View key={item.q} style={{ marginBottom: 14 }}>
                  <Text style={[styles.faqQ, { color: colors.text }]}>{item.q}</Text>
                  <Text style={[styles.faqA, { color: colors.textSecondary }]}>{item.a}</Text>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => Linking.openURL('mailto:jessetotimeh90@gmail.com')}
                style={[styles.contactBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Ionicons name="mail-outline" size={16} color={colors.primary} />
                <Text style={[styles.contactBtnTxt, { color: colors.primary }]}>Email Support</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity onPress={() => setShowHelp(false)} style={[styles.sheetCloseBtn, { backgroundColor: colors.border, marginTop: 10 }]}>
              <Text style={[styles.sheetCloseTxt, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '800' },
  userCard:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 20 },
  avatar:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  avatarImage:  { width: 52, height: 52, borderRadius: 26 },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  editAvatarLarge: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  editAvatarLargeImage: { width: 96, height: 96, borderRadius: 48 },
  editAvatarLargeText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  avatarText:   { color: '#fff', fontSize: 20, fontWeight: '800' },
  userName:     { fontSize: 16, fontWeight: '700' },
  userEmail:    { fontSize: 12, marginTop: 2 },
  userTierXp:   { fontSize: 11, fontWeight: '600', marginTop: 4 },
  proBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  proBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statBox:      { width: '47%', borderRadius: 10, padding: 12, borderWidth: 1 },
  statValue:    { fontSize: 16, fontWeight: '800' },
  statLabel:    { fontSize: 11, marginTop: 2 },
  resetBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  resetBtnText: { fontSize: 13, fontWeight: '700' },
  card:         { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 20 },
  tierHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tierTitle:    { fontSize: 14, fontWeight: '700' },
  progressBar:  { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 3 },
  tierSteps:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tierStep:     { alignItems: 'center', gap: 4 },
  tierDot:      { width: 10, height: 10, borderRadius: 5 },
  tierLabel:    { fontSize: 10, fontWeight: '600' },
  tierHint:     { fontSize: 11 },
  certRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  certIcon:     { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  certTitle:    { fontSize: 13, fontWeight: '600' },
  certSub:      { fontSize: 10, marginTop: 2 },
  dlBtn:        { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  certDivider:  { height: 1, marginVertical: 8 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  menuLabel:    { flex: 1, fontSize: 14 },
  signOutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 36 },
  signOutText:  { fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, maxHeight: '80%' },
  sheetTitle:   { fontSize: 17, fontWeight: '800', marginBottom: 18 },
  notifRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  notifLabel:   { fontSize: 14, fontWeight: '600' },
  notifSub:     { fontSize: 11, marginTop: 2 },
  sheetCloseBtn:{ padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  sheetCloseTxt:{ fontSize: 15, fontWeight: '700' },
  pwLabel:      { fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  pwInput:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  faqQ:         { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  faqA:         { fontSize: 12, lineHeight: 18 },
  contactBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  contactBtnTxt:{ fontSize: 13, fontWeight: '700' },
})