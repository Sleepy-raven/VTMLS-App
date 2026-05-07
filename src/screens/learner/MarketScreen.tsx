import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, TextInput, Alert, Modal } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import AssetLogo from '../../components/AssetLogo'
import PremiumModal from '../../components/PremiumModal'
import AssetPickerModal from '../../components/AssetPickerModal'
import { ASSETS, formatPrice } from '../../data/markets'
import { io } from 'socket.io-client'
import { tradeAPI } from '../../services/api'
import { getWatchlist, addToWatchlist } from '../../utils/watchlist'
import { useRoute, useFocusEffect } from '@react-navigation/native'

import { LOCAL_IP, SOCKET_URL } from '../../config'

const TV_MAP: Record<string, string> = {
  'EUR/USD': 'OANDA:EURUSD', 'GBP/USD': 'OANDA:GBPUSD', 'USD/JPY': 'OANDA:USDJPY',
  'AUD/USD': 'OANDA:AUDUSD', 'USD/CAD': 'OANDA:USDCAD', 'EUR/GBP': 'OANDA:EURGBP',
  'US30': 'FOREXCOM:DJI', 'US500': 'FOREXCOM:SPX500', 'NAS100': 'FOREXCOM:NAS100',
  'UK100': 'FOREXCOM:UK100', 'GER40': 'FOREXCOM:GER40',
  'XAU/USD': 'OANDA:XAUUSD', 'XAG/USD': 'OANDA:XAGUSD', 'WTI': 'NYMEX:CL1!',
}

function getTvHtml(symbol: string, isDark: boolean): string {
  const tvSym = TV_MAP[symbol] || 'OANDA:EURUSD'
  const theme = isDark ? 'dark' : 'light'
  const bg = isDark ? '#0A0E1A' : '#FFFFFF'
  const sc = '<' + '/script>'
  return '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
    '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:' + bg + ';overflow:hidden}#tv{width:100%;height:100vh}</style></head><body>' +
    '<div id="tv"></div>' +
    '<script type="text/javascript" src="https://s3.tradingview.com/tv.js">' + sc +
    '<script type="text/javascript">new TradingView.widget({autosize:true,symbol:"' + tvSym + '",' +
    'interval:"H1",timezone:"Etc/UTC",theme:"' + theme + '",style:"1",locale:"en",' +
   'enable_publishing:false,allow_symbol_change:true,container_id:"tv",' +
    'hide_side_toolbar:false,withdateranges:true,details:true,' +
    'studies:[]})' + sc +
    '</body></html>'
}

type SubTab = 'quotes' | 'chart' | 'trade'

interface ScoreData {
  grade: string
  tradeScore: number
  entryScore: number
  slScore: number
  rrScore: number
  exitScore: number
  scoreFeedback: string
  pnl: number
}

export default function MarketScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const route = useRoute<any>()
  const [subTab, setSubTab] = useState<SubTab>('quotes')
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0])
  const [showPremium, setShowPremium] = useState(false)
  const [connected, setConnected] = useState(false)
  const pricesRef = useRef<Record<string, number>>({})
  const socketRef = useRef<any>(null)
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    ASSETS.forEach(a => { init[a.symbol] = a.price; pricesRef.current[a.symbol] = a.price })
    return init
  })
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({})
  const [lotSize, setLotSize] = useState('0.01')
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [placing, setPlacing] = useState(false)
  const [scoreData, setScoreData] = useState<ScoreData | null>(null)
  const [assetFilter, setAssetFilter] = useState<'All' | 'Forex' | 'Indices' | 'Commodities' | 'My Assets'>('All')
  const [openTradeSymbols, setOpenTradeSymbols] = useState<string[]>([])
  const [watchSymbols, setWatchSymbols] = useState<string[]>([])
  const [showAssetPicker, setShowAssetPicker] = useState(false)

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('priceUpdate', (updated: Record<string, number>) => {
      setPrevPrices(p => ({ ...p, ...pricesRef.current }))
      pricesRef.current = { ...pricesRef.current, ...updated }
      setPrices(p => ({ ...p, ...updated }))
    })
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    tradeAPI.getOpenTrades().then((res: any) => {
      setOpenTradeSymbols((res.trades || []).map((t: any) => t.symbol))
    }).catch(() => {})
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      getWatchlist().then(setWatchSymbols)
      const focusSymbol = route.params?.focusSymbol
      if (focusSymbol) {
        setSubTab('quotes')
        setAssetFilter('All')
      }
    }, [route.params?.focusSymbol])
  )

  const handleAddToWatchlist = async (symbol: string) => {
    const next = await addToWatchlist(symbol)
    setWatchSymbols(next)
  }

  const handleAssetPress = (asset: typeof ASSETS[0]) => {
    if (asset.premiumOnly && !user?.isPremium) { setShowPremium(true); return }
    setSelectedAsset(asset)
    setSubTab('chart')
  }

  const getPriceChange = (symbol: string) => {
    const cur = prices[symbol] || 0
    const prev = prevPrices[symbol] || cur
    return { up: cur >= prev, pct: prev > 0 ? Math.abs(((cur - prev) / prev) * 100).toFixed(3) : '0.000' }
  }

  const placeOrder = async (type: 'BUY' | 'SELL') => {
    if (selectedAsset.premiumOnly && !user?.isPremium) { setShowPremium(true); return }
    setOrderType(type)
    setPlacing(true)
    try {
      await tradeAPI.openTrade(
        selectedAsset.symbol, type, parseFloat(lotSize),
        stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit ? parseFloat(takeProfit) : undefined
      )
      Alert.alert('Order Placed', selectedAsset.symbol + ' ' + type + ' ' + lotSize + ' lots')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to place order')
    } finally { setPlacing(false) }
  }

  const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color }}>{Math.round(value)}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 3 }}>
        <View style={{ width: (value + '%') as any, height: 6, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  )

  const curPrice = prices[selectedAsset.symbol] || selectedAsset.price
  const margin = (parseFloat(lotSize || '0') * 1000).toFixed(0)

  const filteredAssets = ASSETS.filter(a => {
    if (assetFilter === 'All') return true
    if (assetFilter === 'Forex') return a.category === 'forex'
    if (assetFilter === 'Indices') return a.category === 'indices'
    if (assetFilter === 'Commodities') return a.category === 'commodities'
    if (assetFilter === 'My Assets') return openTradeSymbols.includes(a.symbol) || watchSymbols.includes(a.symbol)
    return true
  })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.isLight ? '#fff' : colors.text }]}>Market</Text>
          <Text style={[styles.headerSub, { color: colors.isLight ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            {ASSETS.length} instruments
          </Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: connected ? '#10B98120' : '#EF444420' }]}>
          <Text style={[styles.liveText, { color: connected ? '#10B981' : '#EF4444' }]}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Sub tabs */}
      <View style={[styles.subTabs, { backgroundColor: colors.subTabBg, borderBottomColor: colors.border }]}>
        {(['quotes', 'chart', 'trade'] as SubTab[]).map(t => (
          <TouchableOpacity key={t}
            style={[styles.subTab, subTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab(t)}>
            <Text style={[styles.subTabText, { color: subTab === t ? colors.primary : colors.textMuted }]}>
              {t === 'quotes' ? 'Quotes' : t === 'chart' ? 'Chart' : 'Trade'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'quotes' ? (
        /* ── QUOTES TAB ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {/* Category filter chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {(['All', 'Forex', 'Indices', 'Commodities', 'My Assets'] as const).map(f => (
                <TouchableOpacity key={f} onPress={() => setAssetFilter(f)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                    backgroundColor: assetFilter === f ? colors.primary + '20' : 'transparent',
                    borderColor: assetFilter === f ? colors.primary : colors.border,
                  }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: assetFilter === f ? colors.primary : colors.textSecondary }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {assetFilter === 'My Assets' && (
              <TouchableOpacity onPress={() => setShowAssetPicker(true)}
                style={[styles.addAssetBtn, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {filteredAssets.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No assets in this category</Text>
            </View>
          ) : null}

          {filteredAssets.map((asset, i) => {
            const { up, pct } = getPriceChange(asset.symbol)
            const locked = asset.premiumOnly && !user?.isPremium
            return (
              <View key={asset.symbol}>
                <TouchableOpacity onPress={() => handleAssetPress(asset)} style={[styles.assetRow, locked && { opacity: 0.5 }]}>
                  <AssetLogo symbol={asset.symbol} size={40} />
                  <View style={styles.assetInfo}>
                    <View style={styles.assetNameRow}>
                      <Text style={[styles.assetSymbol, { color: colors.text }]}>{asset.symbol}</Text>
                      {locked && <Ionicons name="lock-closed" size={12} color={colors.gold} style={{ marginLeft: 4 }} />}
                    </View>
                    <Text style={[styles.assetName, { color: colors.textSecondary }]}>{asset.name}</Text>
                  </View>
                  <View style={styles.assetPrice}>
                    <Text style={[styles.priceVal, { color: colors.text }]}>{formatPrice(asset.symbol, prices[asset.symbol] || asset.price)}</Text>
                    <Text style={[styles.priceChange, { color: up ? colors.accent : colors.danger }]}>{up ? '▲' : '▼'} {pct}%</Text>
                  </View>
                </TouchableOpacity>
                {i < filteredAssets.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </View>
            )
          })}
          {!user?.isPremium && (
            <TouchableOpacity style={[styles.unlockBanner, { backgroundColor: colors.gold + '15', borderColor: colors.gold + '40' }]} onPress={() => setShowPremium(true)}>
              <Ionicons name="star" size={16} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.unlockTitle, { color: colors.gold }]}>Unlock all {ASSETS.length} instruments</Text>
                <Text style={[styles.unlockSub, { color: colors.textSecondary }]}>Upgrade to Premium</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </TouchableOpacity>
          )}
        </ScrollView>

      ) : subTab === 'chart' ? (
        /* ── CHART TAB ── */
        <View style={{ flex: 1 }}>
          <View style={[styles.chartHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <AssetLogo symbol={selectedAsset.symbol} size={34} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[styles.chartAssetSym, { color: colors.text }]}>{selectedAsset.symbol}</Text>
              <Text style={[styles.chartAssetName, { color: colors.textSecondary }]}>{selectedAsset.name} · Simulated</Text>
            </View>
            <Text style={[styles.chartPrice, { color: colors.text }]}>{formatPrice(selectedAsset.symbol, curPrice)}</Text>
          </View>
          <WebView
            source={{ html: getTvHtml(selectedAsset.symbol, !colors.isLight) }}
            style={[{ flex: 1 }, { backgroundColor: colors.background }]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            allowsInlineMediaPlayback={true}
          />
        </View>

      ) : (
        /* ── TRADE TAB ── */
        <View style={{ flex: 1 }}>
          <View style={[styles.chartHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <AssetLogo symbol={selectedAsset.symbol} size={34} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[styles.chartAssetSym, { color: colors.text }]}>{selectedAsset.symbol}</Text>
              <Text style={[styles.chartAssetName, { color: colors.textSecondary }]}>{selectedAsset.name} · Simulated</Text>
            </View>
            <Text style={[styles.chartPrice, { color: colors.text }]}>{formatPrice(selectedAsset.symbol, curPrice)}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
            <View style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.tradeMargin, { color: colors.textSecondary }]}>
                {'Lot: ' + lotSize + '  ·  Margin: $' + margin}
              </Text>
              <View style={styles.obRow}>
                <TouchableOpacity onPress={() => placeOrder('BUY')} disabled={placing}
                  style={[styles.obBuyBtn, { backgroundColor: colors.accent + '25', borderColor: colors.accent }]}>
                  <Text style={[styles.obBuyTxt, { color: colors.accent }]}>
                    {'BUY ' + formatPrice(selectedAsset.symbol, curPrice + selectedAsset.pip)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => placeOrder('SELL')} disabled={placing}
                  style={[styles.obSellBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={[styles.obSellTxt, { color: colors.danger }]}>
                    {'SELL ' + formatPrice(selectedAsset.symbol, curPrice - selectedAsset.pip)}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.inLabel, { color: colors.textSecondary }]}>Lot Size</Text>
              <View style={[styles.inRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput value={lotSize} onChangeText={setLotSize}
                  style={[styles.inField, { color: colors.text }]}
                  keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                <Text style={[styles.inUnit, { color: colors.textSecondary }]}>lots</Text>
              </View>
              <View style={styles.slTpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inLabel, { color: colors.textSecondary }]}>
                    Stop Loss {!user?.isPremium && <Ionicons name="lock-closed" size={10} color={colors.gold} />}
                  </Text>
                  <View style={[styles.inRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: user?.isPremium ? 1 : 0.5 }]}>
                    <TextInput value={stopLoss}
                      onChangeText={user?.isPremium ? setStopLoss : () => setShowPremium(true)}
                      style={[styles.inField, { color: colors.text }]}
                      placeholder="0.00" placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad" editable={!!user?.isPremium} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inLabel, { color: colors.textSecondary }]}>
                    Take Profit {!user?.isPremium && <Ionicons name="lock-closed" size={10} color={colors.gold} />}
                  </Text>
                  <View style={[styles.inRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: user?.isPremium ? 1 : 0.5 }]}>
                    <TextInput value={takeProfit}
                      onChangeText={user?.isPremium ? setTakeProfit : () => setShowPremium(true)}
                      style={[styles.inField, { color: colors.text }]}
                      placeholder="0.00" placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad" editable={!!user?.isPremium} />
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Trade Score Modal */}
      {scoreData && (
        <Modal transparent animationType="slide" onRequestClose={() => setScoreData(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.scoreModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.gradeBadge, {
                  backgroundColor: scoreData.grade === 'A' ? colors.accent + '20' : scoreData.grade === 'B' ? colors.primary + '20' : scoreData.grade === 'C' ? colors.warning + '20' : colors.danger + '20'
                }]}>
                  <Text style={[styles.gradeChar, {
                    color: scoreData.grade === 'A' ? colors.accent : scoreData.grade === 'B' ? colors.primary : scoreData.grade === 'C' ? colors.warning : colors.danger
                  }]}>{scoreData.grade}</Text>
                </View>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>TRADE SCORE</Text>
                <Text style={[styles.pnlLine, { color: scoreData.pnl >= 0 ? colors.accent : colors.danger }]}>
                  {scoreData.pnl >= 0 ? '+$' : '-$'}{Math.abs(scoreData.pnl).toFixed(2) + ' P&L'}
                </Text>
              </View>
              <ScoreBar label="Entry timing"  value={scoreData.entryScore} color={colors.accent} />
              <ScoreBar label="Stop-loss"     value={scoreData.slScore}   color={scoreData.slScore >= 70 ? colors.accent : colors.warning} />
              <ScoreBar label="Risk/reward"   value={scoreData.rrScore}   color={scoreData.rrScore >= 70 ? colors.accent : colors.warning} />
              <ScoreBar label="Exit timing"   value={scoreData.exitScore} color={colors.accent} />
              <View style={[styles.feedbackBox, { backgroundColor: colors.surface }]}>
                <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>{scoreData.scoreFeedback}</Text>
              </View>
              <TouchableOpacity onPress={() => setScoreData(null)} style={[styles.doneBtn, { backgroundColor: colors.border }]}>
                <Text style={[styles.doneTxt, { color: colors.text }]}>Close feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <AssetPickerModal
        visible={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        excludeSymbols={watchSymbols}
        onSelect={handleAddToWatchlist}
        isPremium={!!user?.isPremium}
      />
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle:    { fontSize: 18, fontWeight: '800' },
  headerSub:      { fontSize: 10, marginTop: 1 },
  liveBadge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveText:       { fontSize: 10, fontWeight: '700' },
  subTabs:        { flexDirection: 'row', borderBottomWidth: 1 },
  subTab:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabText:     { fontSize: 12, fontWeight: '600' },
  assetRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  assetInfo:      { flex: 1 },
  assetNameRow:   { flexDirection: 'row', alignItems: 'center' },
  assetSymbol:    { fontSize: 13, fontWeight: '700' },
  assetName:      { fontSize: 10, marginTop: 2 },
  assetPrice:     { alignItems: 'flex-end' },
  priceVal:       { fontSize: 13, fontWeight: '600' },
  priceChange:    { fontSize: 10, fontWeight: '700', marginTop: 2 },
  divider:        { height: 1, marginLeft: 52 },
  addAssetBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  unlockBanner:   { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, borderWidth: 1, gap: 10, marginTop: 8 },
  unlockTitle:    { fontSize: 12, fontWeight: '700' },
  unlockSub:      { fontSize: 10, marginTop: 1 },
  chartHeader:    { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 8 },
  chartAssetSym:  { fontSize: 15, fontWeight: '800' },
  chartAssetName: { fontSize: 10, marginTop: 1 },
  chartPrice:     { fontSize: 20, fontWeight: '800' },
  tvChart:        { height: 280 },
  tradeCard:      { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  tradeMargin:    { fontSize: 11, fontWeight: '600', marginBottom: 12 },
  obRow:          { flexDirection: 'row', gap: 10, marginBottom: 14 },
  obBuyBtn:       { flex: 1, padding: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  obBuyTxt:       { fontWeight: '800', fontSize: 13 },
  obSellBtn:      { flex: 1, padding: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  obSellTxt:      { fontWeight: '800', fontSize: 13 },
  inLabel:        { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inRow:          { flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, marginBottom: 12 },
  inField:        { flex: 1, height: 42, fontSize: 15 },
  inUnit:         { fontSize: 12, fontWeight: '600' },
  slTpRow:        { flexDirection: 'row', gap: 10 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  scoreModal:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 },
  gradeBadge:     { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gradeChar:      { fontSize: 40, fontWeight: '900' },
  scoreLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  pnlLine:        { fontSize: 14, fontWeight: '600', marginBottom: 20 },
  feedbackBox:    { borderRadius: 10, padding: 12, marginBottom: 16 },
  feedbackText:   { fontSize: 13, lineHeight: 20 },
  doneBtn:        { padding: 14, borderRadius: 12, alignItems: 'center' },
  doneTxt:        { fontSize: 15, fontWeight: '700' },
})