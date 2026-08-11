import * as googleTTS from 'google-tts-api';
import fs from 'fs';
import path from 'path';

const testText = "Anh em ơi, ra mid combat cùng tôi với nào!";
const cacheDir = path.resolve('audio_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function runTest() {
  console.log(`[Test]: Đang khởi tạo file âm thanh mẫu cho câu: "${testText}"...`);
  
  const base64Audio = await googleTTS.getAudioBase64(testText, {
    lang: 'vi',
    slow: false,
    host: 'https://translate.google.com',
    timeout: 10000,
  });

  const buffer = Buffer.from(base64Audio, 'base64');
  const filePath = path.join(cacheDir, 'domixi_test_speech.mp3');
  fs.writeFileSync(filePath, buffer);

  console.log(`✅ [Test Success]: Đã tạo thành công file test âm thanh tại: ${filePath}`);
  console.log(`📊 Dung lượng file: ${buffer.length} bytes`);
}

runTest().catch(err => console.error('Test Error:', err));
