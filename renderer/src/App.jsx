import React, { useState, useEffect, useRef } from 'react';
import './App.css'; // Sẽ tạo file này sau

function App() {
  const [url, setUrl] = useState('');
  const [savePath, setSavePath] = useState('');
  const [log, setLog] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const logEndRef = useRef(null);

  // Tự động cuộn log xuống dưới
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Lắng nghe log từ main process
  useEffect(() => {
    const removeListener = window.electronAPI.onDownloadLog((message) => {
      setLog(prevLog => prevLog + message + '\n');
      
      if (message.includes('--- Tiến trình kết thúc')) {
        setIsDownloading(false);
      }
      if (message.includes('SUCCESS:')) {
        alert('Tải video thành công!');
      }
    });

    // Cleanup khi component unmount
    return () => {
      removeListener();
    };
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setSavePath(path);
    }
  };

  const handleDownload = () => {
    if (!url) {
      alert('Vui lòng nhập link video.');
      return;
    }
    if (!savePath) {
      alert('Vui lòng chọn nơi lưu file.');
      return;
    }
    setLog('Bắt đầu quá trình tải...\n');
    setIsDownloading(true);
    window.electronAPI.startDownload({ url, savePath });
  };

  return (
    <div className="container">
      <h1>Video Downloader</h1>
      
      <div className="input-group">
        <label htmlFor="url-input">Link Video:</label>
        <input
          id="url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link YouTube, Facebook, TikTok..."
          disabled={isDownloading}
        />
      </div>

      <div className="input-group">
        <label htmlFor="save-path-input">Lưu vào:</label>
        <div className="path-container">
          <input
            id="save-path-input"
            type="text"
            value={savePath}
            readOnly
            placeholder="Chọn thư mục để lưu file..."
          />
          <button onClick={handleSelectDirectory} disabled={isDownloading}>
            Chọn Thư Mục
          </button>
        </div>
      </div>

      <button className="download-btn" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? 'ĐANG TẢI...' : 'BẮT ĐẦU TẢI'}
      </button>

      <div className="log-area">
        <h2>Nhật ký xử lý:</h2>
        <pre>{log}</pre>
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default App;
