import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const pthPath = path.resolve('domixi', 'domixi.pth');
const indexPath = path.resolve('domixi', 'added_IVF344_Flat_nprobe_1_domixi_v2.index');
const rvcScriptPath = path.resolve('src', 'rvc_infer.py');
const cacheDir = path.resolve('audio_cache');

let pyProcess = null;
let rlInterface = null;
const requestQueue = [];

/**
 * Khởi chạy và duy trì Daemon Python RVC thường trực trong bộ nhớ
 */
function startRvcDaemon() {
  if (pyProcess) return;

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  console.log('[RVC Daemon]: Đang khởi chạy tiến trình RVC Worker nền...');

  try {
    pyProcess = spawn(pythonCmd, [rvcScriptPath], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    rlInterface = readline.createInterface({
      input: pyProcess.stdout,
      terminal: false
    });

    rlInterface.on('line', (line) => {
      line = line.trim();
      if (!line) return;

      if (line.startsWith('STATUS:')) {
        console.log(`[RVC Daemon Status]: ${line}`);
        return;
      }

      const activeReq = requestQueue.shift();
      if (activeReq) {
        try {
          const res = JSON.parse(line);
          if (res.status === 'success' && fs.existsSync(res.output) && fs.statSync(res.output).size > 0) {
            console.log(`[RVC Success]: Đã chuyển đổi sang Giọng Độ Mixi (${path.basename(res.output)})!`);
            activeReq.resolve(res.output);
          } else {
            console.warn(`[RVC Warning]: Biến đổi RVC thất bại (${res.message || res.status}), sử dụng giọng TTS gốc.`);
            activeReq.resolve(activeReq.rawAudioPath);
          }
        } catch (e) {
          activeReq.resolve(activeReq.rawAudioPath);
        }
      }
    });

    pyProcess.on('exit', (code) => {
      console.warn(`[RVC Daemon]: Tiến trình Python RVC đã thoát (code ${code}). Tự động ngắt hàng đợi...`);
      pyProcess = null;
      rlInterface = null;
      while (requestQueue.length > 0) {
        const req = requestQueue.shift();
        req.resolve(req.rawAudioPath);
      }
    });

    pyProcess.on('error', (err) => {
      console.warn(`[RVC Daemon Error]: Không thể gọi Python RVC (${err.message}).`);
    });
  } catch (e) {
    console.error('[RVC Daemon Error]: Khởi tạo thất bại:', e.message);
  }
}

// Khởi chạy daemon sẵn từ khi khởi động ứng dụng
startRvcDaemon();

/**
 * Biến đổi câu thoại TTS thành giọng Độ Mixi sử dụng mô hình RVC v2 (Latency siêu thấp)
 * @param {string} rawAudioPath - Đường dẫn file MP3 TTS gốc
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3 giọng Độ Mixi
 */
export async function convertToDomixiVoice(rawAudioPath) {
  // Kiểm tra sự tồn tại của file model Độ Mixi
  if (!fs.existsSync(pthPath)) {
    console.warn('[RVC Warning]: Không tìm thấy file model domixi.pth');
    return rawAudioPath;
  }

  const rawFileName = path.basename(rawAudioPath, '.mp3');
  const domixiAudioPath = path.join(cacheDir, `${rawFileName}_domixi.mp3`);

  // Phản hồi 0s nếu đã có sẵn trong audio_cache
  if (fs.existsSync(domixiAudioPath) && fs.statSync(domixiAudioPath).size > 0) {
    return domixiAudioPath;
  }

  startRvcDaemon();

  if (!pyProcess || !pyProcess.stdin || !pyProcess.stdin.writable) {
    console.warn('[RVC Fallback]: Tiến trình Python RVC chưa sẵn sàng, trả về giọng TTS gốc.');
    return rawAudioPath;
  }

  return new Promise((resolve) => {
    requestQueue.push({
      resolve,
      rawAudioPath
    });

    const payload = JSON.stringify({
      input: rawAudioPath,
      output: domixiAudioPath,
      pth: pthPath,
      index: indexPath,
      pitch: 0,
      f0_method: process.env.RVC_F0_METHOD || 'pm'
    }) + '\n';

    pyProcess.stdin.write(payload);
  });
}

