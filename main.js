const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

let backendProcess = null;

// Path to store encrypted credentials
const credentialsPath = path.join(app.getPath('userData'), 'credentials.enc');
const aiKeyPath = path.join(app.getPath('userData'), 'ai-key.enc');

function startBackend() {
  const backendDir = path.join(__dirname, 'backend');
  const binaryName = process.platform === 'win32' ? 'auxa-server.exe' : 'auxa-server';
  const binaryPath = path.join(backendDir, binaryName);

  ensurePortFree(3000);

  const launchProcess = (command, args) => {
    console.log(`Starting backend server with "${command} ${args.join(' ')}"`);
    backendProcess = spawn(command, args, {
      cwd: backendDir
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Backend failed to start:', error);
      dialog.showErrorBox('Backend Failed', `Failed to start backend process:\n\n${error.message}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });
  };

  if (fs.existsSync(binaryPath)) {
    launchProcess(binaryPath, []);
    return;
  }

  if (!app.isPackaged) {
    console.warn(`Backend binary not found at ${binaryPath}. Falling back to "go run main.go" for development.`);
    launchProcess('go', ['run', 'main.go']);
    return;
  }

  const message = `Auxa backend binary was not found at:\n${binaryPath}\n\n` +
    'Run "npm run build:backend" before starting the app.';
  console.error(message);
  dialog.showErrorBox('Backend Missing', message);
}

function ensurePortFree(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      const pids = new Set();
      output.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
          }
        }
      });
      pids.forEach(pid => {
        try {
          execSync(`taskkill /PID ${pid} /F`);
          console.log(`Freed port ${port} by killing PID ${pid}`);
        } catch (error) {
          console.warn(`Failed to kill PID ${pid}: ${error.message}`);
        }
      });
    } else {
      const output = execSync(`lsof -ti :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      output.split('\n').filter(Boolean).forEach(pid => {
        try {
          execSync(`kill -9 ${pid}`);
          console.log(`Freed port ${port} by killing PID ${pid}`);
        } catch (error) {
          console.warn(`Failed to kill PID ${pid}: ${error.message}`);
        }
      });
    }
  } catch (error) {
    if (error.status === 1) {
      // No process was using the port
      return;
    }
    console.warn(`Unable to inspect port ${port}: ${error.message}`);
  }
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

  // Open external links in the system's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open in external browser (Chrome, Safari, etc.)
    shell.openExternal(url);
    return { action: 'deny' }; // Prevent opening in Electron
  });

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

ipcMain.handle('save-ai-key', async (event, apiKey) => {
  try {
    const encrypted = safeStorage.encryptString(apiKey);
    fs.writeFileSync(aiKeyPath, encrypted);
    return { success: true };
  } catch (error) {
    console.error('Error saving AI key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ai-key', async () => {
  try {
    if (!fs.existsSync(aiKeyPath)) {
      return null;
    }
    const encrypted = fs.readFileSync(aiKeyPath);
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    console.error('Error reading AI key:', error);
    return null;
  }
});

ipcMain.handle('delete-ai-key', async () => {
  try {
    if (fs.existsSync(aiKeyPath)) {
      fs.unlinkSync(aiKeyPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting AI key:', error);
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
