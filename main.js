const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let backendProcess = null;

// Path to store encrypted credentials
const credentialsPath = path.join(app.getPath('userData'), 'credentials.enc');

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'auxa-server');
  
  console.log('Starting backend server...');
  backendProcess = spawn(backendPath, [], {
    cwd: path.join(__dirname, 'backend')
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#f5f5f5',
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development (optional)
  // mainWindow.webContents.openDevTools();
}

// Secure storage handlers using safeStorage API
ipcMain.handle('save-credentials', async (event, token, school) => {
  try {
    const data = JSON.stringify({ token, school });
    const encrypted = safeStorage.encryptString(data);
    fs.writeFileSync(credentialsPath, encrypted);
    return { success: true };
  } catch (error) {
    console.error('Error saving credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-credentials', async () => {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return null;
    }
    const encrypted = fs.readFileSync(credentialsPath);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error reading credentials:', error);
    return null;
  }
});

ipcMain.handle('delete-credentials', async () => {
  try {
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting credentials:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Start backend server
  startBackend();
  
  // Wait a moment for backend to start, then create window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  // Kill backend process when app quits
  if (backendProcess) {
    backendProcess.kill();
  }
});

