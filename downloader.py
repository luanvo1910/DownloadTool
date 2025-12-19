import subprocess
import argparse
import os
import sys
import io
import shutil
import urllib.request

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def get_user_ytdlp_path():
    """Lấy đường dẫn yt-dlp trong thư mục AppData của người dùng"""
    appdata = os.getenv('APPDATA')
    if not appdata:
        return None
    ytdlp_dir = os.path.join(appdata, 'RedbiVideoDownloader')
    os.makedirs(ytdlp_dir, exist_ok=True)
    return os.path.join(ytdlp_dir, 'yt-dlp.exe')

def download_latest_ytdlp(dest_path):
    """Tải phiên bản mới nhất của yt-dlp từ GitHub"""
    try:
        print("STATUS: Đang tải phiên bản mới nhất của yt-dlp...")
        url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        
        with urllib.request.urlopen(url, timeout=30) as response:
            with open(dest_path, 'wb') as f:
                shutil.copyfileobj(response, f)
        return True
    except Exception as e:
        print(f"ERROR: Không thể tải yt-dlp mới: {e}")
        return False


def get_user_node_dir():
    """Đường dẫn chứa node.exe portable (ưu tiên LOCALAPPDATA, fallback APPDATA)"""
    base = os.getenv('LOCALAPPDATA') or os.getenv('APPDATA')
    if not base:
        return None
    node_dir = os.path.join(base, 'RedbiVideoDownloader', 'nodejs')
    os.makedirs(node_dir, exist_ok=True)
    return node_dir


def download_node_runtime(dest_dir):
    """Tải node.exe portable (~25-30MB) để phục vụ yt-dlp JS runtime"""
    url = "https://nodejs.org/dist/latest/win-x64/node.exe"
    dest_path = os.path.join(dest_dir, 'node.exe')
    try:
        print("STATUS: Không tìm thấy Node.js. Đang tải Node.js portable (~30MB)...")
        with urllib.request.urlopen(url, timeout=60) as response:
            with open(dest_path, 'wb') as f:
                shutil.copyfileobj(response, f)
        print(f"STATUS: Đã tải Node.js vào: {dest_path}")
        return dest_path
    except Exception as exc:
        print(f"WARNING: Tải Node.js thất bại: {exc}")
        return None


def ensure_node_runtime():
    """
    Đảm bảo có sẵn Node.js cho yt-dlp (JS runtime).
    Ưu tiên dùng Node đã cài, nếu thiếu sẽ tự tải node.exe portable vào thư mục người dùng.
    Trả về tuple (node_path, prepend_path) - prepend_path được thêm vào PATH khi chạy yt-dlp.
    """
    existing_node = shutil.which("node")
    if existing_node:
        return existing_node, None

    node_dir = get_user_node_dir()
    if not node_dir:
        print("WARNING: Không xác định được thư mục người dùng để lưu Node.js.")
        return None, None

    portable_node = os.path.join(node_dir, 'node.exe')
    if os.path.exists(portable_node):
        return portable_node, node_dir

    downloaded = download_node_runtime(node_dir)
    if downloaded:
        return downloaded, node_dir

    return None, None

def update_ytdlp(yt_dlp_exe_path):
    """Cố gắng cập nhật yt-dlp, nếu thất bại thì tải về AppData"""
    print("STATUS: Đang kiểm tra và cập nhật yt-dlp...")
    
    # Thử cập nhật tại vị trí gốc trước
    try:
        update_process = subprocess.Popen(
            [yt_dlp_exe_path, "-U"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        output_lines = []
        for line in iter(update_process.stdout.readline, ''):
            line = line.strip()
            if line:
                print(line, flush=True)
                output_lines.append(line)
        update_process.wait()
        
        if update_process.returncode == 0:
            print("STATUS: yt-dlp đã được cập nhật thành công tại vị trí gốc.")
            return yt_dlp_exe_path
        else:
            # Kiểm tra xem có phải lỗi quyền không
            output_text = '\n'.join(output_lines)
            if 'administrator' in output_text.lower() or 'permission' in output_text.lower():
                print("WARNING: Không có quyền cập nhật tại vị trí gốc. Đang thử tải về thư mục người dùng...")
            else:
                print(f"WARNING: Cập nhật thất bại với mã lỗi {update_process.returncode}. Đang thử tải về thư mục người dùng...")
    except Exception as e:
        print(f"WARNING: Lỗi khi cố gắng cập nhật yt-dlp: {e}. Đang thử tải về thư mục người dùng...")
    
    # Nếu cập nhật thất bại, thử tải về AppData
    user_ytdlp_path = get_user_ytdlp_path()
    if user_ytdlp_path and download_latest_ytdlp(user_ytdlp_path):
        print("STATUS: Đã tải phiên bản mới nhất của yt-dlp vào thư mục người dùng.")
        return user_ytdlp_path
    else:
        print("WARNING: Không thể cập nhật yt-dlp. Sẽ sử dụng phiên bản hiện có.")
        return yt_dlp_exe_path

def main(url, save_path, resources_path, cookies_path, quality, thumbnail, no_playlist, download_format):
    print(f"Bắt đầu quá trình tải...")
    print(f"STATUS: Bắt đầu xử lý URL: {url}")
    print(f"STATUS: Sẽ lưu file vào: {save_path}")

    yt_dlp_exe_path = os.path.abspath(os.path.join(resources_path, 'yt-dlp.exe'))
    
    if not os.path.exists(yt_dlp_exe_path):
        print("ERROR: Thiếu file thực thi yt-dlp.exe.")
        return 1

    # Cập nhật yt-dlp (thử cập nhật tại chỗ, nếu thất bại thì tải về AppData)
    yt_dlp_exe_path = update_ytdlp(yt_dlp_exe_path)

    # Giới hạn độ dài tên file và loại ký tự lạ để tránh lỗi Windows path/emoji
    output_template = os.path.join(save_path, '%(title).80s-%(id)s.%(ext)s')

    node_path, node_prepend = ensure_node_runtime()
    if node_path:
        print(f"STATUS: Đã sẵn sàng JS runtime: {node_path}")
    else:
        print("WARNING: Thiếu Node.js, một số định dạng YouTube có thể bị bỏ qua.")
    
    command = [
        yt_dlp_exe_path,
        '--impersonate', 'chrome',
        '--no-update',  # Tắt cảnh báo cập nhật để tránh spam log
        # Tăng tốc độ tải bằng cách tải xuống nhiều fragment cùng lúc
        '--concurrent-fragments', '5',
        # Thêm các tùy chọn thử lại để tăng độ ổn định
        '--retries', '10',
        '--fragment-retries', '10'
    ]

    if node_path:
        # yt-dlp sẽ tìm node trong PATH; nếu portable, chúng ta đã thêm PATH ở env
        command.extend(['--js-runtimes', 'node'])

    if download_format.lower() == 'mp3':
        command.extend([
            '-f', 'bestaudio',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', output_template,
            '--ffmpeg-location', resources_path,
            '--restrict-filenames',
        ])
    else:
        if quality == "1080p":
            format_selection = "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
        elif quality == "720p":
            format_selection = "bestvideo[height<=720]+bestaudio/best[height<=720]"
        else:
            format_selection = "bestvideo+bestaudio/best"

        command.extend([
            '-f', format_selection,
            '--merge-output-format', 'mp4',
            '-o', output_template,
            '--ffmpeg-location', resources_path,
            '--restrict-filenames',
        ])

    if no_playlist:
        command.append('--no-playlist')
    if thumbnail:
        command.extend(['--write-thumbnail', '--embed-thumbnail'])

    if cookies_path and os.path.exists(cookies_path):
        print(f"STATUS: Sử dụng file cookies từ: {cookies_path}")
        command.extend(['--cookies', cookies_path])

    command.append(url)

    print("STATUS: Đang thực thi yt-dlp...", flush=True)

    env = os.environ.copy()
    if node_prepend:
        env["PATH"] = f"{node_prepend}{os.pathsep}{env.get('PATH', '')}"

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        creationflags=subprocess.CREATE_NO_WINDOW,
        env=env
    )

    output_lines = []
    for line in iter(process.stdout.readline, ''):
        line = line.strip()
        if line:
            print(line, flush=True)
            output_lines.append(line)

    process.wait()

    if process.returncode == 0:
        print("SUCCESS: Tải và xử lý file thành công!")
    else:
        print(f"ERROR: Quá trình thất bại với mã lỗi {process.returncode}.")
        # Kiểm tra các loại lỗi phổ biến
        output_text = '\n'.join(output_lines).lower()
        
        # Kiểm tra lỗi: chỉ có ảnh (thumbnail) có sẵn
        if 'only images are available' in output_text or \
           ('requested format is not available' in output_text and 'only images' in output_text):
            print("\n⚠️  LỖI: Video này chỉ có ảnh thumbnail có sẵn, không có video/audio để tải.")
            print("Nguyên nhân có thể:")
            print("  - Video bị giới hạn độ tuổi và cần cookies để xác thực")
            print("  - Video bị khóa theo vùng địa lý")
            print("  - Video đã bị xóa hoặc chuyển sang chế độ riêng tư")
            print("  - URL không trỏ đến video hợp lệ")
            if not cookies_path:
                print("\n💡 GỢI Ý: Hãy thử thêm file cookies.txt trong ứng dụng và tải lại.")
            print("💡 Bạn có thể thử sử dụng --list-formats để xem các định dạng có sẵn.")
        
        # Kiểm tra lỗi authentication
        elif ('sign in' in output_text and 'bot' in output_text) or \
             ('from-browser' in output_text and 'cookies' in output_text) or \
             ('authentication' in output_text and 'required' in output_text):
            if not cookies_path:
                print("\nGỢI Ý: Video này có thể yêu cầu cookies để xác thực.")
                print("Hãy thử thêm file cookies.txt trong ứng dụng và tải lại.")
        
        # Kiểm tra lỗi challenge solving (YouTube anti-bot)
        elif 'challenge solving failed' in output_text:
            print("\n⚠️  CẢNH BÁO: Không thể giải quyết challenge của YouTube.")
            print("Điều này có thể do:")
            print("  - YouTube đã thay đổi cơ chế bảo vệ")
            print("  - Cần cập nhật yt-dlp lên phiên bản mới nhất")
            print("  - Cần sử dụng cookies để xác thực")
            if not cookies_path:
                print("\n💡 GỢI Ý: Hãy thử thêm file cookies.txt để cải thiện khả năng tải video.")
    
    return process.returncode

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Tải video từ URL với yt-dlp.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--save-path", required=True)
    parser.add_argument("--resources-path", required=True)
    parser.add_argument("--cookies-path", required=False, default=None)
    parser.add_argument("--quality", default='best')
    parser.add_argument("--thumbnail", action='store_true')
    parser.add_argument("--no-playlist", action='store_true')
    parser.add_argument("--format", default='video', help="Định dạng tải: video hoặc mp3")

    args = parser.parse_args()

    try:
        exit_code = main(args.url, args.save_path, args.resources_path, args.cookies_path,
                         args.quality, args.thumbnail, args.no_playlist, args.format)
        sys.exit(exit_code)
        
    except Exception as e:
        print(f"FATAL_ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
