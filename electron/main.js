const { app, BrowserWindow, Menu, Notification } = require('electron');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

let mainWindow;

// ─── Notification server ──────────────────────────────────────────────────────
const NOTIF_PORT = 8766;
let notifServer = null;
let wss = null;
const mobileClients = new Set(); // connected mobile WebSocket clients

function broadcastToMobile(payload) {
  const msg = JSON.stringify(payload);
  for (const client of mobileClients) {
    try { if (client.readyState === 1) client.send(msg); } catch {}
  }
}

function showDesktopNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function startNotifServer() {
  const server = http.createServer((req, res) => {
    // CORS headers so any origin can POST
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Simple web UI for sending messages to mobile
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WMS Notifications</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; background: #0A1628; color: #fff; }
    h2 { color: #4FC3F7; } label { display: block; margin-top: 16px; color: #90CAF9; font-size: 13px; }
    input, textarea, select { width: 100%; padding: 10px; margin-top: 6px; border-radius: 8px; border: 1px solid #1E3A5F; background: #0D2137; color: #fff; font-size: 14px; box-sizing: border-box; }
    button { margin-top: 20px; width: 100%; padding: 12px; background: #1565C0; color: #fff; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
    button:hover { background: #1976D2; }
    #status { margin-top: 14px; font-size: 13px; color: #81C784; min-height: 20px; }
    #count { font-size: 12px; color: #78909C; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>📦 WMS — Send to Mobile</h2>
  <label>Message type</label>
  <select id="type">
    <option value="alert">Alert</option>
    <option value="order_update">Order Update</option>
    <option value="info">Info</option>
  </select>
  <label>Order number (optional)</label>
  <input id="order" placeholder="e.g. 100456" />
  <label>Message</label>
  <textarea id="msg" rows="3" placeholder="Type your message to the picker..."></textarea>
  <button onclick="send()">Send to Mobile</button>
  <div id="status"></div>
  <div id="count">Connected mobiles: <span id="cc">0</span></div>
  <script>
    async function send() {
      const type = document.getElementById('type').value;
      const orderNumber = document.getElementById('order').value.trim();
      const message = document.getElementById('msg').value.trim();
      if (!message) { document.getElementById('status').textContent = 'Enter a message.'; return; }
      try {
        const r = await fetch('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, orderNumber, message, sender: 'Desktop' }) });
        const d = await r.json();
        document.getElementById('status').textContent = d.sent > 0 ? '✅ Sent to ' + d.sent + ' device(s)' : '⚠️ No mobiles connected';
      } catch(e) { document.getElementById('status').textContent = '❌ ' + e.message; }
    }
    setInterval(async () => {
      try { const r = await fetch('/status'); const d = await r.json(); document.getElementById('cc').textContent = d.clients; } catch {}
    }, 3000);
  </script>
</body>
</html>`);
      return;
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ clients: mobileClients.size }));
      return;
    }

    // Collect POST body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch {}

      // Mobile → Desktop notification
      if (req.method === 'POST' && req.url === '/notify') {
        const title = payload.type === 'ship_confirm' ? '🚚 Ship Confirmed' : '📦 Pick Confirmed';
        const msg = payload.message || `Order ${payload.orderNumber}`;
        showDesktopNotification(title, msg);
        console.log('[Notif] Desktop notification:', title, msg);
        // Also forward to any other mobile clients watching (broadcast)
        broadcastToMobile({ ...payload, from: 'mobile' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Desktop → Mobile push
      if (req.method === 'POST' && req.url === '/send') {
        broadcastToMobile({ ...payload, from: 'desktop' });
        console.log('[Notif] Pushed to', mobileClients.size, 'mobile(s):', payload.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sent: mobileClients.size }));
        return;
      }

      res.writeHead(404); res.end();
    });
  });

  // Upgrade HTTP → WebSocket for mobile connections
  wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      mobileClients.add(ws);
      console.log('[Notif] Mobile connected. Total:', mobileClients.size);
      ws.on('close', () => { mobileClients.delete(ws); console.log('[Notif] Mobile disconnected. Total:', mobileClients.size); });
      ws.on('error', () => mobileClients.delete(ws));
    });
  });

  server.listen(NOTIF_PORT, '0.0.0.0', () => {
    console.log(`[Notif] Server listening on port ${NOTIF_PORT}`);
    console.log(`[Notif] Web UI: http://localhost:${NOTIF_PORT}`);
  });

  server.on('error', (e) => console.warn('[Notif] Server error:', e.message));
  notifServer = server;
}
// ─────────────────────────────────────────────────────────────────────────────

// Determine if we're in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

console.log('[Electron] Starting app, isDev:', isDev);
console.log('[Electron] NODE_ENV:', process.env.NODE_ENV);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable CORS for API requests (Oracle Fusion Cloud doesn't support CORS)
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'FCPos Desktop',
    backgroundColor: '#0A1628',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] Window ready to show');
    mainWindow.show();
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Failed to load:', errorDescription, 'URL:', validatedURL);
    // Retry loading after 2 seconds if it's a connection error
    if (errorCode === -102 || errorCode === -106) {
      console.log('[Electron] Retrying in 2 seconds...');
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:8081');
      }, 2000);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded successfully');
  });

  // Load the app
  const loadURL = isDev ? 'http://localhost:8081' : `file://${path.join(__dirname, '../dist/index.html')}`;
  console.log('[Electron] Loading URL:', loadURL);

  if (isDev) {
    // Development: Load from Expo web server
    mainWindow.loadURL('http://localhost:8081');

    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create custom menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit FCPos' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About FCPos',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About FCPos',
              message: 'FCPos Desktop',
              detail: 'Version 1.0.0\nPOS & CRM Management System'
            });
          }
        }
      ]
    }
  ];

  // Add DevTools in development
  if (isDev) {
    template[1].submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools' }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
  startNotifServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
