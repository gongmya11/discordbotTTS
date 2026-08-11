import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { 
  client, 
  connectToVoice, 
  disconnectVoice, 
  queueAudio, 
  getBotState,
  onStateChange
} from './src/bot.js';
import { generateTTSAudio, VOICES } from './src/tts.js';
import { convertToDomixiVoice } from './src/rvc.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Phát tín hiệu đồng bộ real-time lên điện thoại khi Bot tự vào/ra voice
onStateChange((state) => {
  io.emit('bot-state', state);
});


const PORT = process.env.PORT || 3000;
const presetsPath = path.resolve('presets.json');

// Helper đọc/ghi presets.json
function loadPresets() {
  try {
    if (fs.existsSync(presetsPath)) {
      const data = fs.readFileSync(presetsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Presets Error]: Khởi tạo presets thất bại:', err.message);
  }
  return [];
}

function savePresets(presets) {
  try {
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf8');
    io.emit('presets-list', presets);
  } catch (err) {
    console.error('[Presets Error]: Lưu file presets thất bại:', err.message);
  }
}

let presets = loadPresets();

// Static file server
app.use(express.static(path.resolve('public')));
app.use(express.json());

// API Endpoints phụ
app.get('/api/status', (req, res) => {
  res.json(getBotState());
});

app.get('/api/presets', (req, res) => {
  res.json(presets);
});

// Socket.io Real-time Event Handling
io.on('connection', (socket) => {
  console.log(`[Socket]: Điện thoại/Browser mới kết nối (ID: ${socket.id})`);

  // Gửi thông tin ban đầu khi client kết nối
  socket.emit('presets-list', presets);
  socket.emit('bot-state', getBotState());

  // Bấm nút Quick Callout trên màn hình
  socket.on('play-preset', async ({ id }) => {
    const item = presets.find(p => p.id === id);
    if (!item || !item.text) return;

    try {
      console.log(`[QuickCall]: Bấm nút "${item.label}" -> Đang tạo giọng đọc: "${item.text}"`);
      const rawAudioPath = await generateTTSAudio(item.text, VOICES.NAM_MINH);
      const domixiAudioPath = await convertToDomixiVoice(rawAudioPath);
      queueAudio(domixiAudioPath);
    } catch (err) {
      console.error('[TTS Play Error]:', err.message);
    }
  });

  // Gõ câu thoại tự do (Custom Speech Input)
  socket.on('speak-custom', async ({ text, voice }) => {
    if (!text || !text.trim()) return;

    try {
      const selectedVoice = voice || VOICES.NAM_MINH;
      console.log(`[CustomTTS]: Đang đọc câu thoại tự chọn (${selectedVoice}): "${text}"`);
      const rawAudioPath = await generateTTSAudio(text, selectedVoice);
      const domixiAudioPath = await convertToDomixiVoice(rawAudioPath);
      queueAudio(domixiAudioPath);
    } catch (err) {
      console.error('[CustomTTS Error]:', err.message);
    }
  });

  // Thêm hoặc Chỉnh sửa Quick Callout Preset
  socket.on('save-preset', (presetData) => {
    if (presetData.id) {
      // Edit existing
      const index = presets.findIndex(p => p.id === presetData.id);
      if (index !== -1) {
        presets[index] = { ...presets[index], ...presetData };
      }
    } else {
      // Add new
      const newId = `callout-${Date.now()}`;
      presets.push({ id: newId, ...presetData });
    }
    savePresets(presets);
  });

  // Xóa Preset
  socket.on('delete-preset', ({ id }) => {
    presets = presets.filter(p => p.id !== id);
    savePresets(presets);
  });

  // Yêu cầu kết nối vào Kênh Voice Discord
  socket.on('join-voice', async ({ guildId, channelId }) => {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Không tìm thấy Guild Discord');

      await connectToVoice(guildId, channelId, guild.voiceAdapterCreator);
      io.emit('bot-state', getBotState());
    } catch (err) {
      console.error('[Join Voice Error]:', err.message);
    }
  });

  // Ngắt kết nối Voice Channel
  socket.on('leave-voice', () => {
    disconnectVoice();
    io.emit('bot-state', getBotState());
  });
});

// Khởi động Discord Bot & Express Server
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (DISCORD_TOKEN && DISCORD_TOKEN !== 'your_discord_bot_token_here') {
  client.login(DISCORD_TOKEN).then(() => {
    console.log(`[Discord Bot]: Đăng nhập thành công với tài khoản ${client.user.tag}`);
    
    // Tự động kết nối voice mặc định nếu được cấu hình trong .env
    const defaultGuildId = process.env.GUILD_ID;
    const defaultVoiceId = process.env.VOICE_CHANNEL_ID;
    
    if (defaultGuildId && defaultVoiceId) {
      const guild = client.guilds.cache.get(defaultGuildId);
      if (guild) {
        connectToVoice(defaultGuildId, defaultVoiceId, guild.voiceAdapterCreator)
          .then(() => io.emit('bot-state', getBotState()))
          .catch(err => console.warn('[Auto-Join Warning]:', err.message));
      }
    }
  }).catch(err => {
    console.error('[Discord Login Error]: Không thể đăng nhập Bot:', err.message);
  });
} else {
  console.warn('[Warning]: Chưa cấu hình DISCORD_TOKEN trong file .env hoặc biến môi trường Railway!');
}

httpServer.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Web Controller sẵn sàng tại: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
