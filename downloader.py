import subprocess
import argparse
import os
import sys
import io

# =================================================================
# *** PHẦN SỬA LỖI QUAN TRỌNG ***
# Buộc stdout và stderr sử dụng mã hóa UTF-8 một cách triệt để.
# Điều này đảm bảo script có thể in tiếng Việt ra ngoài mà không bị lỗi 'charmap'.
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
# =================================================================


def main(url, save_path, resources_path):
    """
    Tải video, audio, thumbnail và ghép chúng lại.
    """
    print(f"STATUS: Bắt đầu xử lý URL: {url}")
    print(f"STATUS: Sẽ lưu file vào: {save_path}")

    # Xác định đường dẫn của yt-dlp và ffmpeg trong thư mục resources
    yt_dlp_exe = os.path.join(resources_path, 'yt-dlp.exe')
    ffmpeg_exe = os.path.join(resources_path, 'ffmpeg.exe')

    if not os.path.exists(yt_dlp_exe):
        print(f"ERROR: Không tìm thấy yt-dlp.exe tại {yt_dlp_exe}")
        return
        
    if not os.path.exists(ffmpeg_exe):
        print(f"ERROR: Không tìm thấy ffmpeg.exe tại {ffmpeg_exe}")
        return

    # Template cho tên file output, lưu vào thư mục đã chọn
    output_template = os.path.join(save_path, '%(title)s.%(ext)s')

    # *** THAY ĐỔI Ở ĐÂY: Thêm [height<=1080] để giới hạn chất lượng video ***
    format_selection = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best'

    command = [
        yt_dlp_exe,
        '-f', format_selection,
        '--merge-output-format', 'mp4',
        '--write-thumbnail',
        '-o', output_template,
        '--ffmpeg-location', resources_path, # Chỉ định thư mục chứa ffmpeg
        url
    ]

    print(f"STATUS: Đang thực thi lệnh...", flush=True)

    # Chạy lệnh và stream output
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, # Gộp stderr vào stdout
        text=True,
        encoding='utf-8',
        errors='replace',
        creationflags=subprocess.CREATE_NO_WINDOW # Không hiện cửa sổ console đen
    )

    # Đọc và in output theo từng dòng
    for line in iter(process.stdout.readline, ''):
        print(line.strip(), flush=True)

    process.wait() # Chờ tiến trình kết thúc

    if process.returncode == 0:
        print("SUCCESS: Tải và ghép video thành công!")
    else:
        print(f"ERROR: Quá trình thất bại với mã lỗi {process.returncode}.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Tải và ghép video từ URL.")
    parser.add_argument("--url", required=True, help="URL của video.")
    parser.add_argument("--save-path", required=True, help="Thư mục để lưu file.")
    parser.add_argument("--resources-path", required=True, help="Đường dẫn đến thư mục resources.")
    
    args = parser.parse_args()
    
    try:
        main(args.url, args.save_path, args.resources_path)
    except Exception as e:
        print(f"FATAL_ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
