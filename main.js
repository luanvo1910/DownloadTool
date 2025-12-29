const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let resourcesPath;

// Hàng chờ download
let downloadQueue = [];
let isDownloading = false;
let currentDownloadProcess = null;
let currentDownloadId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'renderer/dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.handle('dialog:selectDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:selectCookieFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    return canceled ? null : filePaths[0];
});

// Thêm download vào hàng chờ
ipcMain.on('queue:add', (event, downloadItem) => {
  const id = Date.now() + Math.random();
  const queueItem = {
    id,
    ...downloadItem,
    status: 'pending', // pending, downloading, completed, failed
    addedAt: new Date().toISOString()
  };
  downloadQueue.push(queueItem);
  updateQueueStatus();
  
  // Nếu chưa đang download, bắt đầu download ngay
  if (!isDownloading) {
    processNextDownload();
  }
});

// Xóa download khỏi hàng chờ
ipcMain.on('queue:remove', (event, id) => {
  const index = downloadQueue.findIndex(item => item.id === id);
  if (index !== -1) {
    // Nếu đang download item này, dừng nó
    if (currentDownloadId === id && currentDownloadProcess) {
      currentDownloadProcess.kill();
      currentDownloadProcess = null;
      currentDownloadId = null;
      isDownloading = false;
    }
    downloadQueue.splice(index, 1);
    updateQueueStatus();
    
    // Nếu không đang download, bắt đầu download tiếp theo
    if (!isDownloading) {
      processNextDownload();
    }
  }
});

// Retry download (đặt lại status thành pending)
ipcMain.on('queue:retry', (event, id) => {
  const item = downloadQueue.find(item => item.id === id);
  if (item && item.status === 'failed') {
    item.status = 'pending';
    updateQueueStatus();
    
    // Nếu không đang download, bắt đầu download ngay
    if (!isDownloading) {
      processNextDownload();
    }
  }
});

// Xóa tất cả download khỏi hàng chờ
ipcMain.on('queue:clear', () => {
  if (currentDownloadProcess) {
    currentDownloadProcess.kill();
    currentDownloadProcess = null;
  }
  downloadQueue = [];
  isDownloading = false;
  currentDownloadId = null;
  updateQueueStatus();
});

// Lấy trạng thái hàng chờ
ipcMain.handle('queue:getStatus', () => {
  return {
    queue: downloadQueue,
    isDownloading,
    currentDownloadId
  };
});

// Xử lý download tiếp theo trong hàng chờ
function processNextDownload() {
  if (isDownloading || downloadQueue.length === 0) {
    return;
  }

  const nextItem = downloadQueue.find(item => item.status === 'pending');
  if (!nextItem) {
    return;
  }

  isDownloading = true;
  currentDownloadId = nextItem.id;
  nextItem.status = 'downloading';
  updateQueueStatus();

  // Xóa log cũ và bắt đầu log mới
  mainWindow.webContents.send('download:clearLog');
  mainWindow.webContents.send('download:log', `========== Bắt đầu tải: ${nextItem.url} ==========\n`);

  const downloaderExe = path.join(resourcesPath, 'downloader.exe');
  const args = [
      '--url', nextItem.url,
      '--save-path', nextItem.savePath,
      '--resources-path', resourcesPath,
      '--quality', nextItem.quality,
      '--format', nextItem.downloadFormat
  ];
  if (nextItem.downloadThumbnail) args.push('--thumbnail');
  if (nextItem.ignorePlaylist) args.push('--no-playlist');
  if (nextItem.cookiesPath) args.push('--cookies-path', nextItem.cookiesPath);

  currentDownloadProcess = spawn(downloaderExe, args);
  const sendLog = (data) => {
    mainWindow.webContents.send('download:log', data.toString());
  };
  
  currentDownloadProcess.stdout.on('data', sendLog);
  currentDownloadProcess.stderr.on('data', sendLog);

  currentDownloadProcess.on('close', (code) => {
    sendLog(`\n--- Tiến trình kết thúc với mã ${code} ---\n`);
    
    // Cập nhật trạng thái
    const item = downloadQueue.find(item => item.id === currentDownloadId);
    if (item) {
      if (code === 0) {
        item.status = 'completed';
        mainWindow.webContents.send('download_finished', { id: currentDownloadId });
      } else {
        item.status = 'failed';
      }
      updateQueueStatus(); // Cập nhật UI ngay lập tức
    }

    // Reset và xử lý download tiếp theo
    currentDownloadProcess = null;
    currentDownloadId = null;
    isDownloading = false;
    
    // Xử lý download tiếp theo (skip các item failed)
    processNextDownload();
  });
}

// Cập nhật trạng thái hàng chờ cho renderer
function updateQueueStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue:status', {
      queue: downloadQueue,
      isDownloading,
      currentDownloadId
    });
  }
}

// Giữ lại handler cũ để tương thích (nếu cần)
ipcMain.on('download:start', (event, downloadItem) => {
  // Chuyển sang sử dụng hàng chờ
  const id = Date.now() + Math.random();
  const queueItem = {
    id,
    ...downloadItem,
    status: 'pending',
    addedAt: new Date().toISOString()
  };
  downloadQueue.push(queueItem);
  updateQueueStatus();
  
  // Nếu chưa đang download, bắt đầu download ngay
  if (!isDownloading) {
    processNextDownload();
  }
});

ipcMain.on('quit_and_install', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(() => {
  resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});
