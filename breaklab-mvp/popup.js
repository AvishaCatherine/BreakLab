// popup.js - improved settings save/load + Test Gemini debug + UI controls
const STATUS = document.getElementById('status');
function setStatus(msg, isError = false) {
  if (!STATUS) return;
  STATUS.textContent = msg;
  STATUS.style.color = isError ? '#ff8a8a' : '';
  if (!isError) setTimeout(()=> { if (STATUS.textContent === msg) STATUS.textContent = 'Ready'; }, 3000);
}

async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) { setStatus('No active tab', true); return null; }
  const tabId = tabs[0].id;
  try {
    const res = await chrome.tabs.sendMessage(tabId, message);
    return res;
  } catch (err) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      const res2 = await chrome.tabs.sendMessage(tabId, message);
      return res2;
    } catch (err2) {
      console.warn('sendToActiveTab failed', err, err2);
      setStatus('Action blocked on page (injection failed)', true);
      return null;
    }
  }
}

// UI buttons
document.getElementById('btnLayout').addEventListener('click', async () => { setStatus('Toggling Layout View...'); await sendToActiveTab({ action: 'toggleLayout' }); setStatus('Layout toggled'); });
document.getElementById('btnContrast').addEventListener('click', async () => { setStatus('Toggling Contrast Check...'); await sendToActiveTab({ action: 'toggleContrast' }); setStatus('Contrast toggled'); });
document.getElementById('btnPerf').addEventListener('click', async () => { setStatus('Toggling Performance Heatmap...'); await sendToActiveTab({ action: 'togglePerf' }); setStatus('Perf toggled'); });
document.getElementById('btnShadow').addEventListener('click', async () => { setStatus('Toggling Shadow DOM view...'); await sendToActiveTab({ action: 'toggleShadow' }); setStatus('Shadow toggled'); });
document.getElementById('btnDev').addEventListener('click', async () => { setStatus('Toggling Dev Insight...'); await sendToActiveTab({ action: 'toggleDevInsight' }); setStatus('Dev Insight toggled'); });
document.getElementById('btnRevert').addEventListener('click', async () => { setStatus('Reverting overlays...'); await sendToActiveTab({ action: 'revertAll' }); setStatus('Reverted'); });

// Settings panel elements
const settingsPanel = document.getElementById('settingsPanel');
const settingsStatus = document.getElementById('settingsStatus');
const settingsDebug = document.getElementById('settingsDebug');

async function loadSettingsToUI() {
  const data = await chrome.storage.local.get({
    breaklab_safe: true,
    breaklab_whitelist: '',
    breaklab_use_remote_ai: false,
    breaklab_gemini_endpoint: '',
    breaklab_gemini_apikey: ''
  });
  document.getElementById('safeMode').checked = !!data.breaklab_safe;
  document.getElementById('whitelist').value = data.breaklab_whitelist || '';
  document.getElementById('useRemoteAI').checked = !!data.breaklab_use_remote_ai;
  document.getElementById('geminiEndpoint').value = data.breaklab_gemini_endpoint || '';
  document.getElementById('geminiApiKey').value = data.breaklab_gemini_apikey || '';
  settingsStatus.textContent = '';
  settingsDebug.style.display = 'none';
  settingsDebug.textContent = '';
}

document.getElementById('btnSettings').addEventListener('click', async () => {
  const hidden = settingsPanel.getAttribute('aria-hidden') === 'true';
  settingsPanel.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  if (!hidden) return;
  await loadSettingsToUI();
});

// Save settings (with trimming + validation)
document.getElementById('saveSettings').addEventListener('click', async () => {
  try {
    const safe = !!document.getElementById('safeMode').checked;
    const wlRaw = document.getElementById('whitelist').value || '';
    const wl = wlRaw.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    const useRemoteAI = !!document.getElementById('useRemoteAI').checked;
    let endpoint = (document.getElementById('geminiEndpoint').value || '').trim();
    let apiKey = (document.getElementById('geminiApiKey').value || '').trim();

    // simple normalization: if user pasted a key-looking string but not in endpoint, keep both
    // persist exactly what user provides (we try different auth strategies later)
    await chrome.storage.local.set({
      breaklab_safe: safe,
      breaklab_whitelist: wl,
      breaklab_use_remote_ai: useRemoteAI,
      breaklab_gemini_endpoint: endpoint,
      breaklab_gemini_apikey: apiKey
    });

    settingsStatus.textContent = 'Settings saved';
    setTimeout(()=> settingsStatus.textContent = '', 2500);
    settingsPanel.setAttribute('aria-hidden', 'true');
    setStatus('Settings saved');
  } catch (e) {
    settingsStatus.textContent = 'Save failed';
    console.error(e);
  }
});

document.getElementById('closeSettings').addEventListener('click', () => {
  settingsPanel.setAttribute('aria-hidden', 'true');
});

// Test Gemini button
document.getElementById('testGemini').addEventListener('click', async () => {
  settingsStatus.textContent = 'Testing remote AI...';
  settingsDebug.style.display = 'none';
  settingsDebug.textContent = '';

  const stored = await chrome.storage.local.get({
    breaklab_use_remote_ai: false,
    breaklab_gemini_endpoint: '',
    breaklab_gemini_apikey: ''
  });

  if (!stored.breaklab_use_remote_ai) {
    settingsStatus.textContent = 'Remote AI is disabled';
    return;
  }
  if (!stored.breaklab_gemini_endpoint) {
    settingsStatus.textContent = 'Endpoint missing';
    return;
  }
  if (!stored.breaklab_gemini_apikey) {
    // allow endpoint with ?key=... even if apiKey empty
    if (!stored.breaklab_gemini_endpoint.includes('?key=')) {
      settingsStatus.textContent = 'API key missing';
      return;
    }
  }

  const testPrompt = 'Reply with: OK - BreakLab test successful.';
  settingsStatus.textContent = 'Sending test prompt...';

  chrome.runtime.sendMessage({ action: 'callGemini', payload: { prompt: testPrompt } }, (resp) => {
    if (!resp) {
      settingsStatus.textContent = 'No response from background';
      return;
    }
    if (resp.ok && resp.text) {
      settingsStatus.textContent = 'Test success';
      const aiPanel = document.getElementById('aiPanel');
      const aiList = document.getElementById('aiList');
      aiPanel.setAttribute('aria-hidden', 'false');
      aiList.innerHTML = `<div class="ai-item"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(resp.text)}</pre></div>`;
      settingsDebug.style.display = 'block';
      settingsDebug.textContent = 'Debug: ' + JSON.stringify(resp.debug || resp.raw || resp, null, 2);
    } else {
      settingsStatus.textContent = 'Test failed: ' + (resp.error || 'unknown error');
      const aiPanel = document.getElementById('aiPanel');
      const aiList = document.getElementById('aiList');
      aiPanel.setAttribute('aria-hidden', 'false');
      aiList.innerHTML = `<div class="ai-item">Test failed: ${escapeHtml(resp && resp.error ? resp.error : 'unknown error')}</div>`;
      settingsDebug.style.display = 'block';
      settingsDebug.textContent = 'Debug: ' + JSON.stringify(resp.debug || resp.raw || resp, null, 2);
    }
  });
});

// AI suggestions
const aiPanel = document.getElementById('aiPanel');
const aiList = document.getElementById('aiList');
document.getElementById('aiClose').addEventListener('click', () => aiPanel.setAttribute('aria-hidden', 'true'));

document.getElementById('btnAI').addEventListener('click', async () => {
  setStatus('Scanning page for issues...');
  aiList.innerHTML = 'Scanning…';
  aiPanel.setAttribute('aria-hidden', 'false');

  const res = await sendToActiveTab({ action: 'runAISuggestions' });
  if (!res || !res.suggestions) {
    aiList.innerHTML = '<div class="ai-item">No suggestions (page blocked or injection failed).</div>';
    setStatus('Scan failed', true);
    return;
  }

  const suggestions = res.suggestions || [];
  if (suggestions.length === 0) {
    aiList.innerHTML = '<div class="ai-item">No major issues found.</div>';
    setStatus('Scan complete');
    return;
  }

  const settings = await chrome.storage.local.get({
    breaklab_use_remote_ai: false,
    breaklab_gemini_endpoint: '',
    breaklab_gemini_apikey: ''
  });
  const useRemote = !!settings.breaklab_use_remote_ai && (settings.breaklab_gemini_endpoint || '').trim();

  if (useRemote) {
    const promptParts = ['Rewrite these heuristic bug suggestions into concise developer tickets (severity + one-line fix):\n'];
    suggestions.forEach((s, idx) => {
      promptParts.push(`${idx+1}. [${s.severity}] ${s.title}${s.selector ? ' — ' + s.selector : ''}\n   ${s.explanation}`);
    });
    const prompt = promptParts.join('\n');

    setStatus('Sending to remote AI...');
    chrome.runtime.sendMessage({ action: 'callGemini', payload: { prompt } }, (callRes) => {
      if (callRes && callRes.ok && callRes.text) {
        aiList.innerHTML = `<div class="ai-item"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(callRes.text)}</pre></div>`;
        setStatus('Remote AI returned results');
        return;
      } else {
        aiList.innerHTML = `<div class="ai-item">Remote AI error: ${escapeHtml(callRes && callRes.error ? callRes.error : 'No response')}</div>`;
        setStatus('Remote AI failed, showing local suggestions');
      }
    });
    return;
  }

  // local render
  aiList.innerHTML = '';
  suggestions.forEach(s => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-item';
    const sev = document.createElement('span'); sev.className = 'sev'; sev.textContent = s.severity.toUpperCase();
    const title = document.createElement('span'); title.textContent = ' ' + s.title;
    wrapper.appendChild(sev); wrapper.appendChild(title);
    if (s.selector) {
      const elem = document.createElement('span'); elem.className = 'elem'; elem.textContent = s.selector; wrapper.appendChild(elem);
    }
    const expl = document.createElement('div'); expl.style.marginTop = '6px'; expl.style.fontSize = '12px'; expl.style.color = 'var(--muted)';
    expl.textContent = s.explanation;
    wrapper.appendChild(expl);

    wrapper.style.cursor = 'pointer';
    wrapper.addEventListener('click', async () => {
      setStatus('Highlighting element...');
      await sendToActiveTab({ action: 'highlightElement', selector: s.selector });
      setStatus('Highlight sent');
    });

    aiList.appendChild(wrapper);
  });
  setStatus('Scan complete');
});

// run initial load to populate UI (in case popup remains open)
loadSettingsToUI();

// helper escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}


