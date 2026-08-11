import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const pthPath = path.resolve('domixi', 'domixi.pth');
const indexPath = path.resolve('domixi', 'added_IVF344_Flat_nprobe_1_domixi_v2.index');
const rvcScriptPath = path.resolve('src', 'rvc_infer.py');
const cacheDir = path.resolve('audio_cache');

/**
 * Biến đổi câu thoại TTS thành giọng Độ Mixi sử dụng mô hình RVC v2
 * @param {string} rawAudioPath - Đường dẫn file MP3 TTS gốc
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3 giọng Độ Mixi
 */
export async function convertToDomixiVoice(rawAudioPath) {
  // Kiểm tra sự tồn tại của file model Độ Mixi
  if (!fs.existsSync(pthPath) || !fs.existsSync(indexPath)) {
    console.warn('[RVC Warning]: Không tìm thấy file model domixi.pth/index');
    return rawAudioPath;
  }

  const rawFileName = path.basename(rawAudioPath, '.mp3');
  const domixiAudioPath = path.join(cacheDir, `${rawFileName}_domixi.mp3`);

  // Phản hồi 0s nếu đã biến đổi và có trong audio_cache
  if (fs.existsSync(domixiAudioPath) && fs.statSync(domixiAudioPath).size > 0) {
    return domixiAudioPath;
  }

  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`[RVC Processing]: Đang nạp mô hình domixi.pth để biến đổi giọng nói...`);

    const rvcProcess = spawn(pythonCmd, [
      rvcScriptPath,
      rawAudioPath,
      domixiAudioPath,
      pthPath,
      indexPath,
      '0' // pitch adjustment (0 là giữ nguyên tông giọng)
    ]);

    let output = '';

    rvcProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    rvcProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    rvcProcess.on('close', (code) => {
      if (fs.existsSync(domixiAudioPath) && fs.statSync(domixiAudioPath).size > 0) {
        console.log(`[RVC Success]: Đã biến đổi thành công sang Giọng Độ Mixi!`);
        resolve(domixiAudioPath);
      } else {
        console.warn(`[RVC Fallback]: Mô hình RVC chưa sẵn sàng (${output.trim()}), phát giọng TTS chuẩn.`);
        resolve(rawAudioPath);
      }
    });

    rvcProcess.on('error', (err) => {
      console.warn(`[RVC Error]: Lỗi gọi Python RVC (${err.message}), phát giọng TTS chuẩn.`);
      resolve(rawAudioPath);
    });
  });
}
