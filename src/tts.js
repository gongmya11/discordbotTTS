import * as googleTTS from 'google-tts-api';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const cacheDir = path.resolve('audio_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const VOICES = {
  NAM_MINH: 'vi',
  HOAI_MY: 'vi'
};

/**
 * Tạo file âm thanh MP3 từ câu nói Tiếng Việt sử dụng Google Translate TTS
 * @param {string} text - Nội dung câu nói
 * @param {string} voice - Mã ngôn ngữ (mặc định 'vi')
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3
 */
export async function generateTTSAudio(text, voice = VOICES.NAM_MINH) {
  if (!text || typeof text !== 'string') {
    throw new Error('Nội dung văn bản không hợp lệ');
  }

  const cleanText = text.trim();
  const hash = crypto.createHash('md5').update(`vi_${cleanText}`).digest('hex');
  const filePath = path.join(cacheDir, `${hash}.mp3`);

  // Phản hồi tức thì nếu đã có trong audio_cache
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    // Lấy chuỗi audio Base64 từ Google TTS API (chất lượng cao, phản hồi nhanh)
    const base64Audio = await googleTTS.getAudioBase64(cleanText, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    const buffer = Buffer.from(base64Audio, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`[TTS Success]: Đã sinh file audio (${buffer.length} bytes) cho câu: "${cleanText}"`);
    return filePath;
  } catch (err) {
    console.error('[TTS Generation Error]:', err.message);
    throw err;
  }
}
