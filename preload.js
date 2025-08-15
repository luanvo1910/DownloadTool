const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Hàm để gọi dialog chọn thư mục từ renderer
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // Hàm để bắt đầu quá trình tải
  startDownload: (args) => ipcRenderer.send('download:start', args),

  // Hàm để lắng nghe log từ main process
  onDownloadLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('download:log', listener);
    // Trả về một hàm để gỡ bỏ listener khi component bị unmount
    return () => ipcRenderer.removeListener('download:log', listener);
  },
});
