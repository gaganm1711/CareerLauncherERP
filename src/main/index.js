const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Disable hardware acceleration to prevent conflicts/black screens
app.disableHardwareAcceleration();

// Set up central log file paths
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbDir = path.join(appDataDir, 'career-launcher-erp');
const logDir = path.join(dbDir, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFilePath = path.join(logDir, 'app.log');

// Log writer helper
function writeToLog(type, message) {
  const time = new Date().toISOString();
  const logStr = `[${time}] [ELECTRON-${type}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logStr);
  } catch (err) {
    console.error("Failed to write electron log:", err.message);
  }
}

// Start Express Backend inside the desktop process
writeToLog('INFO', 'Spawning Express backend...');
require('../backend/server');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 768,
    title: "Career Launcher Tuition Classes, Tumsar",
    icon: path.join(__dirname, '../frontend/src/logo_square.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Retry loading if connection fails (e.g. server booting up)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeToLog('WARN', `Failed to load URL: ${validatedURL}. Error: ${errorDescription} (${errorCode}). Retrying in 2 seconds...`);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL(validatedURL);
      }
    }, 2000);
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    writeToLog('INFO', 'Loading client from Vite Dev Server (port 3000)...');
    mainWindow.loadURL('http://127.0.0.1:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    writeToLog('INFO', 'Loading static React bundle in production...');
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Capture console log outputs from the webContents window and route them to central app.log
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const lvl = levels[level] || 'LOG';
    writeToLog(`RENDERER-${lvl}`, `${message} (${path.basename(sourceId)}:${line})`);
  });

  // Handle local keyboard bindings inside window focus
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Ctrl + P or Cmd + P -> triggers printable view
    if ((input.control || input.meta) && input.key.toLowerCase() === 'p') {
      event.preventDefault();
      writeToLog('INFO', 'Ctrl+P shortcut intercepted, triggering print dialog...');
      mainWindow.webContents.print();
    }
    
    // Ctrl + T or Cmd + T -> triggers toggle theme
    if ((input.control || input.meta) && input.key.toLowerCase() === 't') {
      event.preventDefault();
      writeToLog('INFO', 'Ctrl+T shortcut intercepted, toggling color theme...');
      mainWindow.webContents.send('toggle-theme');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.on('print-window', (event) => {
  writeToLog('INFO', 'IPC print-window command received. Launching print interface...');
  if (mainWindow) {
    mainWindow.webContents.print({
      printBackground: true,
      color: true
    });
  }
});

app.on('ready', () => {
  writeToLog('INFO', 'Application ready. Creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  writeToLog('INFO', 'All windows closed. Exiting process.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
