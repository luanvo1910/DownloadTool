import subprocess
import argparse
import os
import sys
import io

# =================================================================
# Sửa lỗi mã hóa UTF-8 để hiển thị tiếng Việt trên terminal
# =================================================================
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
# =================================================================


def main(url, save_path, resources_path, cookies_path):
    """
    Tải video sử dụng yt-dlp và trình tải ngoài aria2c với file cấu hình.
    """
    print(f"STATUS: Bắt đầu xử lý URL: {url}")
    print(f"STATUS: Sẽ lưu file vào: {save_path}")
    print(f"STATUS: Sử dụng resources từ: {resources_path}")

    # --- Xác định đường dẫn đến các file thực thi ---
    yt_dlp_exe = os.path.join(resources_path, 'yt-dlp.exe')
    ffmpeg_exe = os.path.join(resources_path, 'ffmpeg.exe')
    aria2c_exe = os.path.join(resources_path, 'aria2c.exe')
    aria2c_conf = os.path.join(resources_path, 'aria2c.conf') # Đường dẫn đến file config

    # Kiểm tra sự tồn tại của các file cần thiết
    if not all(os.path.exists(p) for p in [yt_dlp_exe, ffmpeg_exe, aria2c_exe, aria2c_conf]):
        print(f"ERROR: Thiếu file thực thi hoặc file cấu hình (yt-dlp, ffmpeg, aria2c, aria2c.conf) trong thư mục resources.")
        return

    # --- Cấu hình các tham số ---
    output_template = os.path.join(save_path, '%(title)s.%(ext)s')
    format_selection = 'bestvideo+bestaudio/best' # Lấy chất lượng tốt nhất
    
    # ==============================================================================
    # SỬA LỖI Ở ĐÂY: Dùng file cấu hình, chỉ truyền 2 tham số đơn giản
    # ==============================================================================
    safe_save_path = os.path.abspath(save_path).replace('\\', '/')
    downloader_args_str = f'aria2c:--conf-path={aria2c_conf},--dir={safe_save_path}'

    # --- Xây dựng lệnh command cuối cùng ---
    command = [
        yt_dlp_exe,
        '--no-playlist',
        '--write-thumbnail',
        '-f', format_selection,
        '--merge-output-format', 'mp4',
        '-o', output_template,
        '--ffmpeg-location', resources_path,
        '--downloader', aria2c_exe,
        '--downloader-args', downloader_args_str,
    ]

    if cookies_path and os.path.exists(cookies_path):
        print(f"STATUS: Sử dụng file cookies từ: {cookies_path}")
        command.extend(['--cookies', cookies_path])
    else:
        print("STATUS: Không sử dụng file cookies.")

    command.append(url)

    print("STATUS: Đang thực thi lệnh...", flush=True)

    # --- Chạy tiến trình và stream output ---
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        creationflags=subprocess.CREATE_NO_WINDOW
    )

    for line in iter(process.stdout.readline, ''):
        print(line.strip(), flush=True)

    process.wait()

    if process.returncode == 0:
        print("SUCCESS: Tải và xử lý video thành công!")
    else:
        print(f"ERROR: Quá trình thất bại với mã lỗi {process.returncode}.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Tải và ghép video từ URL sử dụng yt-dlp và aria2c.")
    parser.add_argument("--url", required=True, help="URL của video.")
    parser.add_argument("--save-path", required=True, help="Thư mục để lưu file.")
    parser.add_argument("--resources-path", required=True, help="Đường dẫn đến thư mục chứa các file .exe.")
    parser.add_argument("--cookies-path", required=False, default=None, help="(Tùy chọn) Đường dẫn đến file cookies.txt.")

    args = parser.parse_args()

    try:
        main(args.url, args.save_path, args.resources_path, args.cookies_path)
    except Exception as e:
        print(f"FATAL_ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)