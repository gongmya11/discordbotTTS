import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const cacheDir = path.resolve('audio_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const VOICES = {
  NAM_MINH: 'vi-VN-NamMinhNeural',
  HOAI_MY: 'vi-VN-HoaiMyNeural',
  ELEVEN_DEFAULT: 'JBFqnCBsd6RMkjVDRZzb'
};

/**
 * Tạo file âm thanh MP3 từ câu nói Tiếng Việt sử dụng ElevenLabs AI (kèm fallback Microsoft Edge Neural TTS)
 * @param {string} text - Nội dung câu nói
 * @param {string} voiceId - Voice ID trên ElevenLabs hoặc Edge Neural Voice ID (tùy chọn)
 * @returns {Promise<string>} - Trả về đường dẫn tuyệt đối tới file mp3
 */
export async function generateTTSAudio(text, voiceId = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('Nội dung văn bản không hợp lệ');
  }

  const cleanText = text.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const targetVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || VOICES.NAM_MINH;

  const hash = crypto.createHash('md5').update(`${apiKey ? 'eleven_' : 'edge_'}${targetVoiceId}_${cleanText}`).digest('hex');
  const filePath = path.join(cacheDir, `${hash}.mp3`);

  // Phản hồi 0s nếu đã có sẵn trong audio_cache
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return filePath;
  }

  // 1. ƯU TIÊN SỬ DỤNG ELEVENLABS AI (NẾU CÓ API KEY TRONG .ENV)
  if (apiKey && apiKey !== 'your_elevenlabs_api_key_here') {
    try {
      console.log(`[ElevenLabs AI]: Đang tạo giọng nói siêu thực cho câu: "${cleanText}"...`);
      const elVoice = targetVoiceId.includes('Neural') ? VOICES.ELEVEN_DEFAULT : targetVoiceId;

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2', // Model tiếng Việt đỉnh nhất ElevenLabs
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
      console.warn('[ElevenLabs Fallback]: Chuyển sang Microsoft Edge Neural TTS:', err.message);
    }
  }

  // 2. SỬ DỤNG MICROSOFT EDGE NEURAL TTS (MIỄN PHÍ, TỰ NHIÊN NHƯ NGƯỜI THẬT, KHÔNG CẦN API KEY)
  try {
    const selectedVoice = targetVoiceId.includes('Neural') ? targetVoiceId : VOICES.NAM_MINH;
    console.log(`[Edge Neural TTS]: Đang tạo giọng đọc (${selectedVoice}): "${cleanText}"...`);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const stream = tts.toStream(cleanText);

    return new Promise((resolve, reject) => {
      const outStream = fs.createWriteStream(filePath);
      stream.audioStream.pipe(outStream);

      outStream.on('finish', () => {
        console.log(`[Edge Neural TTS Success]: Đã sinh file audio (${fs.statSync(filePath).size} bytes)`);
        resolve(filePath);
      });

      outStream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (err) {
    console.error('[TTS Generation Error]:', err.message);
    throw err;
  }
}

