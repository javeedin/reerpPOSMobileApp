import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@notif_settings';
const NOTIF_PORT = 8766;

export const getNotifSettings = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : { enabled: false, desktopIp: '' };
  } catch {
    return { enabled: false, desktopIp: '' };
  }
};

export const saveNotifSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('[Notif] Failed to save settings:', e);
  }
};

export const sendPickNotification = async ({ orderNumber, pickerName, qty, itemDescription }) => {
  try {
    const settings = await getNotifSettings();
    if (!settings.enabled || !settings.desktopIp) return;

    const url = `http://${settings.desktopIp}:${NOTIF_PORT}/notify`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order_update',
        orderNumber,
        message: `Order picked by ${pickerName}`,
        sender: pickerName,
        data: { qty, itemDescription },
      }),
    });
    console.log('[Notif] Sent pick notification for', orderNumber);
  } catch (e) {
    console.warn('[Notif] Failed to send notification:', e.message);
  }
};

export const sendTestNotification = async (desktopIp) => {
  const url = `http://${desktopIp}:${NOTIF_PORT}/notify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'alert',
      orderNumber: 'TEST',
      message: 'Test notification from REERP Mobile',
      sender: 'Mobile App',
      data: {},
    }),
  });
  return res.ok;
};
