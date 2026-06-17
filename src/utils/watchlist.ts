import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'vmlts_watchlist'
const DEFAULT_WATCHLIST = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'USD/JPY']

export async function getWatchlist(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
    await AsyncStorage.setItem(KEY, JSON.stringify(DEFAULT_WATCHLIST))
    return DEFAULT_WATCHLIST
  } catch {
    return DEFAULT_WATCHLIST
  }
}

export async function addToWatchlist(symbol: string): Promise<string[]> {
  const current = await getWatchlist()
  if (current.includes(symbol)) return current
  const next = [...current, symbol]
  await AsyncStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export async function removeFromWatchlist(symbol: string): Promise<string[]> {
  const current = await getWatchlist()
  const next = current.filter(s => s !== symbol)
  await AsyncStorage.setItem(KEY, JSON.stringify(next))
  return next
}
