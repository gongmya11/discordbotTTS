import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const cacheDir = path.resolve('audio_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const VOICES = {
  NAM_MINH: 'vi-VN-NamMinhNeural',
  HOAI_MY: 'vi-VN-HoaiMyNeural'
};

/**
 * Tạo file âm thanh MP3 từ câu nói sử dụng Microsoft Edge TTS (WebSocket thuần Node.js)
 * @param {string} text - Nội dung câu nói
 * @param {string} voice - Tên voice (mặc định vi-VN-NamMinhNeural)
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3
 */
export async function generateTTSAudio(text, voice = VOICES.NAM_MINH) {
  if (!text || typeof text !== 'string') {
    throw new Error('Nội dung văn bản không hợp lệ');
  }

  const cleanText = text.trim();
  const hash = crypto.createHash('md5').update(`${voice}_${cleanText}`).digest('hex');
  const filePath = path.join(cacheDir, `${hash}.mp3`);

  // Phản hồi tức thì nếu đã có trong audio_cache
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EA6542C89211237007391F00`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbicnmoedljan'
      }
    });

    const fileStream = fs.createWriteStream(filePath);
    let hasAudioData = false;

    ws.on('open', () => {
      const configMsg = `Path: speech.config\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n{"context":{"synthesis":{"audio":{"metadataversion":"2020.08.04","format":"audio-24khz-96kbitrate-mono-mp3"}}}}`;
      ws.send(configMsg);

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='${voice}'><lang xml:lang='vi-VN'>${cleanText}</lang></voice></speak>`;
      const ssmlMsg = `Path: ssml\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\nContent-Type: application/ssml+xml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const headerLength = data.readUInt16BE(0);
        const audioData = data.subarray(2 + headerLength);
        fileStream.write(audioData);
        hasAudioData = true;
      } else {
        const textStr = data.toString();
        if (textStr.includes('Path:turn.end')) {
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      fileStream.end();
      if (hasAudioData) {
        resolve(filePath);
      } else {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        reject(new Error('Edge TTS không trả về dữ liệu âm thanh'));
      }
    });

    ws.on('error', (err) => {
      fileStream.end();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      reject(err);
    });
  });
}
