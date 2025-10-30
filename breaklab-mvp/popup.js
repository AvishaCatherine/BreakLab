// popup.js - controller for BreakLab popup
const STATUS = document.getElementById('status');
function setStatus(msg, isError = false) {
  if (!STATUS) return;
  STATUS.textContent = msg;
  STATUS.style.color = isError ? '#ff8a8a' : '';
  if (!isError) setTimeout(() => { if (STATUS.textContent === msg) STATUS.textContent = 'Ready'; }, 3000);
}

// Messaging helper: send to active tab; inject content if not present
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

// UI elements
const settingsPanel = document.getElementById('settingsPanel');
const aiPanel = document.getElementById('aiPanel');
const aiList = document.getElementById('aiList');

// Button bindings
document.getElementById('btnLayout').addEventListener('click', async () => {
  setStatus('Toggling Layout View...');
  await sendToActiveTab({ action: 'toggleLayout' });
  setStatus('Layout toggled');
});

document.getElementById('btnContrast').addEventListener('click', async () => {
  setStatus('Toggling Contrast Check...');
  await sendToActiveTab({ action: 'toggleContrast' });
  setStatus('Contrast toggled');
});

document.getElementById('btnPerf').addEventListener('click', async () => {
  setStatus('Toggling Performance Heatmap...');
  await sendToActiveTab({ action: 'togglePerf' });
  setStatus('Perf toggled');
});

document.getElementById('btnShadow').addEventListener('click', async () => {
  setStatus('Toggling Shadow DOM view...');
  await sendToActiveTab({ action: 'toggleShadow' });
  setStatus('Shadow toggled');
});

document.getElementById('btnDev').addEventListener('click', async () => {
  setStatus('Toggling Dev Insight...');
  await sendToActiveTab({ action: 'toggleDevInsight' });
  setStatus('Dev Insight toggled');
});

document.getElementById('btnRevert').addEventListener('click', async () => {
  setStatus('Reverting overlays...');
  await sendToActiveTab({ action: 'revertAll' });
  setStatus('Reverted');
});

// Settings panel logic (load/populate)
document.getElementById('btnSettings').addEventListener('click', async () => {
  const hidden = settingsPanel.getAttribute('aria-hidden') === 'true';
  settingsPanel.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  if (!hidden) return;
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
});

// Save settings
document.getElementById('saveSettings').addEventListener('click', async () => {
  const safe = document.getElementById('safeMode').checked;
  const wl = document.getElementById('whitelist').value || '';
  const useRemoteAI = document.getElementById('useRemoteAI').checked;
  const endpoint = document.getElementById('geminiEndpoint').value || '';
  const apiKey = document.getElementById('geminiApiKey').value || '';
  await chrome.storage.local.set({
    breaklab_safe: safe,
    breaklab_whitelist: wl,
    breaklab_use_remote_ai: useRemoteAI,
    breaklab_gemini_endpoint: endpoint,
    breaklab_gemini_apikey: apiKey
  });
  settingsPanel.setAttribute('aria-hidden', 'true');
  setStatus('Settings saved');
});

// Close settings
document.getElementById('closeSettings').addEventListener('click', () => {
  settingsPanel.setAttribute('aria-hidden', 'true');
});

// AI panel close
document.getElementById('aiClose').addEventListener('click', () => {
  aiPanel.setAttribute('aria-hidden', 'true');
});

// AI Bug Suggestions flow
document.getElementById('btnAI').addEventListener('click', async () => {
  setStatus('Scanning page for issues...');
  aiList.innerHTML = 'Scanning…';
  aiPanel.setAttribute('aria-hidden', 'false');

  const res = await sendToActiveTab({ action: 'runAISuggestions' });
  if (!res || !res.suggestions) {
    aiList.innerHTML = '<div class="ai-item">No suggestions (page blocked or script injection failed).</div>';
    setStatus('Scan failed', true);
    return;
  }

  let suggestions = res.suggestions;
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

  const useRemote = !!settings.breaklab_use_remote_ai && settings.breaklab_gemini_endpoint && settings.breaklab_gemini_apikey;
  if (useRemote) {
    const promptParts = ['Rewrite these heuristic bug suggestions into concise developer tickets (severity + one-line fix):\n'];
    suggestions.forEach((s, idx) => {
      promptParts.push(`${idx + 1}. [${s.severity}] ${s.title}${s.selector ? ' — ' + s.selector : ''}\n   ${s.explanation}`);
    });
    const prompt = promptParts.join('\n');

    setStatus('Sending to remote AI...');
    const callRes = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'callGemini', payload: { prompt } }, (resp) => resolve(resp));
    });

    if (callRes && callRes.ok && callRes.text) {
      aiList.innerHTML = `<div class="ai-item"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(callRes.text)}</pre></div>`;
      setStatus('Remote AI returned results');
      return;
    } else {
      if (callRes && callRes.error) {
        aiList.innerHTML = `<div class="ai-item">Remote AI error: ${escapeHtml(callRes.error)}</div>`;
      } else {
        aiList.innerHTML = `<div class="ai-item">Remote AI returned no content. Showing local suggestions below.</div>`;
      }
      // fall back to local suggestions
    }
  }

  // render local suggestions
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

// Test Gemini button: sends a short test prompt to the configured endpoint
document.getElementById('testGemini').addEventListener('click', async () => {
  setStatus('Testing remote AI settings...');
  const settings = await chrome.storage.local.get({
    breaklab_use_remote_ai: false,
    breaklab_gemini_endpoint: '',
    breaklab_gemini_apikey: ''
  });

  if (!settings.breaklab_use_remote_ai) {
    setStatus('Remote AI is disabled in settings', true);
    return;
  }
  if (!settings.breaklab_gemini_endpoint || !settings.breaklab_gemini_apikey) {
    setStatus('Endpoint or API key missing', true);
    return;
  }

  const testPrompt = 'Reply with: OK - BreakLab test successful.';
  setStatus('Sending test prompt...');
  const callRes = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'callGemini', payload: { prompt: testPrompt } }, (resp) => resolve(resp));
  });

  if (callRes && callRes.ok && callRes.text) {
    setStatus('Test success');
    aiPanel.setAttribute('aria-hidden', 'false');
    aiList.innerHTML = `<div class="ai-item"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(callRes.text)}</pre></div>`;
  } else {
    setStatus('Test failed', true);
    aiPanel.setAttribute('aria-hidden', 'false');
    aiList.innerHTML = `<div class="ai-item">Test failed: ${escapeHtml(callRes && callRes.error ? callRes.error : 'unknown error')}</div>`;
  }
});

// utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

