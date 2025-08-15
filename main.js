const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Xử lý việc chọn thư mục lưu file
ipcMain.handle('dialog:selectDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return canceled ? null : filePaths[0];
});

// Xử lý khi người dùng nhấn nút tải
ipcMain.on('download:start', (event, { url, savePath }) => {
  const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
  const downloaderExePath = path.join(resourcesPath, 'downloader.exe');

  // *** PHẦN SỬA LỖI ***
  // Thêm tùy chọn `env` để buộc Python sử dụng mã hóa UTF-8
  const downloaderProcess = spawn(downloaderExePath, [
    '--url', url,
    '--save-path', savePath,
    '--resources-path', resourcesPath
  ], {
    env: { ...process.env, PYTHONIOENCODING: 'UTF-8' }
  });

  const sendLog = (message) => {
    event.sender.send('download:log', message);
  };

  downloaderProcess.stdout.on('data', (data) => {
    sendLog(data.toString()); // Bỏ .trim() để không làm mất định dạng
  });

  downloaderProcess.stderr.on('data', (data) => {
    sendLog(`ERROR: ${data.toString()}`);
  });
  
  downloaderProcess.on('error', (err) => {
    sendLog(`FATAL ERROR: Không thể khởi chạy tiến trình. ${err.message}`);
  });

  downloaderProcess.on('close', (code) => {
    sendLog(`--- Tiến trình kết thúc với mã ${code} ---\n`);
  });
});
