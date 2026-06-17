import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

// Requests notification permission and returns an Expo push token, or null if the user
// declined, isn't on a physical device, or something else prevented registration.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null // push tokens don't work on simulators/emulators

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch (e) {
    console.log('Push notification registration error:', e)
    return null
  }
}
