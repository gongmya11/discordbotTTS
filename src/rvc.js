import fs from 'fs';
import path from 'path';

/**
 * Biến đổi giọng nói (Hiện tại phát âm TTS trực tiếp phản hồi siêu nhanh 0s)
 * @param {string} rawAudioPath - Đường dẫn file MP3 TTS
 * @returns {Promise<string>}
 */
export async function convertToDomixiVoice(rawAudioPath) {
  return rawAudioPath;
}
