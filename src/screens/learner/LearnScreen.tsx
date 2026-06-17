import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import PremiumModal from '../../components/PremiumModal'
import { learnAPI, tradeAPI } from '../../services/api'
import { useNavigation, useFocusEffect } from '@react-navigation/native'

export default function LearnScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<any>()
  const [showPremium, setShowPremium] = useState(false)
  const [lessons, setLessons] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [lessonProgress, setLessonProgress] = useState<any[]>([])
  const [challengeProgress, setChallengeProgress] = useState<any[]>([])
  const [claiming, setClaiming] = useState<number | null>(null)
  const [certProgress, setCertProgress] = useState<any>({
    forexFundamentals: { completed: 0, total: 0, earned: false },
    certifiedForexTrader: { completed: 0, total: 0, earned: false },
  })

  const fetchData = async () => {
    try {
      const [lessonsData, challengesData, progressData, chalProgData, certData] = await Promise.all([
        learnAPI.getLessons(),
        learnAPI.getChallenges(),
        learnAPI.getLessonProgress(),
        learnAPI.getChallengeProgress(),
        learnAPI.getCertificateProgress(),
      ])
      setLessons(lessonsData.lessons || [])
      setChallenges(challengesData.challenges || [])
      setLessonProgress(progressData.progress || [])
      setChallengeProgress(chalProgData.progress || [])
      setCertProgress(certData)
    } catch (error) {
      console.log('Learn fetch error:', error)
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      fetchData()
    }, [])
  )

  const handleClaim = async (challengeId: number, cashPrize: string) => {
    setClaiming(challengeId)
    try {
      const result = await tradeAPI.claimChallenge(challengeId)
      Alert.alert('Prize Claimed! 🎉', `${cashPrize} has been added to your balance.`)
      fetchData()
    } catch (error: any) {
      Alert.alert('Could not claim', error?.message || 'Please try again.')
    } finally {
      setClaiming(null)
    }
  }

  const freeLessons = lessons.filter((l: any) => !l.isPremium)
  const premiumLessons = lessons.filter((l: any) => l.isPremium)
  const freeChallenges = challenges.filter((c: any) => !c.isPremium)
  const premiumChallenges = challenges.filter((c: any) => c.isPremium)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Learn</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

        <View style={[styles.certCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
          <Ionicons name="ribbon" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.certTitle, { color: colors.text }]}>Forex Fundamentals Certificate</Text>
            <Text style={[styles.certSub, { color: colors.textSecondary }]}>
              {certProgress.forexFundamentals.earned ? 'Unlocked! 🎉' : `${certProgress.forexFundamentals.completed}/${certProgress.forexFundamentals.total} lessons completed`}
            </Text>
            <View style={[styles.certProgress, { backgroundColor: colors.border }]}>
              <View style={[styles.certFill, {
                width: (certProgress.forexFundamentals.total > 0
                  ? (certProgress.forexFundamentals.completed / certProgress.forexFundamentals.total) * 100
                  : 0) + '%' as any,
                backgroundColor: colors.primary,
              }]} />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.text }]}>MODULES</Text>
        {freeLessons.map((lesson: any) => {
          const prog = lessonProgress.find((p: any) => p.lessonId === lesson.id)
          return (
            <TouchableOpacity key={lesson.id}
              onPress={() => navigation.navigate('LessonDetail', { lesson, progress: prog })}
              style={[styles.lessonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.lessonIcon, { backgroundColor: prog?.completed ? colors.accent + '20' : colors.primary + '20' }]}>
                <Ionicons name={prog?.completed ? 'checkmark-circle' : 'book-outline'} size={20} color={prog?.completed ? colors.accent : colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.lessonTitle, { color: colors.text }]}>{lesson.title}</Text>
                {prog && !prog.completed && prog.progress > 0 && (
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { width: prog.progress + '%' as any, backgroundColor: colors.primary }]} />
                  </View>
                )}
              </View>
              {prog?.completed
                ? <View style={[styles.tag, { backgroundColor: colors.accent + '20' }]}><Text style={[styles.tagText, { color: colors.accent }]}>Done</Text></View>
                : <View style={[styles.tag, { backgroundColor: colors.border }]}><Text style={[styles.tagText, { color: colors.textMuted }]}>New</Text></View>
              }
            </TouchableOpacity>
          )
        })}

        <View style={styles.premiumSectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>PREMIUM — ADVANCED</Text>
          {!user?.isPremium && (
            <TouchableOpacity onPress={() => setShowPremium(true)}>
              <Text style={[styles.unlockText, { color: colors.gold }]}>Unlock ↗</Text>
            </TouchableOpacity>
          )}
        </View>

        {user?.isPremium && (
          <View style={[styles.certCard, { backgroundColor: colors.gold + '15', borderColor: colors.gold + '40', marginBottom: 12 }]}>
            <Ionicons name="ribbon" size={24} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.certTitle, { color: colors.text }]}>Certified Forex Trader</Text>
              <Text style={[styles.certSub, { color: colors.textSecondary }]}>
                {certProgress.certifiedForexTrader.earned ? 'Unlocked! 🎉' : `${certProgress.certifiedForexTrader.completed}/${certProgress.certifiedForexTrader.total} advanced lessons completed`}
              </Text>
              <View style={[styles.certProgress, { backgroundColor: colors.border }]}>
                <View style={[styles.certFill, {
                  width: (certProgress.certifiedForexTrader.total > 0
                    ? (certProgress.certifiedForexTrader.completed / certProgress.certifiedForexTrader.total) * 100
                    : 0) + '%' as any,
                  backgroundColor: colors.gold,
                }]} />
              </View>
            </View>
          </View>
        )}

        {premiumLessons.map((lesson: any) => (
          <TouchableOpacity key={lesson.id} onPress={() => !user?.isPremium ? setShowPremium(true) : navigation.navigate('LessonDetail', { lesson, progress: null })}
            style={[styles.lessonCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: user?.isPremium ? 1 : 0.6 }]}>
            <View style={[styles.lessonIcon, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name={user?.isPremium ? 'book-outline' : 'lock-closed'} size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.lessonTitle, { color: colors.text }]}>{lesson.title}</Text>
            </View>
            {!user?.isPremium
              ? <View style={[styles.tag, { backgroundColor: colors.gold + '20' }]}><Text style={[styles.tagText, { color: colors.gold }]}>PRO</Text></View>
              : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            }
          </TouchableOpacity>
        ))}

        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionDividerLabel, { color: colors.text }]}>CHALLENGES</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.text }]}>Free Challenges</Text>
        {freeChallenges.map((c: any) => {
          const prog = challengeProgress.find((p: any) => p.challengeId === c.id)
          const current = prog?.current || 0
          const total = c.total || 1
          const pct = Math.min(100, Math.round((current / total) * 100))
          const done = !!prog?.completed
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  c.title,
                  `${done ? 'Completed! 🎉' : `Progress: ${current}/${total}`}\n\nReward: ${c.reward}`
                )
              }
              style={[styles.chalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.chalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chalTitle, { color: colors.text }]}>{c.title}</Text>
                  <Text style={[styles.chalReward, { color: colors.primary }]}>🏅 {c.reward}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: done ? colors.accent + '20' : colors.primary + '20' }]}>
                  <Text style={[styles.tagText, { color: done ? colors.accent : colors.primary }]}>{done ? 'DONE' : 'ACTIVE'}</Text>
                </View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border, marginTop: 10 }]}>
                <View style={[styles.progressFill, { width: pct + '%' as any, backgroundColor: done ? colors.accent : colors.primary }]} />
              </View>
              <Text style={[styles.lessonDur, { color: colors.textSecondary, marginTop: 4 }]}>{current}/{total}</Text>
            </TouchableOpacity>
          )
        })}

        <View style={styles.premiumSectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Cash Prize Challenges 💰</Text>
          {!user?.isPremium && (
            <TouchableOpacity onPress={() => setShowPremium(true)}>
              <Text style={[styles.unlockText, { color: colors.gold }]}>Unlock ↗</Text>
            </TouchableOpacity>
          )}
        </View>

        {premiumChallenges.map((c: any) => {
          const prog = challengeProgress.find((p: any) => p.challengeId === c.id)
          const current = prog?.current || 0
          const total = c.total || 1
          const done = !!prog?.completed
          const claimed = !!prog?.paid
          const canClaim = done && !claimed && !!c.cashPrize
          return (
          <TouchableOpacity key={c.id}
            disabled={claiming === c.id}
            onPress={() => {
              if (!user?.isPremium) { setShowPremium(true); return }
              if (canClaim) { handleClaim(c.id, c.cashPrize); return }
              Alert.alert(c.title, `${done ? 'Completed! 🎉' : `Progress: ${current}/${total}`}\n\nReward: ${c.reward}${c.cashPrize ? `\nCash Prize: ${c.cashPrize}` : ''}`)
            }}
            style={[styles.chalCard, { backgroundColor: colors.card, borderColor: user?.isPremium ? colors.gold + '40' : colors.border, opacity: user?.isPremium ? 1 : 0.65 }]}>
            <View style={styles.chalTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chalTitle, { color: colors.text }]}>{c.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={[styles.chalReward, { color: colors.warning }]}>🏆 {c.reward}</Text>
                  {c.cashPrize && (
                    <View style={[styles.tag, { backgroundColor: colors.accent + '20' }]}>
                      <Text style={[styles.tagText, { color: colors.accent }]}>💵 {c.cashPrize}</Text>
                    </View>
                  )}
                </View>
              </View>
              {!user?.isPremium ? (
                <View style={[styles.tag, { backgroundColor: colors.gold + '20' }]}><Text style={[styles.tagText, { color: colors.gold }]}>PRO</Text></View>
              ) : canClaim ? (
                <View style={[styles.tag, { backgroundColor: '#22C55E' }]}>
                  <Text style={[styles.tagText, { color: '#fff' }]}>{claiming === c.id ? 'Claiming...' : 'Claim 💰'}</Text>
                </View>
              ) : claimed ? (
                <View style={[styles.tag, { backgroundColor: colors.accent + '20' }]}><Text style={[styles.tagText, { color: colors.accent }]}>Claimed ✓</Text></View>
              ) : (
                <View style={[styles.tag, { backgroundColor: colors.primary + '20' }]}><Text style={[styles.tagText, { color: colors.primary }]}>ACTIVE</Text></View>
              )}
            </View>
          </TouchableOpacity>
          )
        })}

      </ScrollView>
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  certCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 16, gap: 12 },
  certTitle: { fontSize: 13, fontWeight: '700' },
  certSub: { fontSize: 11, marginTop: 2 },
  certProgress: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  certFill: { height: '100%', borderRadius: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  premiumSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  unlockText: { fontSize: 12, fontWeight: '700' },
  lessonCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  lessonIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  lessonTitle: { fontSize: 13, fontWeight: '600' },
  lessonDur: { fontSize: 11, marginTop: 2 },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 9, fontWeight: '800' },
  sectionDivider: { borderTopWidth: 1, marginTop: 8, marginBottom: 4, paddingTop: 16 },
  sectionDividerLabel: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  chalCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  chalTop: { flexDirection: 'row', alignItems: 'flex-start' },
  chalTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  chalReward: { fontSize: 11, fontWeight: '600' },
})