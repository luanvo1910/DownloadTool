const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  startDownload: (args) => ipcRenderer.send('download:start', args),

  onDownloadLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('download:log', listener);
    return () => ipcRenderer.removeListener('download:log', listener);
  },
});
