const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // chọn thư mục
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  // chọn file cookie
  selectCookieFile: () => ipcRenderer.invoke('dialog:selectCookieFile'),
  // bắt đầu download
  startDownload: (args) => ipcRenderer.send('download:start', args),

  // log quá trình tải
  onDownloadLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('download:log', listener);
    return () => ipcRenderer.removeListener('download:log', listener);
  },

  // 🆕 sự kiện tải xong
  onDownloadFinished: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('download_finished', listener);
    return () => ipcRenderer.removeListener('download_finished', listener);
  },

  // 🆕 update
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
