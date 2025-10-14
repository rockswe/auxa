const { contextBridge, ipcRenderer } = require('electron');

// Expose secure storage API to renderer
contextBridge.exposeInMainWorld('secureStorage', {
  saveCredentials: (token, school) => ipcRenderer.invoke('save-credentials', token, school),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials')
});

