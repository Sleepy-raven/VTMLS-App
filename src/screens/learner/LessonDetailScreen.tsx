import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert, Dimensions, Image } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { learnAPI } from '../../services/api'
import PremiumModal from '../../components/PremiumModal'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function ContentBlock({ text, colors }: { text: string; colors: any }) {
  const t = text.trim()
  const sectionMatch = t.match(/^([A-Z][A-Z\s\/\(\)&]+?)(\s*[—–:]\s*)([\s\S]*)$/)
  if (sectionMatch) {
    const label = sectionMatch[1].trim()
    const body  = sectionMatch[3].trim()
    return (
      <View style={{ marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{label}</Text>
        </View>
        {body ? <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{body}</Text> : null}
      </View>
    )
  }
  return <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: 18 }}>{t}</Text>
}

function getKeyTakeaway(text: string): string {
  const t = text.trim()
  const sectionMatch = t.match(/^([A-Z][A-Z\s\/\(\)&]+?)(\s*[—–:]\s*)([\s\S]*)$/)
  const body = sectionMatch ? sectionMatch[3].trim() : t
  const match = body.match(/^.*?[.!?](?=\s|$)/)
  const firstSentence = match ? match[0] : body
  return firstSentence
}

interface QuizQuestion {
  q: string
  options: string[]
  correct: number
}

const PASS_THRESHOLD = 70

export default function LessonDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const { lesson, progress } = route.params
  const [completed, setCompleted] = useState(progress?.completed || false)
  const [marking, setMarking]     = useState(false)
  const [showPremium, setShowPremium] = useState(false)
  // YouTube's embed player can briefly show a "video unavailable"-style error inside a
  // WebView on first load (a content-level quirk, not a WebView load failure — onError never
  // fires for it). Simplest fix: don't load YouTube at all until the user taps play — show a
  // thumbnail instead, so there's nothing YouTube-branded on screen until they actually want
  // to watch, and the player only ever mounts on a real tap (which already worked fine).
  const [videoStarted, setVideoStarted] = useState(false)

  // Real access gate — LearnScreen already blocks tapping into a premium lesson for
  // non-premium users, but that's UI-only. This is the actual enforcement point, since a
  // deep link, restored navigation state, or any other path could otherwise reach this
  // screen directly with a premium lesson and bypass that tap-guard entirely.
  const locked = !!lesson.isPremium && !user?.isPremium

  const blocks = (lesson.content || '').split('\n\n').filter(Boolean)
  const takeaways = blocks.map(getKeyTakeaway).filter(Boolean)

  const quiz: QuizQuestion[] = useMemo(() => {
    if (!lesson.quizJson) return []
    try {
      const parsed = JSON.parse(lesson.quizJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [lesson.quizJson])

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(completed) // if already completed, treat as passed previously
  const [quizScore, setQuizScore] = useState<number | null>(completed ? 100 : null)

  const hasQuiz = quiz.length > 0
  const allAnswered = hasQuiz && quiz.every((_, i) => answers[i] !== undefined)
  const quizPassed = quizSubmitted && quizScore !== null && quizScore >= PASS_THRESHOLD
  const canMarkComplete = completed || !hasQuiz || quizPassed

  const submitQuiz = () => {
    let correctCount = 0
    quiz.forEach((q, i) => { if (answers[i] === q.correct) correctCount++ })
    const score = Math.round((correctCount / quiz.length) * 100)
    setQuizScore(score)
    setQuizSubmitted(true)
    if (score < PASS_THRESHOLD) {
      Alert.alert('Not quite there', `You scored ${score}%. You need ${PASS_THRESHOLD}%+ to pass. Review the lesson and try again.`)
    }
  }

  const retakeQuiz = () => {
    setAnswers({})
    setQuizSubmitted(false)
    setQuizScore(null)
  }

  const markComplete = async () => {
    if (completed || !canMarkComplete) return
    setMarking(true)
    try {
      await learnAPI.updateLessonProgress(String(lesson.id), 100)
      setCompleted(true)
      Alert.alert('Lesson Complete! 🎉', 'Your progress has been saved.')
    } catch {
      Alert.alert('Error', 'Could not save progress. Try again.')
    } finally {
      setMarking(false)
    }
  }

  const videoHeight = (SCREEN_WIDTH - 40) * (9 / 16)

  if (locked) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]} numberOfLines={1}>{lesson.title}</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gold + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="lock-closed" size={32} color={colors.gold} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Premium Lesson</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            Upgrade to Premium to unlock "{lesson.title}" and the rest of the advanced curriculum.
          </Text>
          <TouchableOpacity
            onPress={() => setShowPremium(true)}
            style={{ backgroundColor: colors.gold, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
        <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.isLight ? '#fff' : colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]} numberOfLines={1}>{lesson.title}</Text>
          <Text style={[styles.headerSub, { color: colors.isLight ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            {completed ? 'Completed' : 'In Progress'}
          </Text>
        </View>
        {completed && <Ionicons name="checkmark-circle" size={22} color="#10B981" />}
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: completed ? '100%' : hasQuiz && quizSubmitted ? '70%' : '10%' }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={[styles.introCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Ionicons name="book-outline" size={18} color={colors.primary} />
          <Text style={[styles.introText, { color: colors.primary }]}>
            {hasQuiz
              ? `Watch the video, read through the lesson, then pass the quiz (${PASS_THRESHOLD}%+) to mark it complete.`
              : 'Read through this lesson carefully. Tap "Mark Complete" when you\'re done.'}
          </Text>
        </View>

        {lesson.videoId && (
          <View style={[styles.videoWrap, { height: videoHeight, backgroundColor: '#000' }]}>
            {videoStarted ? (
              <WebView
                source={{ uri: `https://www.youtube.com/embed/${lesson.videoId}?playsinline=1&autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&origin=https://vmlts.app` }}
                style={{ flex: 1, backgroundColor: '#000' }}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
              />
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setVideoStarted(true)}
                style={{ flex: 1 }}>
                <Image
                  source={{ uri: `https://img.youtube.com/vi/${lesson.videoId}/hqdefault.jpg` }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={30} color="#111827" style={{ marginLeft: 3 }} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {blocks.map((block, i) => (
          <ContentBlock key={i} text={block} colors={colors} />
        ))}

        {takeaways.length > 0 && (
          <View style={[styles.takeawayCard, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '30' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="bulb" size={16} color={colors.accent} />
              <Text style={[styles.takeawayHeader, { color: colors.accent }]}>KEY TAKEAWAYS</Text>
            </View>
            {takeaways.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{i + 1}.</Text>
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {!lesson.content && (
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>Content coming soon.</Text>
        )}

        {hasQuiz && (
          <View style={[styles.quizCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="help-circle" size={18} color={colors.primary} />
              <Text style={[styles.quizHeader, { color: colors.text }]}>QUIZ — {quiz.length} QUESTIONS</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>
              Score {PASS_THRESHOLD}%+ to complete this lesson.
            </Text>

            {quiz.map((q, qi) => (
              <View key={qi} style={{ marginBottom: 20 }}>
                <Text style={[styles.quizQ, { color: colors.text }]}>{qi + 1}. {q.q}</Text>
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi
                  const showResult = quizSubmitted
                  const isCorrect = oi === q.correct
                  let bg = colors.background
                  let border = colors.border
                  let textColor = colors.text
                  if (showResult) {
                    if (isCorrect) { bg = colors.accent + '18'; border = colors.accent; textColor = colors.accent }
                    else if (selected && !isCorrect) { bg = colors.danger + '18'; border = colors.danger; textColor = colors.danger }
                  } else if (selected) {
                    bg = colors.primary + '18'; border = colors.primary; textColor = colors.primary
                  }
                  return (
                    <TouchableOpacity
                      key={oi}
                      disabled={quizSubmitted}
                      onPress={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                      style={[styles.quizOption, { backgroundColor: bg, borderColor: border }]}>
                      <Text style={{ fontSize: 13, color: textColor, fontWeight: selected || (showResult && isCorrect) ? '700' : '500' }}>{opt}</Text>
                      {showResult && isCorrect && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
                      {showResult && selected && !isCorrect && <Ionicons name="close-circle" size={16} color={colors.danger} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}

            {!quizSubmitted ? (
              <TouchableOpacity
                onPress={submitQuiz}
                disabled={!allAnswered}
                style={[styles.quizSubmitBtn, { backgroundColor: allAnswered ? colors.primary : colors.border }]}>
                <Text style={[styles.quizSubmitTxt, { color: allAnswered ? '#fff' : colors.textMuted }]}>Submit Quiz</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <View style={[styles.quizResultBox, { backgroundColor: quizPassed ? colors.accent + '15' : colors.warning + '15' }]}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: quizPassed ? colors.accent : colors.warning }}>
                    {quizPassed ? `Passed — ${quizScore}%` : `Score: ${quizScore}% — Try again`}
                  </Text>
                </View>
                {!quizPassed && (
                  <TouchableOpacity onPress={retakeQuiz} style={[styles.quizSubmitBtn, { backgroundColor: colors.primary, marginTop: 10 }]}>
                    <Text style={[styles.quizSubmitTxt, { color: '#fff' }]}>Retake Quiz</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={markComplete}
          disabled={completed || marking || !canMarkComplete}
          style={[styles.completeBtn, {
            backgroundColor: completed ? colors.accent + '20' : canMarkComplete ? colors.primary : colors.border,
            borderColor: completed ? colors.accent : 'transparent',
            borderWidth: completed ? 1 : 0,
          }]}>
          <Ionicons name={completed ? 'checkmark-circle' : 'flag'} size={18} color={completed ? colors.accent : canMarkComplete ? '#fff' : colors.textMuted} />
          <Text style={[styles.completeTxt, { color: completed ? colors.accent : canMarkComplete ? '#fff' : colors.textMuted }]}>
            {marking ? 'Saving...' : completed ? 'Lesson Completed' : hasQuiz && !quizPassed ? 'Pass the Quiz to Complete' : 'Mark as Complete'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  backBtn:       { padding: 4 },
  headerTitle:   { fontSize: 15, fontWeight: '800' },
  headerSub:     { fontSize: 10, marginTop: 2 },
  progressTrack: { height: 3, width: '100%' },
  progressFill:  { height: 3, borderRadius: 2 },
  introCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  introText:     { flex: 1, fontSize: 12, lineHeight: 18 },
  videoWrap:     { width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  takeawayCard:  { borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 24 },
  takeawayHeader:{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  completeBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  completeTxt:   { fontSize: 15, fontWeight: '700' },
  quizCard:      { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 24 },
  quizHeader:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  quizQ:         { fontSize: 14, fontWeight: '700', marginBottom: 10, lineHeight: 20 },
  quizOption:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  quizSubmitBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quizSubmitTxt: { fontSize: 14, fontWeight: '700' },
  quizResultBox: { borderRadius: 10, padding: 12, alignItems: 'center' },
})
