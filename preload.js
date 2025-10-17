const { contextBridge, ipcRenderer } = require('electron');

// Expose secure storage API to renderer
contextBridge.exposeInMainWorld('secureStorage', {
  saveCredentials: (token, school) => ipcRenderer.invoke('save-credentials', token, school),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  saveAIKey: (apiKey) => ipcRenderer.invoke('save-ai-key', apiKey),
  getAIKey: () => ipcRenderer.invoke('get-ai-key'),
  deleteAIKey: () => ipcRenderer.invoke('delete-ai-key')
});
