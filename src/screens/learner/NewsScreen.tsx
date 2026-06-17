import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Linking, ActivityIndicator, Modal } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import PremiumModal from '../../components/PremiumModal'
import { newsAPI } from '../../services/api'

// News sources sometimes include raw HTML (tags and entities) in headlines/summaries.
// Strip it so only plain, readable text is ever shown in the app.
const stripHtml = (s?: string) =>
  (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

const CATEGORIES = ['All', 'Forex', 'Gold', 'Indices', 'Oil']
const CATEGORY_COLORS: Record<string, string> = {
  Forex: '#3B82F6', Gold: '#F59E0B', Indices: '#8B5CF6', Oil: '#78716C',
  Crypto: '#F97316', General: '#9CA3AF',
}
const IMPACT_COLOR: Record<string, string> = {
  High: '#EF4444', Medium: '#F59E0B', Low: '#EAB308',
}

export default function NewsScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const [activeFilter, setActiveFilter] = useState('All')
  const [showPremium, setShowPremium] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [news, setNews] = useState<any[]>([])
  const [calendar, setCalendar] = useState<any[]>([])
 const [calLoading, setCalLoading] = useState(true)
  const [showForexFactory, setShowForexFactory] = useState(false)

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true)
      try {
        const data = await newsAPI.getNews(activeFilter === 'All' ? undefined : activeFilter)
        setNews(data.news || [])
      } catch (error) {
        console.log('News fetch error:', error)
        setNews([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchNews()
  }, [activeFilter])

  useEffect(() => {
    // Economic calendar is premium-only — don't even fetch it for free users.
    if (!user?.isPremium) {
      setCalendar([])
      setCalLoading(false)
      return
    }
    const fetchCalendar = async () => {
      setCalLoading(true)
      try {
        const data = await newsAPI.getCalendar()
        setCalendar(data.calendar || [])
      } catch (error) {
        console.log('Calendar fetch error:', error)
        setCalendar([])
      } finally {
        setCalLoading(false)
      }
    }
    fetchCalendar()
  }, [user?.isPremium])

  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || '#9CA3AF'
  const getImpactColor = (impact: string) => IMPACT_COLOR[impact] || '#9CA3AF'

  const formatCalTime = (dateTime: string) => {
    try {
      return new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return dateTime }
  }

  const formatCalDate = (dateTime: string) => {
    try {
      return new Date(dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  const calByDate: Record<string, any[]> = {}
  calendar.slice(0, 20).forEach(ev => {
    const date = formatCalDate(ev.dateTime)
    if (!calByDate[date]) calByDate[date] = []
    calByDate[date].push(ev)
  })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>News</Text>
          <Text style={[styles.headerSub, { color: colors.isLight ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>Live market news</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[styles.apiBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.apiText, { color: colors.primary }]}>Finnhub</Text>
          </View>
          <View style={[styles.apiBadge, { backgroundColor: '#10B98120' }]}>
            <Text style={[styles.apiText, { color: '#10B981' }]}>FCS Cal</Text>
          </View>
        </View>
      </View>

      {/* Category filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { backgroundColor: colors.subTabBg, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat} onPress={() => setActiveFilter(cat)}
            style={[styles.filterBtn, {
              backgroundColor: activeFilter === cat ? colors.primary + '20' : 'transparent',
              borderColor: activeFilter === cat ? colors.primary : colors.border,
            }]}>
            <Text style={[styles.filterText, { color: activeFilter === cat ? colors.primary : colors.textSecondary }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => !user?.isPremium && setShowPremium(true)}
          style={[styles.filterBtn, {
            backgroundColor: user?.isPremium ? colors.gold + '20' : 'transparent',
            borderColor: user?.isPremium ? colors.gold : colors.border,
            opacity: user?.isPremium ? 1 : 0.5,
          }]}>
          <Ionicons name="star" size={10} color={colors.gold} />
          <Text style={[styles.filterText, { color: colors.gold }]}>My Assets</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

        {/* ── ECONOMIC CALENDAR (Premium only) ── */}
     <Text style={[styles.sectionLabel, { color: colors.text }]}>ECONOMIC CALENDAR</Text>

        {!user?.isPremium ? (
          <TouchableOpacity
            style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 20 }]}
            onPress={() => setShowPremium(true)} activeOpacity={0.8}>
            <Ionicons name="lock-closed" size={18} color={colors.gold} />
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Premium Feature</Text>
            <Text style={[styles.lockedSub, { color: colors.textSecondary }]}>Upgrade to Premium to see live economic calendar events, actuals, and forecasts.</Text>
            <View style={[styles.lockedBtn, { backgroundColor: colors.gold }]}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={styles.lockedBtnText}>Go Premium</Text>
            </View>
          </TouchableOpacity>
        ) : (
        <>
        <TouchableOpacity
          onPress={() => setShowForexFactory(true)}
          style={[styles.ffBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <Text style={[styles.ffBannerText, { color: colors.primary }]}>View Full Calendar on Forex Factory</Text>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
        </TouchableOpacity>

        {calLoading ? (
          <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', padding: 20 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : calendar.length === 0 ? (
          <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', padding: 20 }]}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>No calendar events available</Text>
          </View>
        ) : (
          <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Column headers */}
            <View style={[styles.calHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, width: 50 }]}>TIME</Text>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, width: 40 }]}>CUR</Text>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, flex: 1 }]}>EVENT</Text>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, width: 44, textAlign: 'right' }]}>ACT</Text>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, width: 44, textAlign: 'right' }]}>FORE</Text>
              <Text style={[styles.calHeaderCell, { color: colors.textMuted, width: 44, textAlign: 'right' }]}>PREV</Text>
            </View>

            {Object.entries(calByDate).map(([date, events]) => (
              <View key={date}>
                <View style={[styles.calDateRow, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.calDateText, { color: colors.textSecondary }]}>{date}</Text>
                </View>
                {events.map((ev, i) => (
                  <View key={ev.id + i} style={[styles.calRow, i < events.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Text style={[styles.calTime, { color: colors.textMuted }]}>{formatCalTime(ev.dateTime)}</Text>
                    <View style={styles.calCurrencyCol}>
                      <Text style={[styles.calCurrency, { color: colors.text }]}>{ev.country}</Text>
                      <View style={[styles.impactDot, { backgroundColor: getImpactColor(ev.impact) }]} />
                    </View>
                    <Text style={[styles.calEvent, { color: colors.text, flex: 1 }]} numberOfLines={2}>{ev.event}</Text>
                    <Text style={[styles.calVal, { color: ev.actual ? colors.accent : colors.textMuted, width: 44 }]}>{ev.actual || '—'}</Text>
                    <Text style={[styles.calVal, { color: colors.textSecondary, width: 44 }]}>{ev.forecast || '—'}</Text>
                    <Text style={[styles.calVal, { color: colors.textSecondary, width: 44 }]}>{ev.previous || '—'}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Impact legend */}
            <View style={[styles.calLegend, { borderTopColor: colors.border }]}>
              {[['High', '#EF4444'], ['Medium', '#F59E0B'], ['Low', '#EAB308']].map(([label, color]) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.impactDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        </>
        )}

        {/* ── MARKET NEWS ── */}
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 20 }]}>MARKET NEWS</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={32} color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching latest news...</Text>
          </View>
        ) : news.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Ionicons name="newspaper-outline" size={40} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>No news available right now</Text>
          </View>
        ) : (
          news.map((article: any, index: number) => (
            <React.Fragment key={article.id}>
              <TouchableOpacity
                style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => article.url && Linking.openURL(article.url)}
                activeOpacity={0.75}>
                <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(article.category) + '20', alignSelf: 'flex-start', marginBottom: 6 }]}>
                  <Text style={[styles.categoryText, { color: getCategoryColor(article.category) }]}>{article.category?.toUpperCase()}</Text>
                </View>
                <Text style={[styles.newsHeadline, { color: colors.text }]}>{stripHtml(article.headline)}</Text>
                {article.summary ? (
                  <Text style={[styles.newsSummary, { color: colors.textSecondary }]} numberOfLines={2}>{stripHtml(article.summary)}</Text>
                ) : null}
                <Text style={[styles.newsMeta, { color: colors.textMuted }]}>{article.time + ' · ' + article.source}</Text>
              </TouchableOpacity>

              {!user?.isPremium && (index === 1 || index === 3) && (
                <TouchableOpacity
                  style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowPremium(true)} activeOpacity={0.8}>
                  <Ionicons name="lock-closed" size={18} color={colors.gold} />
                  <Text style={[styles.lockedTitle, { color: colors.text }]}>Premium Content</Text>
                  <Text style={[styles.lockedSub, { color: colors.textSecondary }]}>Upgrade to unlock advanced news, analytics and more.</Text>
                  <View style={[styles.lockedBtn, { backgroundColor: colors.gold }]}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.lockedBtnText}>Go Premium</Text>
                  </View>
                </TouchableOpacity>
              )}
            </React.Fragment>
          ))
        )}

   </ScrollView>

      <Modal visible={showForexFactory} animationType="slide" onRequestClose={() => setShowForexFactory(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.ffHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
            <Text style={[styles.ffHeaderTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Forex Factory</Text>
            <TouchableOpacity onPress={() => setShowForexFactory(false)}>
              <Ionicons name="close" size={24} color={colors.isLight ? '#fff' : colors.text} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: 'https://www.forexfactory.com/calendar' }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </Modal>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle:      { fontSize: 18, fontWeight: '800' },
  headerSub:        { fontSize: 10, marginTop: 1 },
  apiBadge:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  apiText:          { fontSize: 10, fontWeight: '700' },
 filterBar:        { borderBottomWidth: 1 },
  filterContent:    { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center', minHeight: 48 },
  filterBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  filterText:       { fontSize: 11, fontWeight: '600' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText:      { fontSize: 13 },
  sectionLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  calCard:          { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  calHeader:        { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  calHeaderCell:    { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  calDateRow:       { paddingHorizontal: 12, paddingVertical: 5 },
  calDateText:      { fontSize: 10, fontWeight: '700' },
  calRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  calTime:          { fontSize: 10, width: 50 },
  calCurrencyCol:   { width: 40, alignItems: 'center', gap: 3 },
  calCurrency:      { fontSize: 10, fontWeight: '700' },
  impactDot:        { width: 8, height: 8, borderRadius: 4 },
  calEvent:         { fontSize: 11, lineHeight: 15 },
  calVal:           { fontSize: 10, fontWeight: '600', textAlign: 'right' },
  calLegend:        { flexDirection: 'row', gap: 12, padding: 10, borderTopWidth: 1, justifyContent: 'flex-end' },
  legendItem:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText:       { fontSize: 9, fontWeight: '600' },
  newsCard:         { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 10 },
  categoryTag:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  categoryText:     { fontSize: 8, fontWeight: '700' },
  newsHeadline:     { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6 },
  newsSummary:      { fontSize: 11, lineHeight: 16, marginBottom: 8 },
  newsMeta:         { fontSize: 10, marginTop: 2 },
  lockedCard:       { borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 16, alignItems: 'center', gap: 6 },
  lockedTitle:      { fontSize: 14, fontWeight: '700' },
  lockedSub:        { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  lockedBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
 lockedBtnText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  ffBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  ffBannerText:     { flex: 1, fontSize: 12, fontWeight: '700' },
  ffHeader:         { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  ffHeaderTitle:    { fontSize: 16, fontWeight: '800' },
})