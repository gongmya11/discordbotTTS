import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const pthPath = path.resolve('domixi', 'domixi.pth');
const indexPath = path.resolve('domixi', 'added_IVF344_Flat_nprobe_1_domixi_v2.index');
const rvcScriptPath = path.resolve('src', 'rvc_infer.py');
const cacheDir = path.resolve('audio_cache');

/**
 * Biến đổi file âm thanh TTS ban đầu thành giọng Độ Mixi sử dụng RVC v2 Model
 * @param {string} rawAudioPath - Đường dẫn file MP3 TTS gốc
 * @returns {Promise<string>} - Trả về đường dẫn file MP3 giọng Độ Mixi
 */
export async function convertToDomixiVoice(rawAudioPath) {
  // Nếu không có file model Độ Mixi thì trả về file gốc
  if (!fs.existsSync(pthPath) || !fs.existsSync(indexPath)) {
    console.warn('[RVC Warning]: Chưa thấy file model domixi.pth/index, phát giọng TTS chuẩn.');
    return rawAudioPath;
  }

  const rawFileName = path.basename(rawAudioPath, '.mp3');
  const domixiAudioPath = path.join(cacheDir, `${rawFileName}_domixi.mp3`);

  // Phản hồi tức thì nếu đã có trong cache
  if (fs.existsSync(domixiAudioPath)) {
    return domixiAudioPath;
  }

  return new Promise((resolve) => {
    // Thử gọi python3 hoặc python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    console.log(`[RVC Processing]: Đang biến đổi giọng nói sang giọng Độ Mixi...`);

    const rvcProcess = spawn(pythonCmd, [
      rvcScriptPath,
      rawAudioPath,
      domixiAudioPath,
      pthPath,
      indexPath,
      '0' // pitch adjustment
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
        console.warn(`[RVC Fallback]: Không thể biến đổi RVC (${output}), sử dụng giọng TTS gốc.`);
        resolve(rawAudioPath);
      }
    });

    rvcProcess.on('error', (err) => {
      console.warn(`[RVC Error]: Lỗi gọi Python RVC (${err.message}), sử dụng giọng TTS gốc.`);
      resolve(rawAudioPath);
    });
  });
}
