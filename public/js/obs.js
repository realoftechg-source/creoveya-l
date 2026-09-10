let realtimeSession = null;
let localStream = null;
let heartbeatTimer = null;
let selectedLookPrompt = '';

const video = document.getElementById('transformedFeed');
const placeholder = document.getElementById('placeholder');
const controls = document.getElementById('controls');
const statusEl = document.getElementById('status');
const goLiveBtn = document.getElementById('goLiveBtn');
const stopBtn = document.getElementById('stopBtn');
const lookSelect = document.getElementById('lookSelect');

async function init() {
  const user = await getSession();
  if (!user) {
    statusEl.textContent = 'Not signed in — right-click this source in OBS, choose "Interact", and log in once.';
    placeholder.querySelector('span:nth-child(2)').textContent = 'Sign-in required';
    goLiveBtn.textContent = 'Open Login';
    goLiveBtn.addEventListener('click', () => { window.location.href = '/login.html'; });
    return;
  }
  if (!user.isAdmin && !user.hasActiveAccess) {
    statusEl.textContent = 'No active plan on this account yet.';
    return;
  }

  try {
    const data = await apiFetch('/api/studio/looks');
    lookSelect.innerHTML = ['<option value="">My Camera (no look)</option>']
      .concat(data.looks.map((l) => `<option value="${l.id}">${l.name}</option>`))
      .join('');
  } catch (e) { /* non-fatal — default option still works */ }

  goLiveBtn.addEventListener('click', goLive);
  stopBtn.addEventListener('click', () => stopFeed('user_stopped'));
  lookSelect.addEventListener('change', async () => {
    const id = lookSelect.value;
    if (!id) { selectedLookPrompt = ''; }
    else {
      try {
        const data = await apiFetch(`/api/studio/looks/${id}/select`, { method: 'POST' });
        selectedLookPrompt = data.look.prompt || '';
      } catch (e) { /* ignore — falls back to current prompt */ }
    }
    if (realtimeSession) {
      try { await realtimeSession.set({ prompt: selectedLookPrompt || 'Apply a natural, high-fidelity AI transformation.', enhance: true }); } catch (e) {}
    }
  });
}

async function goLive() {
  goLiveBtn.disabled = true;
  goLiveBtn.textContent = 'Connecting…';
  statusEl.textContent = 'Connecting…';

  try {
    await apiFetch('/api/studio/stream/start', { method: 'POST' });

    const { createDecartClient, models } = await import('https://cdn.jsdelivr.net/npm/@decartai/sdk@0.1.14/+esm');
    const tokenRes = await apiFetch('/api/studio/realtime-token', { method: 'POST' });
    const model = models.realtime('lucy-2.1');

    localStream = await navigator.mediaDevices.getUserMedia({
      video: { frameRate: model.fps, width: model.width, height: model.height },
      audio: false,
    });

    const client = createDecartClient({ apiKey: tokenRes.apiKey });
    realtimeSession = await client.realtime.connect(localStream, {
      model,
      mirror: 'auto',
      onRemoteStream: (stream) => {
        video.srcObject = stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        controls.style.display = 'flex';
        statusEl.textContent = '● LIVE — ready for OBS to capture';
      },
    });

    if (selectedLookPrompt) {
      try { await realtimeSession.set({ prompt: selectedLookPrompt, enhance: true }); } catch (e) {}
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      try {
        const data = await apiFetch('/api/studio/stream/heartbeat', { method: 'POST' });
        if (data.exhausted) {
          statusEl.textContent = 'Out of usage time — stream ended.';
          await stopFeed('exhausted', true);
        }
      } catch (e) {
        await stopFeed('heartbeat_error', true);
      }
    }, 10000);
  } catch (err) {
    console.error('OBS output connection failed:', err);
    statusEl.textContent = 'Connection failed — check camera permissions and try again.';
    goLiveBtn.disabled = false;
    goLiveBtn.textContent = 'Start Transformed Feed';
  }
}

async function stopFeed(reason, skipServerStop) {
  clearInterval(heartbeatTimer);
  if (realtimeSession) {
    try { realtimeSession.disconnect(); } catch (e) {}
    realtimeSession = null;
  }
  if (!skipServerStop) {
    try { await apiFetch('/api/studio/stream/stop', { method: 'POST' }); } catch (e) {}
  }
  video.style.display = 'none';
  video.srcObject = null;
  controls.style.display = 'none';
  placeholder.style.display = 'flex';
  goLiveBtn.disabled = false;
  goLiveBtn.textContent = 'Start Transformed Feed';
  statusEl.textContent = '';
}

init();
