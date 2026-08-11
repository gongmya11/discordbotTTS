const socket = io();

// Element references
const calloutsGrid = document.getElementById('calloutsGrid');
const presetCount = document.getElementById('presetCount');
const connectedChannelName = document.getElementById('connectedChannelName');
const channelBadge = document.getElementById('channelBadge');

const customTextInput = document.getElementById('customTextInput');
const voiceSelect = document.getElementById('voiceSelect');
const btnSendCustomText = document.getElementById('btnSendCustomText');

// Modals
const presetModal = document.getElementById('presetModal');
const btnManagePresets = document.getElementById('btnManagePresets');
const btnCloseModal = document.getElementById('btnCloseModal');
const presetForm = document.getElementById('presetForm');
const editPresetId = document.getElementById('editPresetId');
const presetLabelInput = document.getElementById('presetLabelInput');
const presetTextInput = document.getElementById('presetTextInput');
const presetIconInput = document.getElementById('presetIconInput');
const presetColorInput = document.getElementById('presetColorInput');
const btnDeletePreset = document.getElementById('btnDeletePreset');

const voiceModal = document.getElementById('voiceModal');
const btnConnectVoice = document.getElementById('btnConnectVoice');
const btnCloseVoiceModal = document.getElementById('btnCloseVoiceModal');
const guildSelect = document.getElementById('guildSelect');
const channelSelect = document.getElementById('channelSelect');
const btnConfirmVoiceConnect = document.getElementById('btnConfirmVoiceConnect');
const btnDisconnectVoiceChannel = document.getElementById('btnDisconnectVoiceChannel');

let currentPresets = [];
let botState = {};

// Socket Event Listeners
socket.on('connect', () => {
  console.log('[Socket] Connected to server');
});

socket.on('presets-list', (presets) => {
  currentPresets = presets;
  renderPresets(presets);
});

socket.on('bot-state', (state) => {
  botState = state;
  updateBotStateUI(state);
});

// Render Preset Buttons
function renderPresets(presets) {
  calloutsGrid.innerHTML = '';
  presetCount.textContent = `${presets.length} câu phát nhanh`;

  presets.forEach((preset) => {
    const card = document.createElement('div');
    card.className = 'callout-card';
    card.setAttribute('data-id', preset.id);

    // Apply color accent if present
    if (preset.color) {
      card.style.borderTop = `3px solid ${preset.color}`;
    }

    card.innerHTML = `
      <div class="callout-icon">${preset.icon || '💬'}</div>
      <div class="callout-label">${escapeHtml(preset.label)}</div>
    `;

    // Single click: trigger speech
    card.addEventListener('click', () => {
      triggerHapticFeedback();
      socket.emit('play-preset', { id: preset.id });
    });

    // Long press to edit button
    let pressTimer;
    card.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        openEditPresetModal(preset);
      }, 700);
    });
    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    calloutsGrid.appendChild(card);
  });
}

// Update Voice Status UI
function updateBotStateUI(state) {
  if (state.voiceConnection) {
    connectedChannelName.textContent = `${state.voiceConnection.channelName}`;
    channelBadge.classList.add('connected');
  } else {
    connectedChannelName.textContent = 'Chưa vào Voice';
    channelBadge.classList.remove('connected');
  }

  // Populate Guilds dropdown
  if (state.guilds && state.guilds.length > 0) {
    guildSelect.innerHTML = '<option value="">-- Chọn Server --</option>';
    state.guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      guildSelect.appendChild(opt);
    });

    if (state.voiceConnection) {
      guildSelect.value = state.voiceConnection.guildId;
      updateChannelsDropdown(state.voiceConnection.guildId);
      channelSelect.value = state.voiceConnection.channelId;
    }
  }
}

// Guild select change event
guildSelect.addEventListener('change', (e) => {
  updateChannelsDropdown(e.target.value);
});

function updateChannelsDropdown(guildId) {
  channelSelect.innerHTML = '<option value="">-- Chọn Kênh Voice --</option>';
  if (!guildId || !botState.guilds) return;

  const guild = botState.guilds.find(g => g.id === guildId);
  if (guild && guild.channels) {
    guild.channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name;
      channelSelect.appendChild(opt);
    });
  }
}

// Send custom TTS text
function sendCustomTTS() {
  const text = customTextInput.value.trim();
  const voice = voiceSelect.value;

  if (!text) return;

  triggerHapticFeedback();
  socket.emit('speak-custom', { text, voice });
  customTextInput.value = '';
}

btnSendCustomText.addEventListener('click', sendCustomTTS);
customTextInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCustomTTS();
});

// Preset Modal Events
btnManagePresets.addEventListener('click', () => {
  openAddPresetModal();
});

btnCloseModal.addEventListener('click', () => {
  presetModal.classList.remove('active');
});

function openAddPresetModal() {
  editPresetId.value = '';
  presetLabelInput.value = '';
  presetTextInput.value = '';
  presetIconInput.value = '🎯';
  presetColorInput.value = '#f97316';
  document.getElementById('modalTitle').textContent = 'Thêm Quick Callout Mới';
  btnDeletePreset.style.display = 'none';
  presetModal.classList.add('active');
}

function openEditPresetModal(preset) {
  editPresetId.value = preset.id;
  presetLabelInput.value = preset.label;
  presetTextInput.value = preset.text;
  presetIconInput.value = preset.icon || '🎯';
  presetColorInput.value = preset.color || '#f97316';
  document.getElementById('modalTitle').textContent = 'Sửa Quick Callout';
  btnDeletePreset.style.display = 'block';
  presetModal.classList.add('active');
}

presetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const presetData = {
    id: editPresetId.value || undefined,
    label: presetLabelInput.value.trim(),
    text: presetTextInput.value.trim(),
    icon: presetIconInput.value.trim(),
    color: presetColorInput.value
  };

  socket.emit('save-preset', presetData);
  presetModal.classList.remove('active');
});

btnDeletePreset.addEventListener('click', () => {
  const id = editPresetId.value;
  if (id && confirm('Bạn có chắc chắn muốn xóa nút bấm này?')) {
    socket.emit('delete-preset', { id });
    presetModal.classList.remove('active');
  }
});

// Voice Channel Modal Events
btnConnectVoice.addEventListener('click', () => {
  voiceModal.classList.add('active');
});

btnCloseVoiceModal.addEventListener('click', () => {
  voiceModal.classList.remove('active');
});

btnConfirmVoiceConnect.addEventListener('click', () => {
  const guildId = guildSelect.value;
  const channelId = channelSelect.value;

  if (!guildId || !channelId) {
    alert('Vui lòng chọn đầy đủ Server và Kênh Voice!');
    return;
  }

  socket.emit('join-voice', { guildId, channelId });
  voiceModal.classList.remove('active');
});

btnDisconnectVoiceChannel.addEventListener('click', () => {
  socket.emit('leave-voice');
  voiceModal.classList.remove('active');
});

// Utility Functions
function triggerHapticFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(25);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
