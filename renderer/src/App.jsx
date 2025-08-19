import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const CookieModal = ({ onAddCookieFile, onCancel, message }) => (
  <div className="modal-backdrop">
    <div className="modal-content">
      <h2>Yêu cầu Cookies</h2>
      <p>{message}</p>
      <div className="modal-actions">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onAddCookieFile} className="btn-primary">Thêm file Cookies.txt</button>
      </div>
    </div>
  </div>
);

const LogModal = ({ fullLog, onClose }) => (
  <div className="modal-backdrop log-modal-backdrop">
    <div className="modal-content log-modal-content">
      <div className="log-modal-header">
        <h2>Nhật ký xử lý chi tiết</h2>
        <button onClick={onClose} className="btn-close">&times;</button>
      </div>
      <pre className="log-modal-pre">{fullLog}</pre>
    </div>
  </div>
);

const NotifyModal = ({ title, message, actions }) => (
  <div className="modal-backdrop">
    <div className="modal-content">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="modal-actions">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className={a.primary ? 'btn-primary' : 'btn-secondary'}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

function App() {
  const [url, setUrl] = useState('');
  const [savePath, setSavePath] = useState('');
  const [log, setLog] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const logEndRef = useRef(null);

  const [quality, setQuality] = useState('1080p');
  const [downloadThumbnail, setDownloadThumbnail] = useState(true);
  const [ignorePlaylist, setIgnorePlaylist] = useState(true);
  
  const [cookiesPath, setCookiesPath] = useState(null);
  const [cookieFileName, setCookieFileName] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [notify, setNotify] = useState(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  useEffect(() => {
    const removeLogListener = window.electronAPI.onDownloadLog((message) => {
      setLog(prevLog => prevLog + message);
      
      const lowerCaseMessage = message.toLowerCase();
      if (lowerCaseMessage.includes('login to confirm your age') || 
          lowerCaseMessage.includes('sign in to confirm your age') ||
          lowerCaseMessage.includes('this video is available to members only') ||
          (lowerCaseMessage.includes('http error 403') && lowerCaseMessage.includes('forbidden'))) {
        setModalMessage('Video này có thể yêu cầu đăng nhập. Vui lòng cung cấp file cookies.txt để tiếp tục.');
        setIsDownloading(false);
        setShowCookieModal(true);
      }
      
      if (message.includes('--- Tiến trình kết thúc')) {
        setIsDownloading(false);
      }
    });

    const removeFinishedListener = window.electronAPI.onDownloadFinished(() => {
      setNotify({
        title: "Tải xong",
        message: "Video đã được tải thành công!",
        actions: [{ label: "OK", onClick: () => setNotify(null), primary: true }]
      });
    });

    const removeUpdateAvailableListener = window.electronAPI.onUpdateAvailable(() => {
      setNotify({
        title: "Có bản cập nhật mới",
        message: "Ứng dụng sẽ tự động tải bản cập nhật trong nền.",
        actions: [{ label: "OK", onClick: () => setNotify(null), primary: true }]
      });
    });

    const removeUpdateDownloadedListener = window.electronAPI.onUpdateDownloaded(() => {
      setNotify({
        title: "Cập nhật sẵn sàng",
        message: "Bản cập nhật đã tải xong. Bạn có muốn khởi động lại để cài đặt?",
        actions: [
          { label: "Để sau", onClick: () => setNotify(null) },
          { label: "Khởi động lại", onClick: () => { window.electronAPI.quitAndInstall(); }, primary: true }
        ]
      });
    });

    return () => {
      removeLogListener();
      removeFinishedListener();
      removeUpdateAvailableListener();
      removeUpdateDownloadedListener();
    };
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) setSavePath(path);
  };

  const handleDownload = () => {
    if (!url || !savePath) {
      alert('Vui lòng nhập link video và chọn nơi lưu file.');
      return;
    }
    setLog('Bắt đầu quá trình tải...\n');
    setIsDownloading(true);
    
    window.electronAPI.startDownload({
      url, savePath, quality, downloadThumbnail, ignorePlaylist, cookiesPath
    });
  };

  const handleAddCookieFile = async (isRetry = false) => {
    const path = await window.electronAPI.selectCookieFile();
    if (path) {
      setCookiesPath(path);
      setCookieFileName(path.split('\\').pop().split('/').pop());
      setShowCookieModal(false);
      
      if (isRetry) {
        setTimeout(() => {
          if (url && savePath) {
            setLog('Đã thêm cookies. Thử lại quá trình tải...\n');
            setIsDownloading(true);
            window.electronAPI.startDownload({
              url, savePath, quality, downloadThumbnail, ignorePlaylist, cookiesPath: path
            });
          }
        }, 100);
      }
    }
  };

  return (
    <div className="container">
      {showCookieModal && <CookieModal onAddCookieFile={() => handleAddCookieFile(true)} onCancel={() => setShowCookieModal(false)} message={modalMessage}/>}
      {showLogModal && <LogModal fullLog={log} onClose={() => setShowLogModal(false)} />}
      {notify && <NotifyModal title={notify.title} message={notify.message} actions={notify.actions}/>}

      <h1>Redbi Video Downloader</h1>
      
      <div className="input-group">
        <label htmlFor="url-input">Link Video:</label>
        <input id="url-input" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Dán link hoặc dùng extension trên trình duyệt" disabled={isDownloading}/>
      </div>
      <div className="input-group">
        <label htmlFor="save-path-input">Lưu vào:</label>
        <div className="path-container">
          <input id="save-path-input" type="text" value={savePath} readOnly placeholder="Chọn thư mục để lưu file..."/>
          <button onClick={handleSelectDirectory} disabled={isDownloading}>Chọn Thư Mục</button>
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
          <input type="checkbox" id="thumbnail-checkbox" checked={downloadThumbnail} onChange={(e) => setDownloadThumbnail(e.target.checked)} disabled={isDownloading}/>
          <label htmlFor="thumbnail-checkbox">Tải cả ảnh bìa (Thumbnail)</label>
        </div>
        <div className="checkbox-group">
          <input type="checkbox" id="playlist-checkbox" checked={ignorePlaylist} onChange={(e) => setIgnorePlaylist(e.target.checked)} disabled={isDownloading}/>
          <label htmlFor="playlist-checkbox">Chỉ tải 1 video (bỏ qua playlist)</label>
        </div>
        <div className="cookie-group">
            <button onClick={() => handleAddCookieFile(false)} className="btn-secondary">
                {cookieFileName ? `Đang dùng: ${cookieFileName}` : 'Thêm Cookies (Tùy chọn)'}
            </button>
        </div>
      </div>
      <button className="download-btn" onClick={handleDownload} disabled={isDownloading}>{isDownloading ? 'ĐANG TẢI...' : 'BẮT ĐẦU TẢI'}</button>
      
      <div className="log-area">
        <div className="log-header">
          <h2>Nhật ký xử lý:</h2>
          <button className="expand-btn" onClick={() => setShowLogModal(true)}>
            Xem chi tiết
          </button>
        </div>
        <pre>{log}</pre>
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default App;
