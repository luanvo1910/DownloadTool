import React, { useState, useEffect, useRef } from 'react';
import './App.css'; // Import file CSS

function App() {
  const [url, setUrl] = useState('');
  const [savePath, setSavePath] = useState('');
  const [log, setLog] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const logEndRef = useRef(null);

  // --- State cho các tùy chọn tải xuống ---
  const [quality, setQuality] = useState('1080p');
  const [downloadThumbnail, setDownloadThumbnail] = useState(true);
  const [ignorePlaylist, setIgnorePlaylist] = useState(true);
  
  // --- State mới để quản lý việc mở rộng log ---
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  // Tự động cuộn log xuống dưới
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Lắng nghe log từ main process
  useEffect(() => {
    const removeListener = window.electronAPI.onDownloadLog((message) => {
      setLog(prevLog => prevLog + message);
      
      if (message.includes('--- Tiến trình kết thúc')) {
        setIsDownloading(false);
      }
    });
    return () => removeListener();
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setSavePath(path);
    }
  };

  const handleDownload = () => {
    if (!url || !savePath) {
      alert('Vui lòng nhập link video và chọn nơi lưu file.');
      return;
    }
    setLog('Bắt đầu quá trình tải...\n');
    setIsDownloading(true);
    
    window.electronAPI.startDownload({
      url,
      savePath,
      quality,
      downloadThumbnail,
      ignorePlaylist
    });
  };

  return (
    <div className="container">
      <h1>Simple Video Downloader</h1>
      
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

      <div className="options-container">
        <div className="input-group">
          <label htmlFor="quality-select">Chất lượng:</label>
          <select id="quality-select" value={quality} onChange={(e) => setQuality(e.target.value)} disabled={isDownloading}>
            <option value="best">Tốt nhất (4K, 2K...)</option>
            <option value="1080p">Tối đa 1080p</option>
            <option value="720p">Tối đa 720p</option>
          </select>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="thumbnail-checkbox"
            checked={downloadThumbnail}
            onChange={(e) => setDownloadThumbnail(e.target.checked)}
            disabled={isDownloading}
          />
          <label htmlFor="thumbnail-checkbox">Tải cả ảnh bìa (Thumbnail)</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="playlist-checkbox"
            checked={ignorePlaylist}
            onChange={(e) => setIgnorePlaylist(e.target.checked)}
            disabled={isDownloading}
          />
          <label htmlFor="playlist-checkbox">Chỉ tải 1 video (bỏ qua playlist)</label>
        </div>
      </div>

      <button className="download-btn" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? 'ĐANG TẢI...' : 'BẮT ĐẦU TẢI'}
      </button>

      <div className={`log-area ${isLogExpanded ? 'expanded' : ''}`}>
        <div className="log-header">
          <h2>Nhật ký xử lý:</h2>
          <button className="expand-btn" onClick={() => setIsLogExpanded(!isLogExpanded)}>
            {isLogExpanded ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>
        <pre>{log}</pre>
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default App;
