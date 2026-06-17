import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { paymentAPI } from '../services/api'

type Step = 'plan' | 'checkout' | 'verifying' | 'success'
type PlanType = 'MONTHLY' | 'YEARLY'

interface Plan {
  id: string
  name: string
  priceGhs: number
  interval: string
  features: string[]
}

// Paystack's hosted checkout redirects here on completion. We just watch the WebView's
// navigation for this callback URL rather than actually hosting a page at it.
const CALLBACK_MARKER = 'vmlts-payment-callback'

export default function PremiumModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState<Step>('plan')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('MONTHLY')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [webViewError, setWebViewError] = useState<string | null>(null)
  const [webViewKey, setWebViewKey] = useState(0)

  useEffect(() => {
    if (!visible) return
    setLoadingPlans(true)
    paymentAPI.getPlans()
      .then((data: any) => setPlans((data.plans || []).filter((p: Plan) => p.id !== 'FREE')))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false))
  }, [visible])

  const reset = () => {
    setStep('plan'); setCheckoutUrl(null); setReference(null); setStarting(false); setVerifyError(null)
    setWebViewError(null); setWebViewKey(k => k + 1)
  }
  const handleClose = () => { reset(); onClose() }

  const startCheckout = async () => {
    setStarting(true)
    setVerifyError(null)
    try {
      const data: any = await paymentAPI.subscribe(selectedPlan)
      // If the backend responded successfully but somehow didn't include a checkout link,
      // don't silently switch to a step that renders nothing — that produced a blank screen
      // with no feedback, which looked like "Paystack isn't opening" with no way to tell why.
      if (!data?.authorization_url) {
        Alert.alert('Could not start checkout', 'No checkout link was returned by the server. Please try again.')
        return
      }
      setReference(data.reference)
      setCheckoutUrl(data.authorization_url)
      setStep('checkout')
    } catch (e: any) {
      Alert.alert('Could not start checkout', e?.message || 'Please try again in a moment.')
    } finally {
      setStarting(false)
    }
  }

  const handleNavStateChange = (navState: any) => {
    // Paystack redirects to a "callback_url" (or its own success page) once the charge
    // resolves. We don't control that URL from here, so we treat any navigation away from
    // Paystack's own domain, or one containing our reference, as "payment attempt finished"
    // and immediately ask our backend (source of truth) to verify — never trust the URL itself.
    const url: string = navState?.url || ''
    if (!reference) return
    if (url.includes(CALLBACK_MARKER) || (!url.includes('paystack.com') && !url.includes('paystack.co') && url !== checkoutUrl)) {
      verifyPayment()
    }
  }

  const verifyPayment = async () => {
    if (!reference || step === 'verifying' || step === 'success') return
    setStep('verifying')
    try {
      const result: any = await paymentAPI.verify(reference)
      if (result?.status === 'success') {
        await refreshUser()
        setStep('success')
      } else {
        setVerifyError(result?.message || 'Payment was not completed.')
        setStep('checkout')
      }
    } catch (e: any) {
      setVerifyError(e?.message || 'Could not verify payment. If you were charged, it will still be applied shortly.')
      setStep('checkout')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={handleClose}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
            {step === 'success' ? 'Welcome to Premium!' : 'Upgrade to Premium'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {step === 'plan' && (
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.gold + '20', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="star" size={18} color={colors.gold} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.gold }}>VMLTS Premium</Text>
            </View>

            {loadingPlans ? (
              <ActivityIndicator size="large" color={colors.gold} style={{ marginVertical: 40 }} />
            ) : (
              <View style={{ gap: 12, marginBottom: 20 }}>
                {plans.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPlan(p.id as PlanType)}
                    style={{
                      borderRadius: 14, padding: 16, borderWidth: 2,
                      borderColor: selectedPlan === p.id ? colors.gold : colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{p.name}</Text>
                      {selectedPlan === p.id && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
                      GHS {p.priceGhs}
                      <Text style={{ fontSize: 14, fontWeight: '400', color: colors.textSecondary }}>
                        {p.interval === 'annually' ? '/year' : '/month'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {plans.length > 0 && (
              <View style={{ borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 24, gap: 12 }}>
                {(plans.find(p => p.id === selectedPlan)?.features || []).map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gold + '20' }}>
                      <Ionicons name="checkmark" size={16} color={colors.gold} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={{ padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.gold, opacity: (starting || plans.length === 0) ? 0.6 : 1 }}
              onPress={startCheckout}
              disabled={starting || plans.length === 0}
            >
              {starting
                ? <ActivityIndicator size={20} color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Continue to Payment</Text>
              }
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 14 }}>
              <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Secured by Paystack — card details never touch VMLTS</Text>
            </View>
          </ScrollView>
        )}

        {step === 'checkout' && checkoutUrl && (
          <View style={{ flex: 1 }}>
            {verifyError && (
              <View style={{ padding: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{verifyError}</Text>
              </View>
            )}
            {webViewError ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>Couldn't load the payment page</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>{webViewError}</Text>
                <TouchableOpacity
                  onPress={() => { setWebViewError(null); setWebViewKey(k => k + 1) }}
                  style={{ marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.gold }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <WebView
                key={webViewKey}
                source={{ uri: checkoutUrl }}
                onNavigationStateChange={handleNavStateChange}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />}
                onError={(syntheticEvent) => {
                  const { description } = syntheticEvent.nativeEvent
                  setWebViewError(description || 'The payment page failed to load. Check your internet connection and try again.')
                }}
                onHttpError={(syntheticEvent) => {
                  const { statusCode } = syntheticEvent.nativeEvent
                  setWebViewError(`The payment page returned an error (HTTP ${statusCode}). Try again in a moment.`)
                }}
              />
            )}
          </View>
        )}

        {step === 'verifying' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={{ fontSize: 15, color: colors.textSecondary }}>Confirming your payment...</Text>
          </View>
        )}

        {step === 'success' && (
          <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center', paddingTop: 24 }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent + '20', marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 }}>You are Premium!</Text>
            <Text style={{ fontSize: 15, textAlign: 'center', color: colors.textSecondary, marginBottom: 24 }}>All features are now unlocked.</Text>
            <TouchableOpacity style={{ padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.accent, width: '100%' }} onPress={handleClose}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Start Trading</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}
