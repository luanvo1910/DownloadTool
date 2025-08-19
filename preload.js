const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectCookieFile: () => ipcRenderer.invoke('dialog:selectCookieFile'),
  startDownload: (args) => ipcRenderer.send('download:start', args),

  onDownloadLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('download:log', listener);
    return () => ipcRenderer.removeListener('download:log', listener);
  },

  onDownloadFinished: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('download_finished', listener);
    return () => ipcRenderer.removeListener('download_finished', listener);
  },

  onUpdateAvailable: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('update_available', listener);
    return () => ipcRenderer.removeListener('update_available', listener);
  },

  onUpdateDownloaded: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('update_downloaded', listener);
    return () => ipcRenderer.removeListener('update_downloaded', listener);
  },

  quitAndInstall: () => ipcRenderer.send('quit_and_install')
});
