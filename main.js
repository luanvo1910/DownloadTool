const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let resourcesPath;

let downloadQueue = [];
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;

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

function updateQueueStatus() {
  if (mainWindow) {
    mainWindow.webContents.send('queue:update', downloadQueue);
  }
}

function processQueue() {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    return;
  }

  const nextJob = downloadQueue.find(job => job.status === 'Pending');
  if (!nextJob) {
    return;
  }

  activeDownloads++;
  nextJob.status = 'Downloading';
  updateQueueStatus();

  const { url, options } = nextJob;
  const downloaderExe = path.join(resourcesPath, 'downloader.exe');
  const args = [
      '--url', url,
      '--save-path', options.savePath,
      '--resources-path', resourcesPath,
      '--quality', options.quality
  ];
  if (options.downloadThumbnail) args.push('--thumbnail');
  if (options.ignorePlaylist) args.push('--no-playlist');
  if (options.cookiesPath) args.push('--cookies-path', options.cookiesPath);

  const process = spawn(downloaderExe, args);

  process.on('close', (code) => {
    activeDownloads--;
    nextJob.status = code === 0 ? 'Completed' : 'Failed';
    updateQueueStatus();
    processQueue();
  });
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

ipcMain.on('download:start', (event, { urls, ...options }) => {
  downloadQueue = urls.map(url => ({
    url,
    status: 'Pending',
    options
  }));
  
  updateQueueStatus();
  
  for (let i = 0; i < MAX_CONCURRENT_DOWNLOADS; i++) {
    processQueue();
  }
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
  dialog.showMessageBox({
    type: 'info',
    title: 'Cập nhật đã sẵn sàng',
    message: 'Một phiên bản mới đã được tải về. Khởi động lại ứng dụng để cài đặt?',
    buttons: ['Khởi động lại', 'Để sau']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
