import subprocess
import argparse
import os
import sys
import io

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def main(url, save_path, resources_path, cookies_path, quality, thumbnail, no_playlist, download_format):
    print(f"Bắt đầu quá trình tải...")
    print(f"STATUS: Bắt đầu xử lý URL: {url}")
    print(f"STATUS: Sẽ lưu file vào: {save_path}")

    yt_dlp_exe = os.path.join(resources_path, 'yt-dlp.exe')
    ffmpeg_exe = os.path.join(resources_path, 'ffmpeg.exe')

    if not all(os.path.exists(p) for p in [yt_dlp_exe, ffmpeg_exe]):
        print("ERROR: Thiếu file thực thi (yt-dlp.exe, ffmpeg.exe) trong thư mục resources.")
        return

    output_template = os.path.join(save_path, '%(title)s.%(ext)s')
    
    command = [ yt_dlp_exe ]

    if download_format.lower() == 'mp3':
        command.extend([
            '-f', 'bestaudio',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', output_template,
            '--ffmpeg-location', resources_path,
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
            # --- TÍNH NĂNG MỚI: TẢI ĐA LUỒNG BẰNG YT-DLP ---
            # Tải đồng thời 8 mảnh (fragment) của video
            '--concurrent-fragments', '8',
        ])

    if no_playlist:
        command.insert(1, '--no-playlist')
    if thumbnail:
        command.insert(1, '--write-thumbnail')

    if cookies_path and os.path.exists(cookies_path):
        print(f"STATUS: Sử dụng file cookies từ: {cookies_path}")
        command.extend(['--cookies', cookies_path])

    command.append(url)

    print("STATUS: Đang thực thi yt-dlp...", flush=True)

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
        print("SUCCESS: Tải và xử lý file thành công!")
    else:
        print(f"ERROR: Quá trình thất bại với mã lỗi {process.returncode}.")


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
        main(args.url, args.save_path, args.resources_path, args.cookies_path,
             args.quality, args.thumbnail, args.no_playlist, args.format)
    except Exception as e:
        print(f"FATAL_ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
