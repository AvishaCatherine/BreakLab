// background.js - robust Gemini caller with multiple auth attempts and verbose debug
chrome.runtime.onInstalled.addListener(() => {
  console.log('BreakLab background started');
});

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get({
      breaklab_use_remote_ai: false,
      breaklab_gemini_endpoint: '',
      breaklab_gemini_apikey: ''
    }, (res) => resolve(res));
  });
}

function extractTextFromResponse(json) {
  if (!json) return '';
  if (json.candidates && Array.isArray(json.candidates)) {
    return json.candidates.map(c => (c.content || c.output || c.text || '')).join('\n\n');
  }
  if (json.generated_text) return json.generated_text;
  if (json.output && typeof json.output === 'string') return json.output;
  if (json.choices && Array.isArray(json.choices)) {
    return json.choices.map(c => (c.text || (c.message && c.message.content) || '')).join('\n\n');
  }
  if (json.generations && Array.isArray(json.generations)) {
    return json.generations.map(g => g.text || '').join('\n\n');
  }
  if (json.outputText) return json.outputText;
  try { return JSON.stringify(json, null, 2); } catch (e) { return String(json); }
}

async function tryFetch(url, init) {
  try {
    const resp = await fetch(url, init);
    const rawText = await resp.text().catch(()=>null);
    let json = null;
    try { json = rawText ? JSON.parse(rawText) : null; } catch(e) { json = null; }
    const text = extractTextFromResponse(json) || rawText || '';
    return { ok: resp.ok, status: resp.status, statusText: resp.statusText, text, json, rawText };
  } catch (err) {
    return { ok: false, status: 0, statusText: String(err), text: '', json: null, rawText: String(err) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'callGemini') {
    (async () => {
      try {
        const { breaklab_use_remote_ai, breaklab_gemini_endpoint, breaklab_gemini_apikey } = await getSettings();
        if (!breaklab_use_remote_ai) { sendResponse({ error: 'Remote AI not enabled' }); return; }
        if (!breaklab_gemini_endpoint) { sendResponse({ error: 'Missing endpoint' }); return; }

        const payload = msg.payload || {};
        const prompt = payload.prompt || '';

        const vertexBody = payload.fullRequestBody || { instances: [{ content: prompt }], parameters: { temperature: 0.2, maxOutputTokens: 512 } };
        const generativeBody = payload.fullRequestBody || { input: { text: prompt } };

        const attempts = [];

        // attempt 1: Authorization: Bearer <key> (if key present)
        if (breaklab_gemini_apikey) {
          const headers = { 'Content-Type': 'application/json', 'Authorization': breaklab_gemini_apikey.startsWith('Bearer ') ? breaklab_gemini_apikey : `Bearer ${breaklab_gemini_apikey}` };
          const body = (breaklab_gemini_endpoint.includes('aiplatform.googleapis.com') || breaklab_gemini_endpoint.includes('vertex')) ? vertexBody : generativeBody;
          attempts.push({ label: 'Authorization: Bearer', url: breaklab_gemini_endpoint, init: { method: 'POST', headers, body: JSON.stringify(body) } });
        }

        // attempt 2: endpoint with ?key= (if api key present)
        if (breaklab_gemini_apikey) {
          const sep = breaklab_gemini_endpoint.includes('?') ? '&' : '?';
          const urlWithKey = `${breaklab_gemini_endpoint}${sep}key=${encodeURIComponent(breaklab_gemini_apikey)}`;
          const headers = { 'Content-Type': 'application/json' };
          const body = (breaklab_gemini_endpoint.includes('aiplatform.googleapis.com') || breaklab_gemini_endpoint.includes('vertex')) ? vertexBody : generativeBody;
          attempts.push({ label: 'QueryParam ?key=', url: urlWithKey, init: { method: 'POST', headers, body: JSON.stringify(body) } });
        }

        // attempt 3: x-goog-api-key header (if key present)
        if (breaklab_gemini_apikey) {
          const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': breaklab_gemini_apikey };
          const body = (breaklab_gemini_endpoint.includes('aiplatform.googleapis.com') || breaklab_gemini_endpoint.includes('vertex')) ? vertexBody : generativeBody;
          attempts.push({ label: 'Header x-goog-api-key', url: breaklab_gemini_endpoint, init: { method: 'POST', headers, body: JSON.stringify(body) } });
        }

        // attempt 4: try without auth if endpoint includes a key already (endpoint contains ?key=)
        if (breaklab_gemini_endpoint.includes('?key=')) {
          const headers = { 'Content-Type': 'application/json' };
          const body = (breaklab_gemini_endpoint.includes('aiplatform.googleapis.com') || breaklab_gemini_endpoint.includes('vertex')) ? vertexBody : generativeBody;
          attempts.push({ label: 'Endpoint with ?key present', url: breaklab_gemini_endpoint, init: { method: 'POST', headers, body: JSON.stringify(body) } });
        }

        if (attempts.length === 0) {
          sendResponse({ error: 'No auth attempts possible (no API key found and endpoint has no ?key= param)' });
          return;
        }

        const results = [];
        for (const at of attempts) {
          const res = await tryFetch(at.url, at.init);
          results.push({ attempt: at.label, url: at.url, status: res.status, statusText: res.statusText, ok: res.ok, text: res.text, raw: res.rawText });
          if (res.ok && res.text) {
            sendResponse({ ok: true, text: res.text, debug: results });
            return;
          }
        }

        sendResponse({ ok: false, error: 'All auth attempts failed', debug: results });
      } catch (err) {
        console.error('background.callGemini error', err);
        sendResponse({ error: String(err) });
      }
    })();
    return true;
  }
});



