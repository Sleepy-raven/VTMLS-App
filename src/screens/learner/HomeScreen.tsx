import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, RefreshControl, Platform, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import AssetLogo from '../../components/AssetLogo'
import PremiumModal from '../../components/PremiumModal'
import AssetPickerModal from '../../components/AssetPickerModal'
import { ASSETS, formatPrice } from '../../data/markets'
import { tradeAPI, authAPI, getToken } from '../../services/api'
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../../utils/watchlist'

import { BASE_URL, SOCKET_URL } from '../../config'
import { io } from 'socket.io-client'
const XP_TIERS: Record<string, { max: number; next: string }> = {
  Beginner:     { max: 500,  next: 'Intermediate' },
  Intermediate: { max: 1000, next: 'Advanced'     },
  Advanced:     { max: 1000, next: 'Advanced'      },
}

const BADGE_DEFS = [
  { id: 'first_trade',   label: 'First Trade',   icon: 'trophy'      as const, condition: (h: any[]) => h.length >= 1 },
  { id: 'risk_master',   label: 'Risk Master',   icon: 'shield'      as const, condition: (h: any[]) => h.filter((t: any) => t.stopLoss).length >= 3 },
  { id: 'win_streak',    label: 'Win Streak',    icon: 'flame'       as const, condition: (h: any[]) => h.filter((t: any) => (t.pnl || 0) > 0).length >= 5 },
  { id: 'profit_hunter', label: 'Profit Hunter', icon: 'trending-up' as const, condition: (h: any[]) => h.reduce((s: number, t: any) => s + (t.pnl || 0), 0) > 500 },
]

export default function HomeScreen() {
  const { colors } = useTheme()
  const { user, upgradeToPremium } = useAuth()
  const navigation = useNavigation<any>()

  const [openTrades, setOpenTrades]   = useState<any[]>([])
  const [history, setHistory]         = useState<any[]>([])
  const [prices, setPrices]           = useState<Record<string, number>>({})
  const [prevPrices, setPrevPrices]   = useState<Record<string, number>>({})
  const [refreshing, setRefreshing]   = useState(false)
  const [showPremium, setShowPremium] = useState(false)
  const [activeView, setActiveView]   = useState<'trades' | 'history'>('trades')
  const [watchSymbols, setWatchSymbols] = useState<string[]>([])
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [feedbackPopup, setFeedbackPopup] = useState<{ grades: string; message: string } | null>(null)
  const [gradeDetail, setGradeDetail] = useState<any | null>(null)

  const pricesRef = useRef<Record<string, number>>({})
  const hour = new Date().getHours()
  const isLondonOpen = hour >= 8 && hour < 17
  const isNYOpen     = hour >= 13 && hour < 22
  const sessionLabel = isLondonOpen ? 'London Session' : isNYOpen ? 'NY Session' : 'Markets Closed'
  const sessionColor = (isLondonOpen || isNYOpen) ? colors.accent : colors.warning

  const load = async () => {
    try {
      const [tradesRes, histRes, priceRes] = await Promise.allSettled([
        tradeAPI.getOpenTrades(),
        tradeAPI.getTradeHistory(),
        tradeAPI.getPrices(),
      ])
      if (tradesRes.status === 'fulfilled') setOpenTrades((tradesRes.value as any).trades || [])
      if (histRes.status  === 'fulfilled') setHistory((histRes.value as any).trades || [])
      if (priceRes.status === 'fulfilled') {
        const map: Record<string, number> = {}
        ;((priceRes.value as any).assets || []).forEach((a: any) => { map[a.symbol] = a.price })
    setPrevPrices(p => ({ ...p, ...pricesRef.current }))
        pricesRef.current = { ...pricesRef.current, ...map }
        setPrices(map)
      }
    } catch (_) {}
  }

  const refreshProf = async () => {
    try {
      const data = await authAPI.getProfile()
      const u = data.user
      upgradeToPremium({ id: u.id, name: u.name, email: u.email, role: u.role.toLowerCase(), isPremium: u.isPremium, balance: u.balance, tier: u.tier.charAt(0) + u.tier.slice(1).toLowerCase() })
    } catch (_) {}
  }

  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), refreshProf()]); setRefreshing(false) }
 useEffect(() => { load() }, [])

  useFocusEffect(
    React.useCallback(() => {
      getWatchlist().then(setWatchSymbols)
    }, [])
  )

  const handleAddToWatchlist = async (symbol: string) => {
    const next = await addToWatchlist(symbol)
    setWatchSymbols(next)
  }

  const handleRemoveFromWatchlist = async (symbol: string) => {
    const next = await removeFromWatchlist(symbol)
    setWatchSymbols(next)
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socket.on('priceUpdate', (updated: Record<string, number>) => {
      setPrevPrices(p => ({ ...p, ...pricesRef.current }))
      pricesRef.current = { ...pricesRef.current, ...updated }
      setPrices(p => ({ ...p, ...updated }))
    })
    return () => { socket.disconnect() }
  }, [])

  const totalPnl = history.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
  const wins     = history.filter((t: any) => (t.pnl || 0) > 0).length
  const winRate  = history.length > 0 ? Math.round((wins / history.length) * 100) : 0
  const xp       = history.length * 20 + wins * 10
  const tier     = user?.tier || 'Beginner'
  const tierInfo = XP_TIERS[tier] || XP_TIERS['Beginner']
  const xpCapped = Math.min(xp, tierInfo.max)
  const xpPct    = tierInfo.max > 0 ? xpCapped / tierInfo.max : 0
  const xpToNext = Math.max(0, tierInfo.max - xp)
  const earnedBadges = BADGE_DEFS.filter(b => b.condition(history))

  const GRADE_ADVICE: Record<string, string> = {
    entryScore: 'work on your entry timing — wait for clearer confirmation before entering a trade',
    slScore: 'work on your stop-loss usage — set one on every trade to protect your capital',
    rrScore: 'work on your risk/reward ratio — aim for take-profit targets larger than your stop-loss distance',
    exitScore: 'work on your exit timing — avoid closing positions too early or too late',
  }

  const checkTradeFeedback = async () => {
    try {
      const histData = await tradeAPI.getTradeHistory()
      const hist: any[] = histData.trades || []
      const graded = hist.filter((t: any) => t.scoreGrade)
      if (graded.length > 0 && graded.length % 3 === 0) {
        const last3 = graded.slice(0, 3)
        const grades = last3.map((t: any) => t.scoreGrade).join(', ')
        const avg = (key: string) => last3.reduce((s: number, t: any) => s + (t[key] || 0), 0) / last3.length
        const scoreAvgs: Record<string, number> = {
          entryScore: avg('entryScore'), slScore: avg('slScore'),
          rrScore: avg('rrScore'), exitScore: avg('exitScore'),
        }
        const weakest = Object.entries(scoreAvgs).sort((a, b) => a[1] - b[1])[0][0]
        const strongest = Object.entries(scoreAvgs).sort((a, b) => b[1] - a[1])[0][0]
        const positive = strongest === 'entryScore' ? 'Good entry points' :
          strongest === 'slScore' ? 'Solid stop-loss discipline' :
          strongest === 'rrScore' ? 'Strong risk/reward choices' : 'Good exit timing'
        setFeedbackPopup({ grades, message: `${positive}, but you need to ${GRADE_ADVICE[weakest]}.` })
      }
    } catch (_) {}
  }

  const closeTrade = async (tradeId: string) => {
    try {
      const token = await getToken()
      const res = await fetch(BASE_URL + '/trades/close/' + tradeId, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      if (res.ok) {
        await load()
        await refreshProf()
        await checkTradeFeedback()
      }
    } catch (_) {}
  }

  const watchlist = watchSymbols
    .map(sym => ASSETS.find(a => a.symbol === sym))
    .filter((a): a is typeof ASSETS[0] => !!a && (!a.premiumOnly || !!user?.isPremium))
  const getPct = (symbol: string) => {
    const cur = prices[symbol]; const prev = prevPrices[symbol]
    if (!cur || !prev || prev === 0) return null
    return ((cur - prev) / prev) * 100
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.isLight ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: colors.isLight ? '#fff' : colors.text }]}>{user?.name}</Text>
        </View>
        <View style={[styles.sessBadge, { backgroundColor: sessionColor + '25' }]}>
          <View style={[styles.sessDot, { backgroundColor: sessionColor }]} />
          <Text style={[styles.sessText, { color: sessionColor }]}>{sessionLabel}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* Portfolio Card */}
        <View style={[styles.balCard, { backgroundColor: colors.primary }]}>
          <View style={styles.balCardTop}>
            <Text style={styles.balLabel}>Total Portfolio</Text>
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>{(totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2) + ' today'}</Text>
            </View>
          </View>
          <Text style={styles.balValue}>{'$' + (user?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <View style={styles.balRow}>
            {[{ label: 'Win rate', value: winRate + '%' }, { label: 'Open', value: String(openTrades.length) }, { label: 'Tier', value: tier }].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={styles.balDiv} />}
                <View style={styles.balStat}>
                  <Text style={styles.balStatLabel}>{s.label}</Text>
                  <Text style={styles.balStatVal}>{s.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* XP Progress */}
        <View style={[styles.xpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.xpTop}>
            <Text style={[styles.xpLabel, { color: colors.text }]}>XP Progress</Text>
            <Text style={[styles.xpCount, { color: colors.primary }]}>{xpCapped} / {tierInfo.max}</Text>
          </View>
          <View style={[styles.xpBarBg, { backgroundColor: colors.border }]}>
            <View style={[styles.xpBarFill, { width: `${Math.round(xpPct * 100)}%` as any, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.xpSub, { color: colors.textMuted }]}>
            {tier === 'Advanced' ? 'Max tier reached' : `${xpToNext} XP to ${tierInfo.next} tier`}
          </Text>
        </View>

        {/* Unlock Premium Banner */}
        {!user?.isPremium && (
          <TouchableOpacity style={[styles.premBanner, { backgroundColor: colors.gold + '18', borderColor: colors.gold + '40' }]} onPress={() => setShowPremium(true)} activeOpacity={0.8}>
            <Ionicons name="star" size={16} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.premBannerTitle, { color: colors.gold }]}>Unlock Premium</Text>
              <Text style={[styles.premBannerSub, { color: colors.textSecondary }]}>Advanced lessons, analytics and more</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
          </TouchableOpacity>
        )}

        {/* New Trade / History Toggle */}
        <View style={styles.tradeToggleRow}>
          <TouchableOpacity style={[styles.newTradeBtn, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('Markets')} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newTradeTxt}>+ New Trade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.historyBtn, { backgroundColor: activeView === 'history' ? colors.card : 'transparent', borderColor: colors.border }]} onPress={() => setActiveView(v => v === 'trades' ? 'history' : 'trades')} activeOpacity={0.8}>
            <Text style={[styles.historyTxt, { color: activeView === 'history' ? colors.primary : colors.textSecondary }]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Open Positions */}
        {activeView === 'trades' && (openTrades.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Open Positions</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.primary }]}><Text style={styles.countText}>{openTrades.length}</Text></View>
            </View>
            {openTrades.map((t: any, i: number) => {
              const cur = prices[t.symbol] || t.entryPrice
              const diff = t.type === 'BUY' ? cur - t.entryPrice : t.entryPrice - cur
              const pnl = diff * t.lotSize * 10000
              return (
                <View key={t.id} style={[styles.tradeRow, i < openTrades.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <AssetLogo symbol={t.symbol} size={32} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.trSym, { color: colors.text }]}>{t.symbol}</Text>
                    <Text style={[styles.trMeta, { color: colors.textSecondary }]}>{t.lotSize + ' lots · ' + t.type}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={[styles.trPnl, { color: pnl >= 0 ? colors.accent : colors.danger }]}>{(pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2)}</Text>
                    <Text style={[styles.trEntry, { color: colors.textMuted }]}>{'@ ' + formatPrice(t.symbol, t.entryPrice)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => closeTrade(t.id)} style={[styles.closeBtn, { backgroundColor: colors.danger + '20', borderColor: colors.danger + '40' }]}>
                    <Text style={[styles.closeTxt, { color: colors.danger }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="bar-chart-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No open positions</Text>
            <Text style={[styles.emptySubTxt, { color: colors.textMuted }]}>Tap New Trade to get started</Text>
          </View>
        ))}

        {/* Recent History */}
        {activeView === 'history' && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHead}><Text style={[styles.cardTitle, { color: colors.text }]}>Recent Trades</Text></View>
            {history.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}><Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No trade history yet</Text></View>
            ) : history.slice(0, 6).map((t: any, i: number) => (
              <TouchableOpacity
                key={t.id}
                activeOpacity={t.scoreGrade ? 0.6 : 1}
                onPress={() => {
                  if (!t.scoreGrade) return
                  if (!user?.isPremium) { setShowPremium(true); return }
                  setGradeDetail(t)
                }}
                style={[styles.histRow, i < Math.min(6, history.length) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <AssetLogo symbol={t.symbol} size={28} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.histSym, { color: colors.text }]}>{t.symbol}</Text>
                  <Text style={[styles.histType, { color: t.type === 'BUY' ? colors.accent : colors.danger }]}>{t.type}</Text>
                </View>
                <Text style={[styles.histPnl, { color: (t.pnl || 0) >= 0 ? colors.accent : colors.danger }]}>{((t.pnl || 0) >= 0 ? '+$' : '-$') + Math.abs(t.pnl || 0).toFixed(2)}</Text>
                {t.scoreGrade && (
                  <View style={[styles.gradeChip, { backgroundColor: t.scoreGrade === 'A' ? colors.accent + '25' : t.scoreGrade === 'B' ? colors.primary + '25' : colors.warning + '25' }]}>
                    <Text style={[styles.gradeText, { color: t.scoreGrade === 'A' ? colors.accent : t.scoreGrade === 'B' ? colors.primary : colors.warning }]}>{t.scoreGrade}</Text>
                  </View>
                )}
                {t.scoreGrade && !user?.isPremium && <Ionicons name="lock-closed" size={12} color={colors.gold} style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <>
            <Text style={[styles.groupTitle, { color: colors.text }]}>BADGES EARNED</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {earnedBadges.map(b => (
                <View key={b.id} style={[styles.badgeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.badgeIcon, { backgroundColor: colors.gold + '20' }]}><Ionicons name={b.icon} size={22} color={colors.gold} /></View>
                  <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{b.label}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Watchlist */}
        <View style={styles.watchHeaderRow}>
          <Text style={[styles.groupTitle, { color: colors.text, marginBottom: 0 }]}>WATCHLIST</Text>
          <TouchableOpacity onPress={() => setShowAssetPicker(true)} style={[styles.addBtn, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {watchlist.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>No assets yet — tap + to add one</Text>
            </View>
          ) : watchlist.map((a, i) => {
            const pct = getPct(a.symbol)
            const pctColor = pct === null ? colors.textMuted : pct >= 0 ? colors.accent : colors.danger
            const pctLabel = pct === null ? '' : (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(2) + '%'
            return (
              <TouchableOpacity
                key={a.symbol}
                onPress={() => navigation.navigate('Markets', { focusSymbol: a.symbol })}
                style={[styles.watchRow, i < watchlist.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <AssetLogo symbol={a.symbol} size={34} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.watchSym, { color: colors.text }]}>{a.symbol}</Text>
                  <Text style={[styles.watchName, { color: colors.textSecondary }]}>{a.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                  <Text style={[styles.watchPrice, { color: colors.text }]}>{formatPrice(a.symbol, prices[a.symbol] || a.price)}</Text>
                  {pctLabel ? <Text style={[styles.watchPct, { color: pctColor }]}>{pctLabel}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleRemoveFromWatchlist(a.symbol)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })}
        </View>

      </ScrollView>
      <AssetPickerModal
        visible={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        excludeSymbols={watchSymbols}
        onSelect={handleAddToWatchlist}
        isPremium={!!user?.isPremium}
      />

      {/* Post-trade feedback popup (every 3 trades) */}
      <Modal visible={!!feedbackPopup} transparent animationType="fade" onRequestClose={() => setFeedbackPopup(null)}>
        <View style={styles.centerOverlay}>
          <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="analytics" size={28} color={colors.primary} style={{ marginBottom: 10 }} />
            <Text style={[styles.feedbackTitle, { color: colors.text }]}>Last 3 Trades: {feedbackPopup?.grades}</Text>
            <Text style={[styles.feedbackMsg, { color: colors.textSecondary }]}>{feedbackPopup?.message}</Text>
            <TouchableOpacity onPress={() => setFeedbackPopup(null)} style={[styles.feedbackBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.feedbackBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Trade grade breakdown (Pro) */}
      <Modal visible={!!gradeDetail} transparent animationType="slide" onRequestClose={() => setGradeDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.scoreSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[styles.gradeBadge, {
                backgroundColor: gradeDetail?.scoreGrade === 'A' ? colors.accent + '20' : gradeDetail?.scoreGrade === 'B' ? colors.primary + '20' : gradeDetail?.scoreGrade === 'C' ? colors.warning + '20' : colors.danger + '20'
              }]}>
                <Text style={[styles.gradeChar, {
                  color: gradeDetail?.scoreGrade === 'A' ? colors.accent : gradeDetail?.scoreGrade === 'B' ? colors.primary : gradeDetail?.scoreGrade === 'C' ? colors.warning : colors.danger
                }]}>{gradeDetail?.scoreGrade}</Text>
              </View>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{gradeDetail?.symbol} · {gradeDetail?.type}</Text>
            </View>
            {[
              { label: 'Entry timing', value: gradeDetail?.entryScore || 0 },
              { label: 'Stop-loss', value: gradeDetail?.slScore || 0 },
              { label: 'Risk/reward', value: gradeDetail?.rrScore || 0 },
              { label: 'Exit timing', value: gradeDetail?.exitScore || 0 },
            ].map(row => (
              <View key={row.label} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{row.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{Math.round(row.value)}</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 3 }}>
                  <View style={{ width: (row.value + '%') as any, height: 6, backgroundColor: colors.primary, borderRadius: 3 }} />
                </View>
              </View>
            ))}
            {gradeDetail?.scoreFeedback ? (
              <View style={[styles.feedbackBox, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{gradeDetail.scoreFeedback}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={() => setGradeDetail(null)} style={[styles.feedbackBtn, { backgroundColor: colors.border, marginTop: 4 }]}>
              <Text style={[styles.feedbackBtnTxt, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  greeting:        { fontSize: 11, fontWeight: '500' },
  name:            { fontSize: 20, fontWeight: '800', marginTop: 1 },
  sessBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  sessDot:         { width: 6, height: 6, borderRadius: 3 },
  sessText:        { fontSize: 10, fontWeight: '700' },
  balCard:         { borderRadius: 16, padding: 20, marginBottom: 14 },
  balCardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balLabel:        { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  todayBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  todayText:       { fontSize: 10, color: '#fff', fontWeight: '600' },
  balValue:        { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 16 },
  balRow:          { flexDirection: 'row', alignItems: 'center' },
  balStat:         { flex: 1, alignItems: 'center' },
  balStatLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  balStatVal:      { fontSize: 14, fontWeight: '700', color: '#fff' },
  balDiv:          { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  xpCard:          { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  xpTop:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  xpLabel:         { fontSize: 13, fontWeight: '700' },
  xpCount:         { fontSize: 13, fontWeight: '700' },
  xpBarBg:         { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  xpBarFill:       { height: '100%', borderRadius: 3 },
  xpSub:           { fontSize: 10 },
  premBanner:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 14 },
  premBannerTitle: { fontSize: 13, fontWeight: '700' },
  premBannerSub:   { fontSize: 11, marginTop: 1 },
  tradeToggleRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  newTradeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12 },
  newTradeTxt:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  historyBtn:      { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1 },
  historyTxt:      { fontSize: 14, fontWeight: '600' },
  card:            { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  cardHead:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 10 },
  cardTitle:       { fontSize: 14, fontWeight: '700' },
  countBadge:      { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countText:       { fontSize: 10, color: '#fff', fontWeight: '700' },
  tradeRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 10 },
  trSym:           { fontSize: 13, fontWeight: '700' },
  trMeta:          { fontSize: 10, marginTop: 2 },
  trPnl:           { fontSize: 13, fontWeight: '700' },
  trEntry:         { fontSize: 10, marginTop: 2 },
  closeBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  closeTxt:        { fontSize: 11, fontWeight: '700' },
  emptyCard:       { borderRadius: 14, borderWidth: 1, marginBottom: 16, padding: 24, alignItems: 'center', gap: 6 },
  emptyTxt:        { fontSize: 14, fontWeight: '600' },
  emptySubTxt:     { fontSize: 11 },
  histRow:         { flexDirection: 'row', alignItems: 'center', padding: 12, paddingVertical: 10, gap: 8 },
  histSym:         { fontSize: 13, fontWeight: '600' },
  histType:        { fontSize: 11, fontWeight: '700' },
  histPnl:         { fontSize: 13, fontWeight: '700' },
  gradeChip:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gradeText:       { fontSize: 11, fontWeight: '800' },
  groupTitle:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  watchHeaderRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addBtn:          { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeCard:       { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14, marginRight: 10, minWidth: 80 },
  badgeIcon:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeLabel:      { fontSize: 9, fontWeight: '600', textAlign: 'center' },
  watchRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, paddingVertical: 13 },
  watchSym:        { fontSize: 13, fontWeight: '700' },
  watchName:       { fontSize: 10, marginTop: 2 },
  watchPrice:      { fontSize: 14, fontWeight: '700' },
  watchPct:        { fontSize: 10, fontWeight: '600', marginTop: 2 },
  centerOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  feedbackCard:    { width: '100%', borderRadius: 18, borderWidth: 1, padding: 22, alignItems: 'center' },
  feedbackTitle:   { fontSize: 15, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  feedbackMsg:     { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  feedbackBtn:     { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  feedbackBtnTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  scoreSheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 },
  gradeBadge:      { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gradeChar:       { fontSize: 34, fontWeight: '900' },
  scoreLabel:      { fontSize: 11, fontWeight: '600' },
  feedbackBox:     { borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 14 },
})