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
  const logContainerRef = useRef(null);

  const [quality, setQuality] = useState('1080p');
  const [downloadThumbnail, setDownloadThumbnail] = useState(true);
  const [ignorePlaylist, setIgnorePlaylist] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState('video'); // State mới: 'video' hoặc 'mp3'
  
  const [cookiesPath, setCookiesPath] = useState(null);
  const [cookieFileName, setCookieFileName] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [notify, setNotify] = useState(null);
  
  // Queue state
  const [queue, setQueue] = useState([]);
  const [currentDownloadId, setCurrentDownloadId] = useState(null);

  useEffect(() => {
    // Chỉ scroll nếu người dùng đang ở gần cuối log area
    if (logContainerRef.current) {
      const container = logContainerRef.current;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100; // Trong vòng 100px từ cuối
      
      // Chỉ scroll nếu đang ở gần cuối (người dùng đang xem log mới nhất)
      if (isNearBottom) {
        // Scroll đến cuối container, không scroll cả window
        container.scrollTop = scrollHeight;
      }
    }
  }, [log]);

  useEffect(() => {
    // Load initial queue status
    window.electronAPI.getQueueStatus().then(status => {
      setQueue(status.queue || []);
      setIsDownloading(status.isDownloading || false);
      setCurrentDownloadId(status.currentDownloadId || null);
    });

    const removeClearLogListener = window.electronAPI.onDownloadClearLog(() => {
      setLog(''); // Xóa log khi bắt đầu download mới
    });

    const removeLogListener = window.electronAPI.onDownloadLog((message) => {
      setLog(prevLog => prevLog + message);
      
      const lowerCaseMessage = message.toLowerCase();
      // Phát hiện các lỗi yêu cầu cookies/authentication
      if (lowerCaseMessage.includes('login to confirm your age') || 
          lowerCaseMessage.includes('sign in to confirm your age') ||
          lowerCaseMessage.includes('sign in to confirm you\'re not a bot') ||
          lowerCaseMessage.includes('this video is available to members only') ||
          lowerCaseMessage.includes('from-browser or --cookies') ||
          lowerCaseMessage.includes('exporting youtube cookies') ||
          (lowerCaseMessage.includes('http error 403') && lowerCaseMessage.includes('forbidden')) ||
          (lowerCaseMessage.includes('authentication') && lowerCaseMessage.includes('required'))) {
        setModalMessage('Video này yêu cầu đăng nhập hoặc xác thực. Vui lòng cung cấp file cookies.txt để tiếp tục.\n\nCách lấy cookies:\n1. Cài extension "Get cookies.txt LOCALLY" hoặc "cookies.txt" trên Chrome/Edge\n2. Truy cập youtube.com và đăng nhập\n3. Click extension và export cookies.txt\n4. Chọn file cookies.txt trong app này.');
        setIsDownloading(false);
        setShowCookieModal(true);
      }
      
      if (message.includes('--- Tiến trình kết thúc')) {
        setIsDownloading(false);
      }
    });

    const removeFinishedListener = window.electronAPI.onDownloadFinished((data) => {
      setNotify({
        title: "Tải xong",
        message: "File đã được tải thành công!",
        actions: [{ label: "OK", onClick: () => setNotify(null), primary: true }]
      });
    });

    const removeQueueStatusListener = window.electronAPI.onQueueStatus((status) => {
      setQueue(status.queue || []);
      setIsDownloading(status.isDownloading || false);
      setCurrentDownloadId(status.currentDownloadId || null);
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
      removeClearLogListener();
      removeLogListener();
      removeFinishedListener();
      removeQueueStatusListener();
      removeUpdateAvailableListener();
      removeUpdateDownloadedListener();
    };
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) setSavePath(path);
  };

  const handleAddToQueue = () => {
    if (!url || !savePath) {
      alert('Vui lòng nhập link video và chọn nơi lưu file.');
      return;
    }
    
    window.electronAPI.addToQueue({
      url, savePath, quality, downloadThumbnail, ignorePlaylist, cookiesPath, downloadFormat
    });
    
    // Xóa URL sau khi thêm vào hàng chờ (giữ lại để có thể thêm link khác)
    setUrl('');
  };

  const handleRemoveFromQueue = (id) => {
    window.electronAPI.removeFromQueue(id);
  };

  const handleRetryDownload = (id) => {
    window.electronAPI.retryDownload(id);
  };

  const handleClearQueue = () => {
    if (confirm('Bạn có chắc muốn xóa tất cả các link trong hàng chờ?')) {
      window.electronAPI.clearQueue();
      setLog('');
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'pending': return 'Đang chờ';
      case 'downloading': return 'Đang tải...';
      case 'completed': return 'Hoàn thành';
      case 'failed': return 'Thất bại';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#888';
      case 'downloading': return '#4a90e2';
      case 'completed': return '#4caf50';
      case 'failed': return '#f44336';
      default: return '#888';
    }
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
              url, savePath, quality, downloadThumbnail, ignorePlaylist, cookiesPath: path, downloadFormat
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
        <div className="url-input-container">
          <input id="url-input" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Dán link hoặc dùng extension trên trình duyệt" onKeyPress={(e) => { if (e.key === 'Enter') handleAddToQueue(); }}/>
          <button onClick={handleAddToQueue} className="add-queue-btn" disabled={!url || !savePath}>
            Thêm vào hàng chờ
          </button>
        </div>
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
          <label htmlFor="format-select">Định dạng:</label>
          <select id="format-select" value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} disabled={isDownloading}>
            <option value="video">Video (MP4)</option>
            <option value="mp3">Chỉ Âm thanh (MP3)</option>
          </select>
        </div>

        {downloadFormat === 'video' && (
          <div className="input-group">
            <label htmlFor="quality-select">Chất lượng Video:</label>
            <input id="quality-select" type="text" value="1080p (ưu tiên) / 720p / Tốt nhất" readOnly disabled={isDownloading} style={{opacity: 0.7, cursor: 'not-allowed'}}/>
            <small style={{display: 'block', marginTop: '4px', color: '#666', fontSize: '12px'}}>Ưu tiên 1080p, nếu không có thì 720p, nếu không có thì tải chất lượng cao nhất có sẵn</small>
          </div>
        )}

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
      {/* Queue Display */}
      {queue.length > 0 && (
        <div className="queue-container">
          <div className="queue-header">
            <h2>Hàng chờ download ({queue.length})</h2>
            <button onClick={handleClearQueue} className="clear-queue-btn" disabled={isDownloading}>
              Xóa tất cả
            </button>
          </div>
          <div className="queue-list">
            {queue.map((item) => (
              <div key={item.id} className={`queue-item ${item.id === currentDownloadId ? 'active' : ''}`}>
                <div className="queue-item-info">
                  <div className="queue-item-url" title={item.url}>
                    {item.url.length > 60 ? item.url.substring(0, 60) + '...' : item.url}
                  </div>
                  <div className="queue-item-meta">
                    <span className="queue-status" style={{ color: getStatusColor(item.status) }}>
                      {getStatusText(item.status)}
                    </span>
                    <span className="queue-format">{item.downloadFormat === 'mp3' ? 'MP3' : 'Video'}</span>
                  </div>
                </div>
                <div className="queue-item-actions">
                  {item.status === 'failed' && (
                    <button 
                      onClick={() => handleRetryDownload(item.id)} 
                      className="retry-queue-btn"
                      title="Tải lại"
                    >
                      ↻
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemoveFromQueue(item.id)} 
                    className="remove-queue-btn"
                    disabled={item.status === 'downloading'}
                    title={item.status === 'downloading' ? 'Không thể xóa khi đang tải' : 'Xóa khỏi hàng chờ'}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="log-area">
        <div className="log-header">
          <h2>Nhật ký xử lý:</h2>
          <button className="expand-btn" onClick={() => setShowLogModal(true)}>
            Xem chi tiết
          </button>
        </div>
        <pre ref={logContainerRef}>
          {log}
          <div ref={logEndRef} />
        </pre>
      </div>
    </div>
  );
}

export default App;
