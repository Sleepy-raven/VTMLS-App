import { Platform } from 'react-native'

// ← Update this to your current IP when it changes
export const LOCAL_IP = '172.20.10.3'

export const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8080/api'
  : `http://${LOCAL_IP}:8080/api`

export const SOCKET_URL = Platform.OS === 'web'
  ? 'http://localhost:5003'
  : `http://${LOCAL_IP}:5003`