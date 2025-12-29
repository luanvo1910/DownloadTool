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


def check_deno_runtime():
    """
    Kiểm tra xem Deno có sẵn không (recommended JS runtime cho yt-dlp).
    Trả về đường dẫn đến deno nếu tìm thấy, None nếu không.
    """
    deno_path = shutil.which("deno")
    if deno_path:
        # Kiểm tra version để đảm bảo >= 2.0.0
        try:
            result = subprocess.run(
                [deno_path, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if result.returncode == 0:
                return deno_path
        except:
            pass
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

def ensure_js_runtime():
    """
    Đảm bảo có sẵn JavaScript runtime cho yt-dlp.
    Ưu tiên Deno (recommended), sau đó là Node.js.
    Trả về tuple (runtime_type, runtime_path, prepend_path)
    runtime_type: 'deno', 'node', hoặc None
    """
    # Kiểm tra Deno trước (recommended)
    deno_path = check_deno_runtime()
    if deno_path:
        return 'deno', deno_path, None
    
    # Fallback về Node.js
    node_path, node_prepend = ensure_node_runtime()
    if node_path:
        return 'node', node_path, node_prepend
    
    return None, None, None

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

def detect_platform(url: str) -> str:
    """
    Xác định platform từ URL để áp dụng cấu hình phù hợp.
    Trả về: 'youtube', 'tiktok', 'instagram', 'twitter', 'facebook', 'bilibili', 'vimeo', hoặc 'generic'
    """
    if not url:
        return 'generic'
    
    u = url.lower()
    if 'youtube.com' in u or 'youtu.be' in u:
        return 'youtube'
    if 'tiktok.com' in u:
        return 'tiktok'
    if 'instagram.com' in u:
        return 'instagram'
    if 'twitter.com' in u or 'x.com' in u:
        return 'twitter'
    if 'facebook.com' in u or 'fb.watch' in u:
        return 'facebook'
    if 'bilibili.com' in u:
        return 'bilibili'
    if 'vimeo.com' in u:
        return 'vimeo'
    return 'generic'


def main(url, save_path, resources_path, cookies_path, quality, thumbnail, no_playlist, download_format):
    print(f"Bắt đầu quá trình tải...")
    print(f"STATUS: Bắt đầu xử lý URL: {url}")
    print(f"STATUS: Sẽ lưu file vào: {save_path}")

    # Xác định platform (YouTube, TikTok, Instagram, Twitter, ...)
    platform = detect_platform(url)
    print(f"STATUS: Phát hiện nền tảng: {platform}")

    # Làm sạch URL TikTok để tránh query thừa gây lỗi extractor
    sanitized_url = url
    if platform == 'tiktok':
        sanitized_url = url.split('?', 1)[0]
        if sanitized_url != url:
            print(f"STATUS: Đã làm sạch URL TikTok: {sanitized_url}")

    yt_dlp_exe_path = os.path.abspath(os.path.join(resources_path, 'yt-dlp.exe'))
    
    if not os.path.exists(yt_dlp_exe_path):
        print("ERROR: Thiếu file thực thi yt-dlp.exe.")
        return 1

    # Cập nhật yt-dlp (thử cập nhật tại chỗ, nếu thất bại thì tải về AppData)
    yt_dlp_exe_path = update_ytdlp(yt_dlp_exe_path)

    # Giới hạn độ dài tên file (tăng lên 200 ký tự) và loại bỏ các ký tự không hợp lệ trên Windows
    # Sử dụng .200s để giữ được tên dài hơn, và yt-dlp sẽ tự động xử lý các ký tự không hợp lệ
    # %(id)s là ID video YouTube (ví dụ: VrSQdgJU3fY) - giúp tránh trùng tên khi nhiều video có cùng tiêu đề
    output_template = os.path.join(save_path, '%(title).200s.%(ext)s')

    # Kiểm tra và sử dụng JS runtime (ưu tiên Deno, sau đó Node)
    js_runtime_type, js_runtime_path, js_prepend = ensure_js_runtime()
    
    if js_runtime_type == 'deno':
        print(f"STATUS: Đã sẵn sàng JS runtime: Deno ({js_runtime_path})")
    elif js_runtime_type == 'node':
        print(f"STATUS: Đã sẵn sàng JS runtime: Node.js ({js_runtime_path})")
    else:
        print("WARNING: Thiếu JavaScript runtime (Deno/Node.js), một số định dạng YouTube có thể bị bỏ qua.")
        print("WARNING: Challenge solving có thể thất bại. Khuyến nghị cài đặt Deno hoặc Node.js.")
    
    command = [
        yt_dlp_exe_path,
        '--impersonate', 'chrome',
        '--no-update',  # Tắt cảnh báo cập nhật để tránh spam log
        # Ép sử dụng downloader nội bộ của yt-dlp (tránh dùng curl/wget bên ngoài nếu có cấu hình global)
        '--downloader', 'native',
        # Tăng tốc độ tải bằng cách tải xuống nhiều fragment cùng lúc
        '--concurrent-fragments', '5',
        # Thêm các tùy chọn thử lại để tăng độ ổn định
        '--retries', '10',
        '--fragment-retries', '10',
        # Đảm bảo EJS scripts được tải từ GitHub (theo yt-dlp EJS wiki)
        '--remote-components', 'ejs:github',
    ]

    # Chỉ thêm extractor-args của YouTube nếu URL là YouTube
    if platform == 'youtube':
        # Thử nhiều client để bypass SABR streaming và truy cập format chất lượng cao hơn
        # Ưu tiên ios và tv_embedded vì chúng thường không bị SABR streaming
        # web_embedded cũng tốt để bypass một số hạn chế
        command.extend([
            '--extractor-args',
            'youtube:player_client=ios,tv_embedded,web_embedded,web,android',
        ])

    if js_runtime_type == 'deno':
        # Deno được enable by default, nhưng có thể chỉ định path nếu cần
        command.extend(['--js-runtimes', f'deno:{js_runtime_path}'])
    elif js_runtime_type == 'node':
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
            '--windows-filenames',  # Chỉ loại bỏ ký tự không hợp lệ trên Windows, giữ tên gần với tên gốc
        ])
    else:
        # Format selection ưu tiên chất lượng cao nhất với bitrate cao
        # Ưu tiên thứ tự:
        # 1. bestvideo có height >= 720p + bestaudio (chất lượng cao nhất)
        # 2. bestvideo có height >= 480p + bestaudio (fallback nếu không có 720p+)
        # 3. best có height >= 720p (single file chất lượng cao)
        # 4. best có height >= 480p (fallback)
        # 5. bestvideo+bestaudio (bất kỳ resolution nào)
        # 6. best (format tốt nhất có sẵn)
        # Loại bỏ format quá thấp (dưới 480p như format 18-360p) bằng cách reject chúng
        # Format 18 là 360p, format 22 là 720p, format 137+140 là 1080p
        # Reject format 18 và các format thấp khác (dưới 480p)
        format_selection = "bestvideo[height>=720]+bestaudio[asr>=44100]/bestvideo[height>=480]+bestaudio[asr>=44100]/best[height>=720]/best[height>=480]/bestvideo+bestaudio/best/-18/-36/-17/-5"

        command.extend([
            '-f', format_selection,
            # Ưu tiên format có resolution cao hơn, bitrate cao hơn, codec tốt hơn
            '--format-sort', '+height:+tbr:+codec',
            '--merge-output-format', 'mp4',
            # Sử dụng copy codec khi merge để giữ nguyên chất lượng gốc, không re-encode
            '--postprocessor-args', 'ffmpeg:-c copy',
            '-o', output_template,
            '--ffmpeg-location', resources_path,
            '--windows-filenames',  # Chỉ loại bỏ ký tự không hợp lệ trên Windows, giữ tên gần với tên gốc
        ])

    if no_playlist:
        command.append('--no-playlist')
    if thumbnail:
        # Chỉ write thumbnail, không embed để tránh lỗi làm fail toàn bộ quá trình
        # Embed thumbnail có thể fail do format webp không tương thích với ffmpeg
        command.extend(['--write-thumbnail'])
        # Không embed thumbnail để tránh lỗi, user có thể tự embed sau nếu cần

    # Tăng khả năng thành công với TikTok: header mobile + player_client mobile + IPv4 + download_api
    if 'tiktok.com' in sanitized_url:
        command.extend([
            # yt-dlp yêu cầu --add-headers (số nhiều) cho từng header
            '--add-headers', 'Referer:https://www.tiktok.com/',
            '--add-headers', 'User-Agent:Mozilla/5.0 (Linux; Android 12; SM-G996B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            '--add-headers', 'Accept-Language:en-US,en;q=0.9',
            '--add-headers', 'Sec-Fetch-Site:same-origin',
            '--add-headers', 'Sec-Fetch-Mode:navigate',
            '--add-headers', 'Sec-Fetch-Dest:document',
            # Bật API mobile để TikTok trả metadata + URL tải
            '--extractor-args', 'tiktok:player_client=android,app_info=1,download_api=1',
            '--force-ipv4',
            '--geo-bypass',
            # Giữ nguyên extractor TikTok (không ép generic) để tránh lỗi Unsupported URL
            '--no-check-certificate',
        ])

    if cookies_path and os.path.exists(cookies_path):
        print(f"STATUS: Sử dụng file cookies từ: {cookies_path}")
        command.extend(['--cookies', cookies_path])

    command.append(sanitized_url)

    print("STATUS: Đang thực thi yt-dlp...", flush=True)

    env = os.environ.copy()
    if js_prepend:
        env["PATH"] = f"{js_prepend}{os.pathsep}{env.get('PATH', '')}"

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
        output_text_original = '\n'.join(output_lines)  # Giữ nguyên để in ra

        # Fallback riêng cho TikTok nếu gặp lỗi "Video not available" / status code 0
        if platform == 'tiktok' and ('video not available' in output_text or 'status code 0' in output_text):
            print("\n⚠️  TikTok trả về lỗi video not available/status 0. Đang thử lại với cấu hình fallback...")
            
            # Thử nhiều cách fallback khác nhau
            fallback_configs = [
                {
                    'name': 'Web client với headers đầy đủ',
                    'extractor_args': 'tiktok:player_client=web',
                    'headers': [
                        ('Referer', 'https://www.tiktok.com/'),
                        ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
                        ('Accept-Language', 'en-US,en;q=0.9'),
                        ('Origin', 'https://www.tiktok.com'),
                    ]
                },
                {
                    'name': 'Android client với download API',
                    'extractor_args': 'tiktok:player_client=android,app_info=1,download_api=1',
                    'headers': [
                        ('Referer', 'https://www.tiktok.com/'),
                        ('User-Agent', 'Mozilla/5.0 (Linux; Android 12; SM-G996B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'),
                        ('Accept-Language', 'en-US,en;q=0.9'),
                    ]
                }
            ]
            
            success = False
            for config in fallback_configs:
                if success:
                    break
                    
                print(f"\n🔄 Thử fallback: {config['name']}...")
                tiktok_fallback_cmd = [
                    yt_dlp_exe_path,
                    '--impersonate', 'chrome',
                    '--no-update',
                    '--downloader', 'native',
                    '--force-ipv4',
                    '--geo-bypass',
                    '--merge-output-format', 'mp4',
                    '-o', output_template,
                    '--windows-filenames',
                ]
                
                # Thêm headers
                for header_name, header_value in config['headers']:
                    tiktok_fallback_cmd.extend(['--add-headers', f'{header_name}:{header_value}'])
                
                # Thêm extractor args
                tiktok_fallback_cmd.extend(['--extractor-args', config['extractor_args']])
                
                # Thêm JS runtime nếu có
                if js_runtime_type == 'deno':
                    tiktok_fallback_cmd.extend(['--js-runtimes', f'deno:{js_runtime_path}'])
                elif js_runtime_type == 'node':
                    tiktok_fallback_cmd.extend(['--js-runtimes', 'node'])
                
                if thumbnail:
                    tiktok_fallback_cmd.extend(['--write-thumbnail'])
                if cookies_path and os.path.exists(cookies_path):
                    tiktok_fallback_cmd.extend(['--cookies', cookies_path])
                
                # Format selection cho TikTok (đơn giản hơn, TikTok thường chỉ có một format)
                tiktok_fallback_cmd.extend(['-f', 'best'])
                tiktok_fallback_cmd.append(sanitized_url)

                fb_process = subprocess.Popen(
                    tiktok_fallback_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    env=env
                )
                fb_output = []
                for line in iter(fb_process.stdout.readline, ''):
                    line = line.strip()
                    if line:
                        print(line, flush=True)
                        fb_output.append(line)
                fb_process.wait()

                if fb_process.returncode == 0:
                    print(f"\n✅ SUCCESS: TikTok đã tải thành công với cấu hình fallback: {config['name']}!")
                    success = True
                    return 0
                else:
                    print(f"❌ Fallback '{config['name']}' thất bại, thử cách tiếp theo...")
                    output_lines.extend(fb_output)
            
            # Nếu tất cả fallback đều thất bại
            print("\n❌ Tất cả các cách fallback TikTok đều thất bại.")
            print("💡 GỢI Ý:")
            print("   - Video có thể đã bị xóa hoặc chuyển sang chế độ riêng tư")
            print("   - Thử thêm cookies từ trình duyệt (đăng nhập TikTok trước)")
            print("   - Kiểm tra xem video có còn tồn tại trên TikTok không")
        
        # Kiểm tra lỗi: chỉ có ảnh (thumbnail) có sẵn
        has_only_images = 'only images are available' in output_text
        has_format_error = 'requested format is not available' in output_text
        has_challenge_failed = 'challenge solving failed' in output_text
        
        # Kiểm tra lỗi: video không có format nào phù hợp (chỉ có thumbnail)
        # Lưu ý: Với fallback "best" ở cuối, lỗi "requested format is not available" 
        # chỉ xảy ra khi video thực sự không có format video nào (chỉ có thumbnail)
        if has_format_error and not has_only_images:
            print("\n⚠️  LỖI: Video này không có format video phù hợp có sẵn.")
            print("⚠️  Ứng dụng đã thử tải 1080p (ưu tiên), 720p (fallback), và chất lượng cao nhất có sẵn.")
            print("💡 GỢI Ý: Video này có thể chỉ có thumbnail hoặc không có format video nào.")
            return process.returncode
        
        # Kích hoạt fallback nếu có "only images" hoặc "requested format is not available" 
        # (thường đi kèm với "only images" trong trường hợp này)
        should_try_thumbnail = has_only_images or (has_format_error and 'images' in output_text)
        
        if should_try_thumbnail:
            print("\n⚠️  LỖI: Video này chỉ có ảnh thumbnail có sẵn, không có video/audio để tải.")
            if has_challenge_failed:
                print("⚠️  CẢNH BÁO: Không thể giải quyết challenge của YouTube - điều này có thể là nguyên nhân.")
                if not js_runtime_type:
                    print("⚠️  NGUYÊN NHÂN: Thiếu JavaScript runtime (Deno/Node.js) để giải quyết challenge.")
                    print("   Hãy cài đặt Deno (khuyến nghị) hoặc Node.js để cải thiện khả năng tải video.")
            print("Nguyên nhân có thể:")
            print("  - Video bị giới hạn độ tuổi và cookies hiện tại không đủ quyền")
            print("  - Video bị khóa theo vùng địa lý")
            print("  - Video đã bị xóa hoặc chuyển sang chế độ riêng tư")
            print("  - YouTube đã chặn truy cập do challenge solving failed")
            print("  - URL không trỏ đến video hợp lệ")
            
            # Thử tải thumbnail như một fallback
            print("\n🔄 Đang thử tải thumbnail như một giải pháp thay thế...")
            
            # Thử với nhiều client khác nhau để bypass challenge
            clients_to_try = ['android', 'ios', 'web']
            thumbnail_downloaded = False
            
            for client in clients_to_try:
                if thumbnail_downloaded:
                    break
                    
                print(f"\n🔄 Thử với client: {client}...")
                thumbnail_command = [
                    yt_dlp_exe_path,
                    '--impersonate', 'chrome',
                    '--no-update',
                    '--write-thumbnail',
                    '--skip-download',
                    '--extractor-args', f'youtube:player_client={client}',
                    '-o', os.path.join(save_path, '%(title).200s.%(ext)s'),
                    '--windows-filenames',  # Chỉ loại bỏ ký tự không hợp lệ trên Windows, giữ tên gần với tên gốc
                ]
                
                if cookies_path and os.path.exists(cookies_path):
                    thumbnail_command.extend(['--cookies', cookies_path])
                
                # Thêm JS runtime và EJS components cho thumbnail download
                if js_runtime_type == 'deno':
                    thumbnail_command.extend(['--js-runtimes', f'deno:{js_runtime_path}'])
                elif js_runtime_type == 'node':
                    thumbnail_command.extend(['--js-runtimes', 'node'])
                thumbnail_command.extend(['--remote-components', 'ejs:github'])
                
                if js_prepend:
                    env_thumb = os.environ.copy()
                    env_thumb["PATH"] = f"{js_prepend}{os.pathsep}{env_thumb.get('PATH', '')}"
                else:
                    env_thumb = os.environ.copy()
                
                thumbnail_command.append(url)
                
                thumb_process = subprocess.Popen(
                    thumbnail_command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    env=env_thumb
                )
                
                thumb_output = []
                for line in iter(thumb_process.stdout.readline, ''):
                    line = line.strip()
                    if line:
                        print(line, flush=True)
                        thumb_output.append(line)
                
                thumb_process.wait()
                
                if thumb_process.returncode == 0:
                    print(f"\n✅ Đã tải thành công thumbnail của video (sử dụng client: {client})!")
                    thumbnail_downloaded = True
                    return 0
            
            if not thumbnail_downloaded:
                print("\n❌ Không thể tải thumbnail với bất kỳ client nào.")
                if not cookies_path:
                    print("\n💡 GỢI Ý: Hãy thử thêm file cookies.txt mới trong ứng dụng và tải lại.")
                else:
                    print("\n💡 GỢI Ý: Cookies hiện tại có thể không đủ quyền hoặc đã hết hạn.")
                    print("   Hãy thử xuất cookies mới từ trình duyệt (đảm bảo đã đăng nhập và có quyền xem video).")
                print("💡 Bạn có thể thử sử dụng --list-formats để xem các định dạng có sẵn.")
        
        # Kiểm tra lỗi authentication
        elif ('sign in' in output_text and 'bot' in output_text) or \
             ('from-browser' in output_text and 'cookies' in output_text) or \
             ('authentication' in output_text and 'required' in output_text):
            if not cookies_path:
                print("\nGỢI Ý: Video này có thể yêu cầu cookies để xác thực.")
                print("Hãy thử thêm file cookies.txt trong ứng dụng và tải lại.")
            else:
                print("\n⚠️  Cookies hiện tại có thể không đủ quyền hoặc đã hết hạn.")
                print("💡 GỢI Ý: Hãy thử xuất cookies mới từ trình duyệt và cập nhật lại.")
        
        # Kiểm tra lỗi challenge solving (YouTube anti-bot) - chỉ khi không phải lỗi "only images"
        elif has_challenge_failed and not has_only_images:
            print("\n⚠️  CẢNH BÁO: Không thể giải quyết challenge của YouTube.")
            print("Điều này có thể do:")
            print("  - YouTube đã thay đổi cơ chế bảo vệ")
            print("  - Cần cập nhật yt-dlp lên phiên bản mới nhất")
            print("  - Cần sử dụng cookies để xác thực")
            if not cookies_path:
                print("\n💡 GỢI Ý: Hãy thử thêm file cookies.txt để cải thiện khả năng tải video.")
            else:
                print("\n💡 GỢI Ý: Cookies hiện tại có thể không đủ. Hãy thử xuất cookies mới từ trình duyệt.")
    
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
