const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectCookieFile: () => ipcRenderer.invoke('dialog:selectCookieFile'),
  startDownload: (args) => ipcRenderer.send('download:start', args),

  // Queue APIs
  addToQueue: (downloadItem) => ipcRenderer.send('queue:add', downloadItem),
  removeFromQueue: (id) => ipcRenderer.send('queue:remove', id),
  retryDownload: (id) => ipcRenderer.send('queue:retry', id),
  clearQueue: () => ipcRenderer.send('queue:clear'),
  getQueueStatus: () => ipcRenderer.invoke('queue:getStatus'),

  onDownloadLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('download:log', listener);
    return () => ipcRenderer.removeListener('download:log', listener);
  },

  onDownloadClearLog: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('download:clearLog', listener);
    return () => ipcRenderer.removeListener('download:clearLog', listener);
  },

  onDownloadFinished: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('download_finished', listener);
    return () => ipcRenderer.removeListener('download_finished', listener);
  },

  onQueueStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('queue:status', listener);
    return () => ipcRenderer.removeListener('queue:status', listener);
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
