const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  triggerPrint: () => ipcRenderer.send('print-window'),
  onToggleTheme: (callback) => {
    const subscription = (_event, val) => callback(val);
    ipcRenderer.on('toggle-theme', subscription);
    return () => ipcRenderer.removeListener('toggle-theme', subscription);
  }
});
