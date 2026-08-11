import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let connection = null;
const audioPlayer = createAudioPlayer();
const audioQueue = [];
let isPlaying = false;
let currentChannelInfo = null;
let autoLeaveTimer = null;
let stateChangeCallback = null;

export function onStateChange(cb) {
  stateChangeCallback = cb;
}

function notifyStateChange() {
  if (typeof stateChangeCallback === 'function') {
    stateChangeCallback(getBotState());
  }
}

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
    if (autoLeaveTimer) {
      clearTimeout(autoLeaveTimer);
      autoLeaveTimer = null;
    }

    connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: adapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    connection.subscribe(audioPlayer);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        console.warn('[Bot Voice Warning]: Mất kết nối voice, đang dọn dẹp...');
        disconnectVoice();
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    currentChannelInfo = {
      guildId,
      guildName: guild ? guild.name : 'Unknown Guild',
      channelId,
      channelName: channel ? channel.name : 'Voice Channel'
    };

    console.log(`[Bot Voice]: Đã kết nối vào Voice "${currentChannelInfo.channelName}" (${currentChannelInfo.guildName})`);
    notifyStateChange();
    checkAutoLeave(channel);
    return currentChannelInfo;
  } catch (error) {
    console.error('[Bot Voice Error]: Không thể vào Voice Channel:', error.message);
    if (connection) {
      connection.destroy();
      connection = null;
    }
    currentChannelInfo = null;
    notifyStateChange();
    throw error;
  }
}

/**
 * Ngắt kết nối khỏi Voice Channel
 */
export function disconnectVoice() {
  if (autoLeaveTimer) {
    clearTimeout(autoLeaveTimer);
    autoLeaveTimer = null;
  }
  if (connection) {
    connection.destroy();
    connection = null;
    currentChannelInfo = null;
    audioQueue.length = 0;
    audioPlayer.stop();
    console.log('[Bot Voice]: Đã ngắt kết nối khỏi kênh Voice');
    notifyStateChange();
  }
}

/**
 * Thêm file âm thanh vào hàng đợi
 */
export function queueAudio(filePath) {
  audioQueue.push(filePath);
  processQueue();
}

/**
 * Kiểm tra xem phòng có còn người không, nếu trống thì hẹn 10s tự out
 */
function checkAutoLeave(voiceChannel) {
  if (!voiceChannel || !currentChannelInfo) return;

  const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
  
  if (humanMembers.size === 0) {
    if (!autoLeaveTimer) {
      console.log('[Auto-Leave]: Phòng không còn ai, bot sẽ tự out sau 10 giây...');
      autoLeaveTimer = setTimeout(() => {
        console.log('[Auto-Leave]: 10 giây đã trôi qua, bot tự rời kênh voice!');
        disconnectVoice();
      }, 10_000);
    }
  } else {
    if (autoLeaveTimer) {
      console.log('[Auto-Leave]: Đã có người vào phòng, hủy đếm ngược tự out.');
      clearTimeout(autoLeaveTimer);
      autoLeaveTimer = null;
    }
  }
}

// Xử lý sự kiện voiceStateUpdate để tự out khi room trống
client.on('voiceStateUpdate', (oldState, newState) => {
  if (!currentChannelInfo) return;

  const channelId = currentChannelInfo.channelId;
  if (oldState.channelId === channelId || newState.channelId === channelId) {
    const channel = client.channels.cache.get(channelId);
    if (channel && channel.isVoiceBased()) {
      checkAutoLeave(channel);
    }
  }
});

// Hàm đăng ký Slash Command tức thì cho từng Guild & Global
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('gummyajoin')
      .setDescription('Mời bot TTS vào kênh voice bạn đang ở'),
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Mời bot TTS vào kênh voice bạn đang ở')
  ];

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Đăng ký Global
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('[Slash Commands]: Đã đăng ký lệnh Global (/gummyajoin & /join)');

    // Đăng ký tức thì cho từng Guild đang kết nối
    client.guilds.cache.forEach(async (guild) => {
      try {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guild.id),
          { body: commands }
        );
        console.log(`[Slash Commands]: Đã đăng ký lệnh tức thì cho Guild "${guild.name}"`);
      } catch (gErr) {
        console.warn(`[Slash Commands Warning]: Không thể đăng ký cho Guild ${guild.name}:`, gErr.message);
      }
    });
  } catch (err) {
    console.warn('[Slash Command Error]: Không thể đăng ký lệnh slash:', err.message);
  }
}

// Đăng ký lệnh Slash Command khi bot Ready
client.once('ready', async () => {
  console.log(`[Discord Bot]: Đã đăng nhập tài khoản: ${client.user.tag}`);
  await registerCommands();
});

client.on('guildCreate', async (guild) => {
  console.log(`[Discord Bot]: Đã tham gia Guild mới: ${guild.name}`);
  await registerCommands();
});

// Xử lý khi người dùng gõ lệnh Slash /gummyajoin hoặc /join
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'gummyajoin' || interaction.commandName === 'join') {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '⚠️ Bạn phải ở trong một Kênh Voice trước khi dùng lệnh này!',
        ephemeral: true
      });
    }

    try {
      await interaction.deferReply();
      await connectToVoice(interaction.guildId, voiceChannel.id, interaction.guild.voiceAdapterCreator);
      await interaction.editReply(`✅ Bot đã vào kênh voice **${voiceChannel.name}** thành công!`);
    } catch (err) {
      await interaction.editReply(`❌ Không thể vào kênh voice: ${err.message}`);
    }
  }
});

// Xử lý khi người dùng gõ tin nhắn text !gummyajoin, /gummyajoin, !join, /join
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();
  const isMentioned = client.user && message.mentions.has(client.user);
  
  if (
    content === '/gummyajoin' || 
    content === '!gummyajoin' || 
    content === '!join' || 
    content === '/join' ||
    (isMentioned && (content.includes('join') || content.includes('vào')))
  ) {
    const voiceChannel = message.member?.voice?.channel;

    if (!voiceChannel) {
      return message.reply('⚠️ Bạn phải ở trong một Kênh Voice trước khi dùng lệnh này!');
    }

    try {
      await connectToVoice(message.guildId, voiceChannel.id, message.guild.voiceAdapterCreator);
      await message.reply(`✅ Bot đã vào kênh voice **${voiceChannel.name}** thành công!`);
    } catch (err) {
      await message.reply(`❌ Không thể vào kênh voice: ${err.message}`);
    }
  }
});

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
