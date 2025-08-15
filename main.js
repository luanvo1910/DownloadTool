const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, 'assets/icon.png'), // Icon cửa sổ
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Xử lý lỗi màn hình trắng khi build
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'renderer/dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }
}

// Xử lý dialog chọn thư mục
ipcMain.handle('dialog:selectDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

// Xử lý yêu cầu tải video với đầy đủ tùy chọn
ipcMain.on('download:start', (event, { url, savePath, quality, downloadThumbnail, ignorePlaylist }) => {
    
    // Xác định đường dẫn đến thư mục resources
    const resourcesPath = app.isPackaged
        ? process.resourcesPath
        : path.join(__dirname, 'resources');

    // Đường dẫn đến file downloader.exe ở thư mục gốc
    const downloaderExe = path.join(__dirname, 'downloader.exe');

    // Xây dựng mảng tham số một cách linh hoạt
    const args = [
        '--url', url,
        '--save-path', savePath,
        '--resources-path', resourcesPath,
        '--quality', quality
    ];

    // Chỉ thêm các cờ boolean nếu chúng là 'true'
    if (downloadThumbnail) {
        args.push('--thumbnail');
    }
    if (ignorePlaylist) {
        args.push('--no-playlist');
    }

    const process = spawn(downloaderExe, args);

    // Gửi log về giao diện
    const sendLog = (data) => {
        event.sender.send('download:log', data.toString());
    };

    process.stdout.on('data', sendLog);
    process.stderr.on('data', sendLog); // Gửi cả lỗi về
    process.on('close', (code) => {
        sendLog(`\n--- Tiến trình kết thúc với mã ${code} ---\n`);
    });
});


// Quản lý vòng đời ứng dụng
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
