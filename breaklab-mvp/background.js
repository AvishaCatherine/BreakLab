// background.js - handles remote Gemini/Vertex calls and test prompt
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'callGemini') {
    (async () => {
      try {
        const { breaklab_use_remote_ai, breaklab_gemini_endpoint, breaklab_gemini_apikey } = await getSettings();
        if (!breaklab_use_remote_ai) { sendResponse({ error: 'Remote AI not enabled' }); return; }
        if (!breaklab_gemini_endpoint || !breaklab_gemini_apikey) { sendResponse({ error: 'Missing endpoint or API key' }); return; }

        const body = msg.payload || {};
        const prompt = body.prompt || '';

        const ep = breaklab_gemini_endpoint.toLowerCase();
        let requestBody;
        let headers = { 'Content-Type': 'application/json' };
        headers['Authorization'] = `Bearer ${breaklab_gemini_apikey}`;

        if (ep.includes('aiplatform.googleapis.com') || ep.includes('vertex')) {
          requestBody = body.fullRequestBody || {
            instances: [{ content: prompt }],
            parameters: { temperature: 0.2, maxOutputTokens: 512 }
          };
        } else if (ep.includes('generativelanguage.googleapis.com') || ep.includes('generative.ai') || ep.includes('ai.google') || ep.includes('gemini')) {
          requestBody = body.fullRequestBody || { input: { text: prompt } };
        } else {
          requestBody = body.fullRequestBody || { input: { text: prompt } };
        }

        const resp = await fetch(breaklab_gemini_endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });

        if (!resp.ok) {
          const text = await resp.text().catch(()=>null);
          sendResponse({ error: `Remote API error: ${resp.status} ${resp.statusText}`, details: text });
          return;
        }

        const json = await resp.json().catch(() => null);
        const resultText = extractTextFromResponse(json);
        sendResponse({ ok: true, text: resultText, raw: json });
      } catch (err) {
        console.error('background.callGemini error', err);
        sendResponse({ error: String(err) });
      }
    })();
    return true;
  }
});

