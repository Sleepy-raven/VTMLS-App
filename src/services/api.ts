import AsyncStorage from '@react-native-async-storage/async-storage'
import { BASE_URL } from '../config'

export const getToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('vmlts_token')
}
export const setToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem('vmlts_token', token)
}
export const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem('vmlts_token')
}

const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = 'Bearer ' + token
  const response = await fetch(BASE_URL + endpoint, { ...options, headers })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const authAPI = {
  register: (name: string, email: string, password: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getProfile: () => request('/auth/profile'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),
  // Mints a fresh JWT reflecting the user's current isPremium/role from the database —
  // needed because every service trusts the claim baked into the token rather than doing a
  // live lookup. Call this right after a payment confirms so the app doesn't need a re-login
  // for the upgrade to take effect everywhere.
  refreshToken: () => request('/auth/refresh-token', { method: 'POST' }),
  requestDeletionCode: () => request('/auth/request-deletion-code', { method: 'POST' }),
  confirmDeletion: (code: string) =>
    request('/auth/confirm-deletion', { method: 'POST', body: JSON.stringify({ code }) }),
}

export const tradeAPI = {
  getPrices: () => request('/trades/prices'),
  openTrade: (symbol: string, type: string, lotSize: number, stopLoss?: number, takeProfit?: number) =>
    request('/trades/open', { method: 'POST', body: JSON.stringify({ symbol, type, lotSize, stopLoss, takeProfit }) }),
  closeTrade: (tradeId: string) =>
    request('/trades/close/' + tradeId, { method: 'POST' }),
  getOpenTrades: () => request('/trades/open'),
  getTradeHistory: () => request('/trades/history'),
  claimChallenge: (challengeId: number | string) =>
    request('/trades/challenges/' + challengeId + '/claim', { method: 'POST' }),
}

export const learnAPI = {
  getLessons: () => request('/learn/lessons'),
  getCertificateProgress: () => request('/learn/certificates'),
  getChallenges: () => request('/learn/challenges'),
  getLessonProgress: () => request('/learn/lessons/progress'),
  updateLessonProgress: (lessonId: string, progress: number) =>
    request('/learn/lessons/' + lessonId + '/progress', { method: 'POST', body: JSON.stringify({ progress }) }),
  getChallengeProgress: () => request('/learn/challenges/progress'),
  updateChallengeProgress: (challengeId: string, progress: number) =>
    request('/learn/challenges/' + challengeId + '/progress', { method: 'POST', body: JSON.stringify({ progress }) }),
}
export const newsAPI = {
  getNews: (category?: string) => request('/news' + (category ? '?category=' + category : '')),
  getPremiumNews: () => request('/news/premium'),
  getCalendar: () => request('/news/calendar'),   
}
export const paymentAPI = {
  initialize: (method: string, phone?: string) =>
    request('/payments/initialize', { method: 'POST', body: JSON.stringify({ method, phone }) }),
  verify: (reference: string) => request('/payments/verify/' + reference),
  getHistory: () => request('/payments/history'),
  getPlans: () => request('/payments/plans'),
  getSubscription: () => request('/payments/subscription'),
  subscribe: (planType: 'MONTHLY' | 'YEARLY') =>
    request('/payments/subscribe', { method: 'POST', body: JSON.stringify({ planType }) }),
  cancelSubscription: () => request('/payments/subscription/cancel', { method: 'POST' }),
}

export const analyticsAPI = {
  getAnalytics: () => request('/analytics'),
}