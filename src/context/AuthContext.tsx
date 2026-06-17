import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BASE_URL } from '../config'
import { registerForPushNotificationsAsync } from '../utils/pushNotifications'

export type UserRole = 'learner' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isPremium: boolean
  balance: number
  tier: string
  subscriptionPlan?: string | null
  subscriptionStatus?: string | null
  currentPeriodEnd?: string | null
  profilePhoto?: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isInitializing: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>
  resendVerificationCode: (email: string) => Promise<void>
  updateProfile: (fields: { name?: string; profilePhoto?: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  upgradeToPremium: (user: User) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, isLoading: false, isInitializing: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  verifyEmail: async () => ({ success: false }),
  resendVerificationCode: async () => {},
  updateProfile: async () => ({ success: false }),
  logout: () => {}, upgradeToPremium: () => {},
  refreshUser: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  const mapUser = (u: any): User => ({
    id: u.id, name: u.name, email: u.email,
    role: u.role.toLowerCase() as UserRole,
    isPremium: u.isPremium, balance: u.balance,
    tier: u.tier.charAt(0) + u.tier.slice(1).toLowerCase(),
    subscriptionPlan: u.subscriptionPlan ?? null,
    subscriptionStatus: u.subscriptionStatus ?? null,
    currentPeriodEnd: u.currentPeriodEnd ?? null,
    profilePhoto: u.profilePhoto ?? null,
  })

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = await AsyncStorage.getItem('vmlts_token')
        if (token) {
          const res = await fetch(BASE_URL + '/auth/profile', {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (res.ok) {
            const data = await res.json()
            setUser(mapUser(data.user))
          } else {
            await AsyncStorage.removeItem('vmlts_token')
          }
        }
      } catch (e) {
        await AsyncStorage.removeItem('vmlts_token')
      } finally {
        setIsInitializing(false)
      }
    }
    loadUser()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(BASE_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.message || 'Login failed' }
      await AsyncStorage.setItem('vmlts_token', data.token)
      setUser(mapUser(data.user))
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Network error' }
    } finally { setIsLoading(false) }
  }

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(BASE_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.message || 'Registration failed' }
      // Registration no longer logs the user in directly — the account needs its emailed
      // code confirmed first (see verifyEmail below), which is what actually issues the token.
      if (data.requiresVerification) return { success: true, requiresVerification: true, email: data.email }
      if (data.token) {
        await AsyncStorage.setItem('vmlts_token', data.token)
        setUser(mapUser(data.user))
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Network error' }
    } finally { setIsLoading(false) }
  }

  const verifyEmail = async (email: string, code: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(BASE_URL + '/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.message || 'Verification failed' }
      await AsyncStorage.setItem('vmlts_token', data.token)
      setUser(mapUser(data.user))
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Network error' }
    } finally { setIsLoading(false) }
  }

  const resendVerificationCode = async (email: string) => {
    try {
      await fetch(BASE_URL + '/auth/resend-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
    } catch (e) {}
  }

  const updateProfile = async (fields: { name?: string; profilePhoto?: string }) => {
    try {
      const token = await AsyncStorage.getItem('vmlts_token')
      if (!token) return { success: false, error: 'Not signed in' }
      const res = await fetch(BASE_URL + '/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.message || 'Could not update profile' }
      setUser(mapUser(data.user))
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = async () => {
    await AsyncStorage.removeItem('vmlts_token')
    setUser(null)
  }

  const upgradeToPremium = (updatedUser: User) => setUser(updatedUser)

  // Re-fetches the user's real state from the server AND mints a fresh JWT reflecting it.
  // Used after a Paystack payment is verified server-side, so the app reflects the actual
  // confirmed subscription immediately — both in the UI and in the token every backend
  // service trusts, without needing the user to log out and back in for the isPremium claim
  // to update everywhere (lesson-service, trade-service, etc. all read it off the JWT).
  const refreshUser = async () => {
    try {
      const token = await AsyncStorage.getItem('vmlts_token')
      if (!token) return
      const res = await fetch(BASE_URL + '/auth/refresh-token', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) {
        const data = await res.json()
        await AsyncStorage.setItem('vmlts_token', data.token)
        setUser(mapUser(data.user))
      }
    } catch (e) {
      // Non-fatal — caller keeps whatever state it already has.
    }
  }

  // Register for push notifications once a user is signed in, so admin's "Send Notification"
  // tool has a real device token to deliver to. Runs once per login (not on every re-render).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const register = async () => {
      const token = await registerForPushNotificationsAsync()
      if (!token || cancelled) return
      try {
        const authToken = await AsyncStorage.getItem('vmlts_token')
        await fetch(BASE_URL + '/auth/push-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
          body: JSON.stringify({ token }),
        })
      } catch (e) {
        // Non-fatal — notifications just won't reach this device this session.
      }
    }
    register()
    return () => { cancelled = true }
  }, [user?.id])

  return (
    <AuthContext.Provider value={{ user, isLoading, isInitializing, login, register, verifyEmail, resendVerificationCode, updateProfile, logout, upgradeToPremium, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)