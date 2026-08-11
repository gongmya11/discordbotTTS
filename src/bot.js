import { Client, GatewayIntentBits } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import fs from 'fs';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let connection = null;
const audioPlayer = createAudioPlayer();
const audioQueue = [];
let isPlaying = false;
let currentChannelInfo = null;

// Sự kiện quản lý Audio Player Status
audioPlayer.on(AudioPlayerStatus.Idle, () => {
  isPlaying = false;
  processQueue();
});

audioPlayer.on('error', (error) => {
  console.error('[AudioPlayer Error]:', error.message);
  isPlaying = false;
  processQueue();
});

/**
 * Xử lý hàng đợi phát âm thanh lần lượt
 */
function processQueue() {
  if (isPlaying || audioQueue.length === 0) return;

  const nextAudioPath = audioQueue.shift();
  if (!fs.existsSync(nextAudioPath)) {
    processQueue();
    return;
  }

  try {
    const resource = createAudioResource(nextAudioPath);
    audioPlayer.play(resource);
    isPlaying = true;
  } catch (err) {
    console.error('[AudioResource Error]:', err);
    isPlaying = false;
    processQueue();
  }
}

/**
 * Kết nối Bot vào Voice Channel trong Discord
 */
export async function connectToVoice(guildId, channelId, adapterCreator) {
  try {
    connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: adapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    connection.subscribe(audioPlayer);

    // Xử lý tự động kết nối lại nếu bị gián đoạn mạng tạm thời
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        console.warn('[Bot Voice Warning]: Mất kết nối voice, đang ngắt kết nối dọn dẹp...');
        disconnectVoice();
      }
    });

    // Chờ kết nối sẵn sàng trong tối đa 15 giây (tối ưu cho Cloud Railway)
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    currentChannelInfo = {
      guildId,
      guildName: guild ? guild.name : 'Unknown Guild',
      channelId,
      channelName: channel ? channel.name : 'Voice Channel'
    };

    console.log(`[Bot Voice]: Đã kết nối thành công vào Voice "${currentChannelInfo.channelName}" (${currentChannelInfo.guildName})`);
    return currentChannelInfo;
  } catch (error) {
    console.error('[Bot Voice Error]: Không thể vào Voice Channel:', error.message);
    if (connection) {
      connection.destroy();
      connection = null;
    }
    currentChannelInfo = null;
    throw error;
  }
}

/**
 * Ngắt kết nối khỏi Voice Channel
 */
export function disconnectVoice() {
  if (connection) {
    connection.destroy();
    connection = null;
    currentChannelInfo = null;
    audioQueue.length = 0;
    audioPlayer.stop();
    console.log('[Bot Voice]: Đã ngắt kết nối khỏi kênh Voice');
  }
}

/**
 * Thêm file âm thanh vào hàng đợi phát âm thanh
 */
export function queueAudio(filePath) {
  audioQueue.push(filePath);
  processQueue();
}

/**
 * Lấy thông tin trạng thái hiện tại của Bot
 */
export function getBotState() {
  return {
    isLoggedIn: client.user ? true : false,
    botTag: client.user ? client.user.tag : null,
    botAvatar: client.user ? client.user.displayAvatarURL() : null,
    voiceConnection: currentChannelInfo,
    guilds: client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      channels: g.channels.cache
        .filter(c => c.isVoiceBased())
        .map(c => ({ id: c.id, name: c.name }))
    }))
  };
}
