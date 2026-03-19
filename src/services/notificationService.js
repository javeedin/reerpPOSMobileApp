import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const STORAGE_KEY = '@notif_settings';
const NOTIF_PORT = 8766;

// ─── Desktop → Mobile WebSocket listener ─────────────────────────────────────
let _ws = null;
let _reconnectTimer = null;
let _onMessageCb = null;
let _activeIp = null;
let _activePort = null;

export const startDesktopListener = (ip, port, onMessage) => {
  stopDesktopListener();
  if (!ip) return;
  _onMessageCb = onMessage;
  _activeIp = ip;
  _activePort = port || NOTIF_PORT;
  _connectWs();
};

function _connectWs() {
  try {
    const ws = new WebSocket(`ws://${_activeIp}:${_activePort}`);
    _ws = ws;

    ws.onopen = () => console.log('[Notif] WS connected to desktop');
    ws.onmessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        // Only handle messages pushed from desktop (not echo of our own sends)
        if (data.from === 'desktop' && _onMessageCb) _onMessageCb(data);
      } catch {}
    };
    ws.onerror = () => {}; // handled by onclose
    ws.onclose = () => {
      _ws = null;
      // Auto-reconnect after 5s if listener is still active
      if (_activeIp) {
        _reconnectTimer = setTimeout(_connectWs, 5000);
      }
    };
  } catch (e) {
    console.warn('[Notif] WS connect failed:', e.message);
  }
}

export const stopDesktopListener = () => {
  _activeIp = null;
  _activePort = null;
  _onMessageCb = null;
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_ws) { try { _ws.close(); } catch {} _ws = null; }
};
// ─────────────────────────────────────────────────────────────────────────────

// Probe a single IP on the notify port with a short timeout
const probeIp = (ip) =>
  new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); resolve(false); }, 800);
    fetch(`http://${ip}:${NOTIF_PORT}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'probe' }),
      signal: controller.signal,
    })
      .then(r => { clearTimeout(timer); resolve(r.ok || r.status < 500); })
      .catch(() => { clearTimeout(timer); resolve(false); });
  });

// Scan the local subnet for a device listening on NOTIF_PORT.
// Strategy: get phone IP → derive subnet → probe in small batches.
export const autoDetectDesktopIp = async (onProgress) => {
  const phoneIp = await Network.getIpAddressAsync();
  if (!phoneIp || phoneIp === '0.0.0.0') throw new Error('Not connected to WiFi');

  const parts = phoneIp.split('.');
  const subnet = parts.slice(0, 3).join('.'); // e.g. "192.168.1"
  const phoneLastOctet = parseInt(parts[3]);

  // Build candidate list: gateway first, then all others except phone itself
  const candidates = [];
  for (let i = 1; i <= 254; i++) {
    if (i !== phoneLastOctet) candidates.push(`${subnet}.${i}`);
  }
  // Prioritise common desktop IPs: .1, .2, .100-.110, .200-.210
  const priority = [
    ...['1','2','100','101','102','103','104','105','200','201','202'].map(n => `${subnet}.${n}`),
  ];
  const ordered = [
    ...priority.filter(ip => ip !== `${subnet}.${phoneLastOctet}`),
    ...candidates.filter(ip => !priority.includes(ip)),
  ];

  const BATCH = 10;
  for (let i = 0; i < ordered.length; i += BATCH) {
    const batch = ordered.slice(i, i + BATCH);
    if (onProgress) onProgress(Math.round((i / ordered.length) * 100));
    const results = await Promise.all(batch.map(ip => probeIp(ip).then(ok => ok ? ip : null)));
    const found = results.find(r => r !== null);
    if (found) return found;
  }
  return null;
};

export const getNotifSettings = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : { enabled: false, desktopIp: '', desktopPort: String(NOTIF_PORT) };
  } catch {
    return { enabled: false, desktopIp: '', desktopPort: String(NOTIF_PORT) };
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

    const port = settings.desktopPort || NOTIF_PORT;
    const url = `http://${settings.desktopIp}:${port}/notify`;
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

export const sendShipNotification = async ({ orderNumber, pickerName, itemCount }) => {
  try {
    const settings = await getNotifSettings();
    if (!settings.enabled || !settings.desktopIp) return;

    const port = settings.desktopPort || NOTIF_PORT;
    const url = `http://${settings.desktopIp}:${port}/notify`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ship_confirm',
        orderNumber,
        message: `Order ${orderNumber} ship confirmed by ${pickerName}`,
        sender: pickerName,
        data: { itemCount },
      }),
    });
    console.log('[Notif] Sent ship notification for', orderNumber);
  } catch (e) {
    console.warn('[Notif] Failed to send ship notification:', e.message);
  }
};

export const sendTestNotification = async (desktopIp, desktopPort) => {
  const port = desktopPort || NOTIF_PORT;
  const url = `http://${desktopIp}:${port}/notify`;
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
