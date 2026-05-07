import React from 'react'
import { ThemeProvider } from './src/context/ThemeContext'
import { AuthProvider } from './src/context/AuthContext'
import RootNavigator from './src/navigation/RootNavigator'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  )
}
