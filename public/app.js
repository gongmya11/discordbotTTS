const socket = io();

// DOM Elements
const channelBadge = document.getElementById('channelBadge');
const connectedChannelName = document.getElementById('connectedChannelName');
const botAvatar = document.getElementById('botAvatar');
const calloutsGrid = document.getElementById('calloutsGrid');
const presetCount = document.getElementById('presetCount');
const customTextInput = document.getElementById('customTextInput');
const btnSendCustomText = document.getElementById('btnSendCustomText');
const voiceSelect = document.getElementById('voiceSelect');
const catPills = document.querySelectorAll('.cat-pill');
const audioBanner = document.getElementById('audioBanner');
const audioBannerText = document.getElementById('audioBannerText');

// Modals & Buttons
const btnConnectVoice = document.getElementById('btnConnectVoice');
const btnManagePresets = document.getElementById('btnManagePresets');
const voiceModal = document.getElementById('voiceModal');
const btnCloseVoiceModal = document.getElementById('btnCloseVoiceModal');
const guildSelect = document.getElementById('guildSelect');
const channelSelect = document.getElementById('channelSelect');
const btnConfirmVoiceConnect = document.getElementById('btnConfirmVoiceConnect');
const btnDisconnectVoiceChannel = document.getElementById('btnDisconnectVoiceChannel');

const presetModal = document.getElementById('presetModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const presetForm = document.getElementById('presetForm');
const modalTitle = document.getElementById('modalTitle');
const editPresetId = document.getElementById('editPresetId');
const presetLabelInput = document.getElementById('presetLabelInput');
const presetTextInput = document.getElementById('presetTextInput');
const presetCategoryInput = document.getElementById('presetCategoryInput');
const presetIconInput = document.getElementById('presetIconInput');
const presetColorInput = document.getElementById('presetColorInput');
const btnDeletePreset = document.getElementById('btnDeletePreset');

let allPresets = [];
let currentCategory = 'all';
let currentBotState = null;
let playingTimer = null;

// Notification Toast
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Trigger Audio Wave Visualizer
function triggerAudioPlayback(textSnippet) {
  if (audioBanner) {
    audioBannerText.textContent = textSnippet ? `Đang đọc: "${textSnippet}"` : 'Đang phát âm thanh vào Discord...';
    audioBanner.classList.add('active');
    
    if (playingTimer) clearTimeout(playingTimer);
    playingTimer = setTimeout(() => {
      audioBanner.classList.remove('active');
    }, 4000);
  }
}

// Socket Listener: Presets List
socket.on('presets-list', (presets) => {
  allPresets = presets || [];
  renderPresets();
});

// Socket Listener: Bot State
socket.on('bot-state', (state) => {
  currentBotState = state;
  updateBotUI(state);
});

// Render UI dựa trên Bot State
function updateBotUI(state) {
  if (!state) return;

  if (state.botAvatar) {
    botAvatar.src = state.botAvatar;
  }

  if (state.voiceConnection && state.voiceConnection.channelName) {
    channelBadge.classList.add('connected');
    channelBadge.classList.remove('disconnected');
    connectedChannelName.textContent = `${state.voiceConnection.channelName} (${state.voiceConnection.guildName})`;
  } else {
    channelBadge.classList.remove('connected');
    channelBadge.classList.add('disconnected');
    connectedChannelName.textContent = 'Chưa vào Kênh Voice';
  }

  // Cập nhật danh sách Server trong Voice Modal
  if (state.guilds) {
    guildSelect.innerHTML = '<option value="">-- Chọn Server Discord --</option>';
    state.guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      guildSelect.appendChild(opt);
    });
  }
}

// Render danh sách Presets
function renderPresets() {
  calloutsGrid.innerHTML = '';

  const filtered = currentCategory === 'all' 
    ? allPresets 
    : allPresets.filter(p => (p.category || 'giao-tiep') === currentCategory);

  presetCount.textContent = `${filtered.length} câu thoại`;

  if (filtered.length === 0) {
    calloutsGrid.innerHTML = `
      <div style="grid-column: span 2; text-align: center; color: var(--text-sub); padding: 40px 10px; font-size: 0.9rem;">
        Chưa có câu thoại nào trong danh mục này.
      </div>
    `;
    return;
  }

  filtered.forEach(preset => {
    const card = document.createElement('div');
    card.className = 'callout-card';
    card.style.setProperty('--card-accent', preset.color || '#6366f1');
    card.dataset.id = preset.id;

    card.innerHTML = `
      <div class="callout-icon">${preset.icon || '💬'}</div>
      <div class="callout-label">${escapeHtml(preset.label)}</div>
    `;

    // Click: Phát tiếng
    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-btn')) return;
      
      // Card pulse visual
      card.classList.add('playing');
      setTimeout(() => card.classList.remove('playing'), 1200);

      triggerAudioPlayback(preset.label);
      socket.emit('play-preset', { id: preset.id });
      showToast(`▶️ Đang phát: "${preset.label}"`);
    });

    // Press & Hold / Double tap to Edit
    let pressTimer;
    card.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => openEditPresetModal(preset), 600);
    });
    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openEditPresetModal(preset);
    });

    calloutsGrid.appendChild(card);
  });
}

// Category Filter Tabs
catPills.forEach(pill => {
  pill.addEventListener('click', () => {
    catPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentCategory = pill.dataset.cat;
    renderPresets();
  });
});

// Gửi Custom Speech (Văn bản tự do)
function sendCustomSpeech() {
  const text = customTextInput.value.trim();
  if (!text) return;

  const voice = voiceSelect.value;
  socket.emit('speak-custom', { text, voice });
  triggerAudioPlayback(text.length > 25 ? text.substring(0, 25) + '...' : text);
  showToast(`🗣️ Đang phát: "${text.substring(0, 20)}..."`);
  customTextInput.value = '';
}

btnSendCustomText.addEventListener('click', sendCustomSpeech);
customTextInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCustomSpeech();
});

// Modal Voice Connect Handlers
btnConnectVoice.addEventListener('click', () => {
  voiceModal.classList.add('active');
});

btnCloseVoiceModal.addEventListener('click', () => {
  voiceModal.classList.remove('active');
});

guildSelect.addEventListener('change', () => {
  const guildId = guildSelect.value;
  channelSelect.innerHTML = '<option value="">-- Chọn Kênh Voice --</option>';

  if (!guildId || !currentBotState) return;

  const guild = currentBotState.guilds.find(g => g.id === guildId);
  if (guild && guild.channels) {
    guild.channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `🔊 ${ch.name}`;
      channelSelect.appendChild(opt);
    });
  }
});

btnConfirmVoiceConnect.addEventListener('click', () => {
  const guildId = guildSelect.value;
  const channelId = channelSelect.value;

  if (!guildId || !channelId) {
    showToast('⚠️ Vui lòng chọn cả Server và Kênh Voice!');
    return;
  }

  socket.emit('join-voice', { guildId, channelId });
  showToast('🔄 Đang gửi yêu cầu vào Voice...');
  voiceModal.classList.remove('active');
});

btnDisconnectVoiceChannel.addEventListener('click', () => {
  socket.emit('leave-voice');
  showToast('🔴 Đã ngắt kết nối Voice');
  voiceModal.classList.remove('active');
});

// Modal Preset Management (Thêm / Sửa Preset)
btnManagePresets.addEventListener('click', () => {
  openAddPresetModal();
});

btnCloseModal.addEventListener('click', () => {
  presetModal.classList.remove('active');
});

function openAddPresetModal() {
  modalTitle.textContent = 'Thêm Nút Bấm Mới';
  editPresetId.value = '';
  presetLabelInput.value = '';
  presetTextInput.value = '';
  presetCategoryInput.value = 'giao-tiep';
  presetIconInput.value = '💬';
  presetColorInput.value = '#6366f1';
  btnDeletePreset.style.display = 'none';
  presetModal.classList.add('active');
}

function openEditPresetModal(preset) {
  modalTitle.textContent = 'Chỉnh Sửa Nút Bấm';
  editPresetId.value = preset.id;
  presetLabelInput.value = preset.label || '';
  presetTextInput.value = preset.text || '';
  presetCategoryInput.value = preset.category || 'giao-tiep';
  presetIconInput.value = preset.icon || '💬';
  presetColorInput.value = preset.color || '#6366f1';
  btnDeletePreset.style.display = 'block';
  presetModal.classList.add('active');
}

presetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = editPresetId.value;
  const label = presetLabelInput.value.trim();
  const text = presetTextInput.value.trim();
  const category = presetCategoryInput.value;
  const icon = presetIconInput.value.trim() || '💬';
  const color = presetColorInput.value;

  if (!label || !text) return;

  socket.emit('save-preset', { id: id || undefined, label, text, category, icon, color });
  showToast(id ? '✅ Đã cập nhật nút bấm!' : '✅ Đã thêm nút bấm mới!');
  presetModal.classList.remove('active');
});

btnDeletePreset.addEventListener('click', () => {
  const id = editPresetId.value;
  if (id && confirm('Bạn có chắc chắn muốn xóa nút bấm này không?')) {
    socket.emit('delete-preset', { id });
    showToast('🗑️ Đã xóa nút bấm');
    presetModal.classList.remove('active');
  }
});

// Utility
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
