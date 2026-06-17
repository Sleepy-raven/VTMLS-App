import React, { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { authAPI } from '../../services/api'

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'admin' | 'verify'

export default function LoginScreen({ initialAdminMode }: { initialAdminMode?: boolean } = {}) {
  const { login, register, verifyEmail, resendVerificationCode, isLoading } = useAuth()
  const { colors } = useTheme()
  const [mode, setMode] = useState<Mode>(initialAdminMode ? 'admin' : 'login')

  // Hidden entry point: tapping the logo 5 times within ~1.8s switches to the Admin Sign In
  // form. Same login endpoint either way — the backend/role already decides where the user
  // lands after auth, this just reveals a way in without it being a visible, public option.
  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)
  const handleLogoTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current > 1800) tapCountRef.current = 0
    lastTapRef.current = now
    tapCountRef.current += 1
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      setError(''); setInfoMsg('')
      setMode('admin')
    }
  }
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resending, setResending] = useState(false)

 const ALLOWED_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com']

  // At least 6 characters, with letters and (numbers or symbols) — not purely one type.
  const PASSWORD_HINT = 'Password must be at least 6 characters and include letters and numbers or symbols'
  const isValidPassword = (pw: string) =>
    pw.length >= 6 && /[A-Za-z]/.test(pw) && /[0-9\W_]/.test(pw)

const handleSubmit = async () => {
  setError('')
  if (!email || !password) { setError('Please enter your email and password'); return }
  if (mode === 'register') {
    if (!name) { setError('Please enter your name'); return }
    const domain = email.trim().toLowerCase().split('@')[1]
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      setError('Only ' + ALLOWED_DOMAINS.join(', ') + ' emails are accepted')
      return
    }
    if (!isValidPassword(password)) { setError(PASSWORD_HINT); return }
  }
  const result = (mode === 'login' || mode === 'admin')
    ? await login(email.trim().toLowerCase(), password)
    : await register(name.trim(), email.trim().toLowerCase(), password)
  if (!result.success) {
    // An old registration that never got verified — send them to the code screen instead of
    // just leaving them stuck on a generic error.
    if ((mode === 'login' || mode === 'admin') && result.error?.toLowerCase().includes('verify your email')) {
      await resendVerificationCode(email.trim().toLowerCase())
      setVerifyCode('')
      setInfoMsg('We sent a fresh 6-digit code to ' + email.trim().toLowerCase() + '. Enter it below to activate your account.')
      setMode('verify')
      return
    }
    setError(result.error || 'Something went wrong')
    return
  }
  if (result.requiresVerification) {
    setVerifyCode('')
    setInfoMsg('We sent a 6-digit code to ' + (result.email || email.trim().toLowerCase()) + '. Enter it below to activate your account.')
    setMode('verify')
  }
}

const handleVerifySubmit = async () => {
  setError('')
  if (!verifyCode.trim()) { setError('Please enter the code sent to your email'); return }
  setVerifyLoading(true)
  try {
    const result = await verifyEmail(email.trim().toLowerCase(), verifyCode.trim())
    if (!result.success) { setError(result.error || 'Invalid or expired code'); return }
    // On success, AuthContext already stored the token and set the user — RootNavigator
    // will pick that up and move on from here automatically.
  } finally {
    setVerifyLoading(false)
  }
}

const handleResendCode = async () => {
  setResending(true)
  try {
    await resendVerificationCode(email.trim().toLowerCase())
    setInfoMsg('A new code has been sent to ' + email.trim().toLowerCase() + '.')
  } finally {
    setResending(false)
  }
}

const switchMode = (m: Mode) => {
  setMode(m)
  setError('')
  setInfoMsg('')
}

const handleForgotSubmit = async () => {
  setError('')
  if (!email) { setError('Please enter your email'); return }
  setForgotLoading(true)
  try {
    await authAPI.forgotPassword(email.trim().toLowerCase())
    setInfoMsg('If that email is registered, a 6-digit code has been sent. Check your inbox.')
    setMode('reset')
  } catch (err: any) {
    setError(err.message || 'Could not send reset code. Try again.')
  } finally {
    setForgotLoading(false)
  }
}

const handleResetSubmit = async () => {
  setError('')
  if (!resetCode || !newPassword || !confirmNewPassword) { setError('Please fill in all fields'); return }
  if (!isValidPassword(newPassword)) { setError(PASSWORD_HINT); return }
  if (newPassword !== confirmNewPassword) { setError('Passwords do not match'); return }
  setForgotLoading(true)
  try {
    await authAPI.resetPassword(email.trim().toLowerCase(), resetCode.trim(), newPassword)
    setResetCode(''); setNewPassword(''); setConfirmNewPassword(''); setPassword('')
    Alert.alert('Password Reset', 'Your password has been changed. Please sign in with your new password.')
    switchMode('login')
  } catch (err: any) {
    setError(err.message || 'Could not reset password. Try again.')
  } finally {
    setForgotLoading(false)
  }
}

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0A0E1A' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleLogoTap}>
            <View style={styles.logoCircle}><Ionicons name="trending-up" size={36} color="#fff" /></View>
          </TouchableOpacity>
          <Text style={styles.appName}>VMLTS</Text>
          <Text style={styles.tagline}>Virtual Market Learning & Trading Simulator</Text>
        </View>
        <View style={styles.card}>
          {mode === 'admin' && (
            <TouchableOpacity onPress={() => switchMode('login')} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#9CA3AF" />
              <Text style={styles.backRowText}>Back to Sign In</Text>
            </TouchableOpacity>
          )}
          {(mode === 'login' || mode === 'register') && (
            <View style={styles.modeToggle}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]} onPress={() => switchMode('login')}>
                <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]} onPress={() => switchMode('register')}>
                <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>
          )}

          {(mode === 'forgot' || mode === 'reset' || mode === 'verify') && (
            <TouchableOpacity onPress={() => switchMode('login')} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#9CA3AF" />
              <Text style={styles.backRowText}>Back to Sign In</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>
            {mode === 'login' ? 'Welcome Back'
              : mode === 'register' ? 'Create Account'
              : mode === 'forgot' ? 'Forgot Password'
              : mode === 'admin' ? 'Admin Sign In'
              : mode === 'verify' ? 'Verify Your Email'
              : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to continue'
              : mode === 'register' ? 'Start your trading journey'
              : mode === 'forgot' ? 'Enter your email and we\'ll send you a 6-digit code'
              : mode === 'admin' ? 'Restricted access — authorized personnel only'
              : mode === 'verify' ? 'Enter the 6-digit code we emailed you to activate your account'
              : 'Enter the code we emailed you and choose a new password'}
          </Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {!!infoMsg && !error && (
            <View style={styles.infoBox}>
              <Ionicons name="mail-outline" size={16} color="#3B82F6" />
              <Text style={styles.infoText}>{infoMsg}</Text>
            </View>
          )}

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor="#4B5563" value={name} onChangeText={setName} />
              </View>
            </>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset' || mode === 'admin' || mode === 'verify') && (
            <>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input} placeholder="Enter your email" placeholderTextColor="#4B5563"
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  editable={mode !== 'reset' && mode !== 'verify'}
                />
              </View>
            </>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'admin') && (
            <>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor="#4B5563" value={password} onChangeText={setPassword} secureTextEntry={!showPw} />
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#4B5563" />
                </TouchableOpacity>
              </View>
              {mode === 'register' && (
                <Text style={styles.pwHint}>{PASSWORD_HINT}</Text>
              )}
            </>
          )}

          {mode === 'login' && (
            <TouchableOpacity onPress={() => switchMode('forgot')} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 }}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {mode === 'reset' && (
            <>
              <Text style={styles.label}>6-Digit Code</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="123456" placeholderTextColor="#4B5563" value={resetCode} onChangeText={setResetCode} keyboardType="number-pad" maxLength={6} />
              </View>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="At least 6 characters" placeholderTextColor="#4B5563" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
              </View>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="Re-enter new password" placeholderTextColor="#4B5563" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry autoCapitalize="none" />
              </View>
            </>
          )}

          {mode === 'verify' && (
            <>
              <Text style={styles.label}>6-Digit Code</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color="#4B5563" style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="123456" placeholderTextColor="#4B5563" value={verifyCode} onChangeText={setVerifyCode} keyboardType="number-pad" maxLength={6} />
              </View>
              <TouchableOpacity onPress={handleResendCode} disabled={resending} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 }}>
                <Text style={styles.forgotLink}>{resending ? 'Sending...' : "Didn't get a code? Resend"}</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'login' || mode === 'register' || mode === 'admin' ? (
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>{mode === 'login' ? 'Sign In' : mode === 'admin' ? 'Admin Sign In' : 'Create Account'}</Text>}
            </TouchableOpacity>
          ) : mode === 'forgot' ? (
            <TouchableOpacity style={styles.submitBtn} onPress={handleForgotSubmit} disabled={forgotLoading}>
              {forgotLoading ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>Send Reset Code</Text>}
            </TouchableOpacity>
          ) : mode === 'verify' ? (
            <TouchableOpacity style={styles.submitBtn} onPress={handleVerifySubmit} disabled={verifyLoading}>
              {verifyLoading ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>Verify & Continue</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.submitBtn} onPress={handleResetSubmit} disabled={forgotLoading}>
              {forgotLoading ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>Reset Password</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0A0E1A' },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  appName: { fontSize: 32, fontWeight: '900', color: '#F0F9FF', letterSpacing: 4 },
  tagline: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
  card: { borderRadius: 16, padding: 24, borderWidth: 1, backgroundColor: '#1A2235', borderColor: '#1E2D45' },
  modeToggle: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 10, padding: 3, marginBottom: 20 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#3B82F6' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  modeBtnTextActive: { color: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444420', padding: 10, borderRadius: 8, marginBottom: 16, gap: 8 },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F620', padding: 10, borderRadius: 8, marginBottom: 16, gap: 8 },
  infoText: { color: '#93C5FD', fontSize: 13, flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backRowText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  forgotLink: { color: '#3B82F6', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#1E2D45', backgroundColor: '#111827', marginBottom: 16, paddingHorizontal: 12 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#F9FAFB' },
  pwHint: { fontSize: 11, color: '#F9FAFB', marginTop: -10, marginBottom: 16, lineHeight: 15 },
  submitBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})