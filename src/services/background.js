import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { saveSession, todayLabel } from './db';

export const BACKGROUND_TASK = 'com.cyysongyy.gaitbalance.backgroundfetch';

// Register the background task handler
TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    // In background fetch we can't access motion sensors directly.
    // Instead: record a "check-in" entry and send a reminder if user
    // hasn't walked today.
    const today = new Date().toLocaleDateString('zh-TW');
    console.log('[BG] Background fetch ran at', today);

    // Send a gentle notification reminder if it's been a while
    await scheduleWalkReminder();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('[BG] Task failed:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
        status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.log('[BG] Background fetch not available');
      return false;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,   // keep running after app close
      startOnBoot: true,
    });
    console.log('[BG] Background task registered');
    return true;
  } catch (e) {
    console.error('[BG] Registration failed:', e);
    return false;
  }
}

export async function unregisterBackgroundTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK);
  } catch (e) { /* ignore */ }
}

// ── Notifications ──
export async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge:  false,
    }),
  });
  return true;
}

async function scheduleWalkReminder() {
  const hour = new Date().getHours();
  // Only remind between 8am and 9pm
  if (hour < 8 || hour > 21) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '步態追蹤提醒',
      body:  '打開 App 並走動，自動記錄今日步態平衡 🚶',
    },
    trigger: null, // immediate
  });
}

export async function sendSessionNotification({ score, grade, dur }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `步態記錄完成 · ${grade}`,
      body:  `平衡分數 ${score}・時長 ${dur}秒`,
    },
    trigger: null,
  });
}
