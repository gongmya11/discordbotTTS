import * as googleTTS from 'google-tts-api';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const cacheDir = path.resolve('audio_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const VOICES = {
  DEFAULT: 'JBFqnCBsd6RMkjVDRZzb' // Giọng ElevenLabs Premade miễn phí (George)
};


/**
 * Tạo file âm thanh MP3 từ câu nói Tiếng Việt sử dụng ElevenLabs AI (kèm fallback Google TTS)
 * @param {string} text - Nội dung câu nói
 * @param {string} voiceId - Voice ID trên ElevenLabs (tùy chọn)
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3
 */
export async function generateTTSAudio(text, voiceId = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('Nội dung văn bản không hợp lệ');
  }

  const cleanText = text.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const targetVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || VOICES.DEFAULT;

  const hash = crypto.createHash('md5').update(`${apiKey ? 'eleven_' : 'google_'}${targetVoiceId}_${cleanText}`).digest('hex');
  const filePath = path.join(cacheDir, `${hash}.mp3`);

  // Phản hồi 0s nếu đã có trong audio_cache
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return filePath;
  }

  // 1. ƯU TIÊN SỬ DỤNG ELEVENLABS AI (NẾU CÓ API KEY)
  if (apiKey && apiKey !== 'your_elevenlabs_api_key_here') {
    try {
      console.log(`[ElevenLabs AI]: Đang tạo giọng nói siêu thực cho câu: "${cleanText}"...`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2', // Model hỗ trợ Tiếng Việt đỉnh nhất của ElevenLabs
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs Error (${response.status}): ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      console.log(`[ElevenLabs Success]: Đã sinh file audio giọng AI siêu thực (${buffer.length} bytes)`);
      return filePath;
    } catch (err) {
      console.warn('[ElevenLabs Fallback]: Không thể gọi ElevenLabs API, chuyển sang Google TTS:', err.message);
    }
  }

  // 2. FALLBACK SANG GOOGLE TTS TIẾNG VIỆT (MIỄN PHÍ)
  try {
    const base64Audio = await googleTTS.getAudioBase64(cleanText, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    const buffer = Buffer.from(base64Audio, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`[Google TTS]: Đã sinh file audio (${buffer.length} bytes) cho câu: "${cleanText}"`);
    return filePath;
  } catch (err) {
    console.error('[TTS Generation Error]:', err.message);
    throw err;
  }
}
