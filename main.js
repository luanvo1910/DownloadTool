const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let resourcesPath;

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadFile(path.join(__dirname, 'renderer/dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }
}

ipcMain.handle('dialog:selectDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.on('download:start', (event, { url, savePath, quality, downloadThumbnail, ignorePlaylist }) => {

  const downloaderExe = path.join(resourcesPath, 'downloader.exe');

  const args = [
      '--url', url,
      '--save-path', savePath,
      '--resources-path', resourcesPath,
      '--quality', quality
  ];
  if (downloadThumbnail) args.push('--thumbnail');
  if (ignorePlaylist) args.push('--no-playlist');

  const process = spawn(downloaderExe, args);
  const sendLog = (data) => event.sender.send('download:log', data.toString());
  process.stdout.on('data', sendLog);
  process.stderr.on('data', sendLog);
  process.on('close', (code) => sendLog(`\n--- Tiến trình kết thúc với mã ${code} ---\n`));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'downloader') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
  
  createWindow();
});
