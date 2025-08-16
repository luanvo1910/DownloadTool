const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let resourcesPath;

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

ipcMain.on('download:start', (event, { url, savePath, quality, downloadThumbnail, ignorePlaylist, cookiesPath }) => {
  const downloaderExe = path.join(resourcesPath, 'downloader.exe');
  const args = [
      '--url', url,
      '--save-path', savePath,
      '--resources-path', resourcesPath,
      '--quality', quality
  ];
  if (downloadThumbnail) args.push('--thumbnail');
  if (ignorePlaylist) args.push('--no-playlist');
  if (cookiesPath) args.push('--cookies-path', cookiesPath);

  const process = spawn(downloaderExe, args);
  const sendLog = (data) => event.sender.send('download:log', data.toString());
  process.stdout.on('data', sendLog);
  process.stderr.on('data', sendLog);
  process.on('close', (code) => sendLog(`\n--- Tiến trình kết thúc với mã ${code} ---\n`));
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
