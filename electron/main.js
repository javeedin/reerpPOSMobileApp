const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

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
