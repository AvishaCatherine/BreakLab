// content.js - page-side logic for BreakLab overlays and heuristics
if (!window.BreakLab) {
  window.BreakLab = {
    state: { layout: false, contrast: false, perf: false, shadow: false, devInsight: false },
    overlays: [],
    rafId: null,
    _mutationCount: 0
  };
}

// Mutation observer to measure activity
if (!window.__breaklab_mutation_observer_installed) {
  try {
    const mo = new MutationObserver(muts => { window.BreakLab._mutationCount += muts.length; });
    mo.observe(document, { subtree: true, childList: true, attributes: false });
    window.__breaklab_mutation_observer_installed = true;
  } catch (e) {}
}

function clearOverlays() {
  try { window.BreakLab.overlays.forEach(o => o.remove()); } catch(e) {}
  window.BreakLab.overlays = [];
}

function makeBox() {
  const d = document.createElement('div');
  d.style.position = 'fixed';
  d.style.pointerEvents = 'none';
  d.style.zIndex = '2147483647';
  d.style.boxSizing = 'border-box';
  return d;
}

function getCandidates() {
  const all = Array.from(document.querySelectorAll('body *:not(script):not(style):not(link):not(meta)'));
  const w = window.innerWidth, h = window.innerHeight;
  const list = [];
  for (let i = 0; i < all.length && list.length < 600; i++) {
    const el = all[i];
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 6 || r.height <= 6) continue;
      if (r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) continue;
      list.push({ el, rect: r });
    } catch (e) { continue; }
  }
  return list;
}

// Color helpers
function parseColor(s) {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = s;
    const v = ctx.fillStyle;
    if (v.startsWith('#')) {
      const hex = v.slice(1);
      const bigint = parseInt(hex, 16);
      if (hex.length === 6) return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    } else if (v.startsWith('rgb')) {
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (m) return m[1].split(',').slice(0, 3).map(n => parseInt(n.trim()));
    }
  } catch (e) {}
  return [255,255,255];
}
function luminance(rgb) {
  const a = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrastRatio(a, b) {
  const L1 = luminance(a) + 0.05;
  const L2 = luminance(b) + 0.05;
  return L1 > L2 ? L1 / L2 : L2 / L1;
}
function getEffectiveBackground(el) {
  try {
    let e = el;
    while (e && e !== document.documentElement) {
      const bg = window.getComputedStyle(e).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      e = e.parentElement;
    }
    return window.getComputedStyle(document.documentElement).backgroundColor || 'rgb(255,255,255)';
  } catch (e) { return 'rgb(255,255,255)'; }
}

// Render loop
function renderFrame() {
  clearOverlays();
  const state = window.BreakLab.state;
  const candidates = getCandidates();

  if (state.layout) {
    candidates.forEach(c => {
      try {
        const box = makeBox();
        box.style.left = `${c.rect.left}px`;
        box.style.top = `${c.rect.top}px`;
        box.style.width = `${Math.max(2, c.rect.width)}px`;
        box.style.height = `${Math.max(2, c.rect.height)}px`;
        const cs = window.getComputedStyle(c.el);
        const d = cs.display || '';
        let stroke = '#00b37e';
        if (d.includes('grid')) stroke = '#8e3cff';
        else if (d.includes('flex')) stroke = '#00aaff';
        else stroke = '#ffb000';
        box.style.border = `2px solid ${stroke}`;
        box.style.background = 'transparent';
        window.BreakLab.overlays.push(box);
        document.documentElement.appendChild(box);
      } catch (e) {}
    });
  }

  if (state.contrast) {
    candidates.forEach(c => {
      try {
        const cs = window.getComputedStyle(c.el);
        const fg = parseColor(cs.color || 'rgb(0,0,0)');
        const bg = parseColor(cs.backgroundColor || getEffectiveBackground(c.el));
        const cr = contrastRatio(fg, bg);
        if (cr < 4.5 && c.el.innerText && c.el.innerText.trim().length > 0) {
          const box = makeBox();
          box.style.left = `${c.rect.left}px`;
          box.style.top = `${c.rect.top}px`;
          box.style.width = `${Math.max(2, c.rect.width)}px`;
          box.style.height = `${Math.max(2, c.rect.height)}px`;
          box.style.border = '2px solid rgba(220,80,80,0.95)';
          box.style.background = 'rgba(220,80,80,0.06)';
          const label = document.createElement('div');
          label.textContent = `contrast ${cr.toFixed(2)}`;
          label.style.position = 'absolute';
          label.style.left = '6px';
          label.style.top = '6px';
          label.style.padding = '2px 6px';
          label.style.background = 'rgba(0,0,0,0.7)';
          label.style.color = '#fff';
          label.style.fontSize = '11px';
          box.appendChild(label);
          window.BreakLab.overlays.push(box);
          document.documentElement.appendChild(box);
        }
      } catch (e) {}
    });
  }

  if (state.perf) {
    const viewportArea = window.innerWidth * window.innerHeight;
    candidates.forEach(c => {
      try {
        if (c.el === document.documentElement || c.el === document.body) return;
        const area = c.rect.width * c.rect.height;
        if (area > 12000 && area > viewportArea * 0.08) {
          const box = makeBox();
          box.style.left = `${c.rect.left}px`;
          box.style.top = `${c.rect.top}px`;
          box.style.width = `${c.rect.width}px`;
          box.style.height = `${c.rect.height}px`;
          box.style.background = 'transparent';
          box.style.border = '2px solid rgba(255,80,80,0.9)';
          box.style.boxShadow = 'inset 0 0 14px rgba(255,80,80,0.06)';
          window.BreakLab.overlays.push(box);
          document.documentElement.appendChild(box);
        }
      } catch (e) {}
    });
  }

  if (state.shadow) {
    try {
      const all = Array.from(document.querySelectorAll('*'));
      all.forEach(n => {
        try {
          if (n.shadowRoot) {
            const r = n.getBoundingClientRect();
            if (r.width <= 6 || r.height <= 6) return;
            const box = makeBox();
            box.style.left = `${r.left}px`;
            box.style.top = `${r.top}px`;
            box.style.width = `${r.width}px`;
            box.style.height = `${r.height}px`;
            box.style.border = '2px dashed rgba(0,170,255,0.95)';
            box.style.background = 'rgba(0,170,255,0.04)';
            window.BreakLab.overlays.push(box);
            document.documentElement.appendChild(box);

            const lbl = document.createElement('div');
            lbl.textContent = `${n.tagName.toLowerCase()} (shadowRoot open)`;
            lbl.style.position = 'absolute';
            lbl.style.left = '6px';
            lbl.style.top = '6px';
            lbl.style.padding = '2px 6px';
            lbl.style.fontSize = '11px';
            lbl.style.background = 'rgba(0,0,0,0.7)';
            lbl.style.color = '#fff';
            box.appendChild(lbl);
          }
        } catch (e) {}
      });
    } catch (e) {}

    try {
      const customEls = Array.from(document.querySelectorAll('*')).filter(n => n.tagName && n.tagName.includes('-'));
      customEls.forEach(n => {
        try {
          const r = n.getBoundingClientRect();
          if (r.width <= 6 || r.height <= 6) return;
          const already = window.BreakLab.overlays.some(o => {
            try {
              const ol = o.getBoundingClientRect ? o.getBoundingClientRect() : null;
              return ol && Math.abs(ol.left - r.left) < 2 && Math.abs(ol.top - r.top) < 2;
            } catch (e) { return false; }
          });
          if (already) return;
          const box = makeBox();
          box.style.left = `${r.left}px`;
          box.style.top = `${r.top}px`;
          box.style.width = `${r.width}px`;
          box.style.height = `${r.height}px`;
          box.style.border = '2px dotted rgba(255,170,80,0.9)';
          box.style.background = 'rgba(255,170,80,0.03)';
          window.BreakLab.overlays.push(box);
          document.documentElement.appendChild(box);

          const lbl = document.createElement('div');
          lbl.textContent = `${n.tagName.toLowerCase()} (custom element)`;
          lbl.style.position = 'absolute';
          lbl.style.left = '6px';
          lbl.style.top = '6px';
          lbl.style.padding = '2px 6px';
          lbl.style.fontSize = '11px';
          lbl.style.background = 'rgba(0,0,0,0.7)';
          lbl.style.color = '#fff';
          box.appendChild(lbl);
        } catch (e) {}
      });
    } catch (e) {}
  }

  if (state.devInsight) {
    if (!document.getElementById('__breaklab_dev_tooltip')) {
      const tip = document.createElement('div');
      tip.id = '__breaklab_dev_tooltip';
      tip.style.position = 'fixed';
      tip.style.zIndex = '2147483647';
      tip.style.pointerEvents = 'none';
      tip.style.padding = '6px 8px';
      tip.style.fontSize = '12px';
      tip.style.background = 'rgba(0,0,0,0.75)';
      tip.style.color = '#fff';
      tip.style.border = '1px solid rgba(255,255,255,0.06)';
      tip.style.borderRadius = '4px';
      document.documentElement.appendChild(tip);
    }
  } else {
    const t = document.getElementById('__breaklab_dev_tooltip');
    if (t) t.remove();
  }

  const anyActive = Object.values(window.BreakLab.state).some(Boolean);
  if (anyActive) {
    window.BreakLab.rafId = requestAnimationFrame(renderFrame);
  } else {
    if (window.BreakLab.rafId) cancelAnimationFrame(window.BreakLab.rafId);
    window.BreakLab.rafId = null;
    clearOverlays();
  }
}

// pointer tooltip
function handlePointer(e) {
  if (!window.BreakLab.state.devInsight) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const tip = document.getElementById('__breaklab_dev_tooltip');
  if (!tip) return;
  if (!el) { tip.style.display = 'none'; return; }
  const r = el.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.left = (Math.max(6, r.left + 8)) + 'px';
  tip.style.top = (Math.max(6, r.top - 36)) + 'px';
  const classes = el.className ? (typeof el.className === 'string' ? el.className : '') : '';
  tip.textContent = `${el.tagName.toLowerCase()} ${classes} ${Math.round(r.width)}×${Math.round(r.height)}`;
}

// Heuristics for AI suggestions
function simpleSelectorForElement(el) {
  try {
    if (!el) return null;
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/)[0];
      if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    }
    return el.tagName.toLowerCase();
  } catch (e) { return null; }
}

function findBrokenImages() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const bad = imgs.filter(img => {
    try { return img.naturalWidth === 0 || img.complete === false; } catch(e){ return false; }
  });
  return bad.map(img => ({ el: img, selector: simpleSelectorForElement(img), reason: 'Image failed to load or has zero natural size' }));
}

function findMissingAlts() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const missing = imgs.filter(img => !img.hasAttribute('alt') || img.getAttribute('alt').trim() === '');
  return missing.map(img => ({ el: img, selector: simpleSelectorForElement(img), reason: 'Missing alt attribute (accessibility)' }));
}

function findZeroSizeContent() {
  const els = Array.from(document.querySelectorAll('body *')).slice(0, 600);
  const result = [];
  for (const el of els) {
    try {
      const r = el.getBoundingClientRect();
      if ((r.width === 0 || r.height === 0) && el.innerText && el.innerText.trim().length) {
        result.push({ el, selector: simpleSelectorForElement(el), reason: 'Visible content has zero layout size' });
      }
    } catch (e) {}
  }
  return result;
}

function findLowContrastText(candidates) {
  const issues = [];
  for (const c of candidates) {
    try {
      const cs = window.getComputedStyle(c.el);
      const fg = parseColor(cs.color || 'rgb(0,0,0)');
      const bg = parseColor(cs.backgroundColor || getEffectiveBackground(c.el));
      const cr = contrastRatio(fg, bg);
      if (cr < 4.5 && c.el.innerText && c.el.innerText.trim().length > 0) {
        issues.push({ el: c.el, selector: simpleSelectorForElement(c.el), reason: `Low contrast (ratio ${cr.toFixed(2)})`, score: cr });
      }
    } catch (e) {}
  }
  return issues;
}

function findHugePaintAreas(candidates) {
  const viewportArea = window.innerWidth * window.innerHeight;
  const heavy = [];
  for (const c of candidates) {
    try {
      if (c.el === document.documentElement || c.el === document.body) continue;
      const area = c.rect.width * c.rect.height;
      if (area > Math.max(20000, viewportArea * 0.12)) {
        heavy.push({ el: c.el, selector: simpleSelectorForElement(c.el), reason: 'Large painted area (may cause slow paints)', area });
      }
    } catch (e) {}
  }
  return heavy;
}

function findManyInlineStyles() {
  const candidates = Array.from(document.querySelectorAll('[style]')).slice(0, 200);
  return candidates.map(el => ({ el, selector: simpleSelectorForElement(el), reason: 'Has inline style attribute (harder to maintain & override)' }));
}

function findPotentialClosedShadowHosts() {
  const potential = Array.from(document.querySelectorAll('*')).filter(n => n.tagName && n.tagName.includes('-')).slice(0, 200);
  return potential.map(n => ({ el: n, selector: simpleSelectorForElement(n), reason: 'Custom element (may use Shadow DOM; could be closed)' }));
}

function runAISuggestionsOnPage() {
  const suggestions = [];
  try {
    const candidates = getCandidates();

    const lowContrast = findLowContrastText(candidates).slice(0, 6);
    lowContrast.forEach(x => suggestions.push({
      severity: x.score && x.score < 2 ? 'high' : 'medium',
      title: 'Low contrast text',
      selector: x.selector,
      explanation: x.reason
    }));

    const brokenImgs = findBrokenImages().slice(0, 6);
    brokenImgs.forEach(x => suggestions.push({
      severity: 'high',
      title: 'Broken or zero-size image',
      selector: x.selector,
      explanation: x.reason
    }));

    const missingAlts = findMissingAlts().slice(0, 6);
    missingAlts.forEach(x => suggestions.push({
      severity: 'medium',
      title: 'Image missing alt',
      selector: x.selector,
      explanation: x.reason
    }));

    const zeroSize = findZeroSizeContent().slice(0, 6);
    zeroSize.forEach(x => suggestions.push({
      severity: 'medium',
      title: 'Zero-size content',
      selector: x.selector,
      explanation: x.reason
    }));

    const heavy = findHugePaintAreas(candidates).slice(0, 6);
    heavy.forEach(x => suggestions.push({
      severity: 'high',
      title: 'Large painted area',
      selector: x.selector,
      explanation: x.reason
    }));

    const inline = findManyInlineStyles().slice(0, 6);
    inline.forEach(x => suggestions.push({
      severity: 'low',
      title: 'Inline style attribute',
      selector: x.selector,
      explanation: x.reason
    }));

    const shadowHosts = findPotentialClosedShadowHosts().slice(0, 6);
    shadowHosts.forEach(x => suggestions.push({
      severity: 'low',
      title: 'Custom element (check Shadow DOM)',
      selector: x.selector,
      explanation: x.reason
    }));

    if ((window.BreakLab._mutationCount || 0) > 200) {
      suggestions.push({
        severity: 'medium',
        title: 'High DOM mutation activity',
        selector: null,
        explanation: 'This page has a lot of DOM mutations since load; watch for layout thrashing or repeated rerenders.'
      });
    }

    const seen = new Set();
    const dedup = [];
    suggestions.forEach(s => {
      const key = (s.selector || '') + '|' + s.title;
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(s);
      }
    });

    const order = { high: 0, medium: 1, low: 2 };
    dedup.sort((a, b) => (order[a.severity] - order[b.severity]));

    return dedup.slice(0, 20);
  } catch (e) {
    return [];
  }
}

// Highlight element on page briefly
function highlightElementOnPage(selector) {
  try {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = makeBox();
    o.style.left = `${r.left}px`;
    o.style.top = `${r.top}px`;
    o.style.width = `${r.width}px`;
    o.style.height = `${r.height}px`;
    o.style.border = '3px solid rgba(255,200,0,0.95)';
    o.style.background = 'rgba(255,200,0,0.06)';
    o.style.transition = 'opacity 0.6s ease';
    document.documentElement.appendChild(o);
    setTimeout(() => { o.style.opacity = '0'; }, 700);
    setTimeout(() => o.remove(), 1400);
  } catch (e) {}
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  const s = window.BreakLab.state;
  if (msg.action === 'toggleLayout') { s.layout = !s.layout; startOrStop(); sendResponse({ layout: s.layout }); }
  else if (msg.action === 'toggleContrast') { s.contrast = !s.contrast; startOrStop(); sendResponse({ contrast: s.contrast }); }
  else if (msg.action === 'togglePerf') { s.perf = !s.perf; startOrStop(); sendResponse({ perf: s.perf }); }
  else if (msg.action === 'toggleShadow') { s.shadow = !s.shadow; startOrStop(); sendResponse({ shadow: s.shadow }); }
  else if (msg.action === 'toggleDevInsight') { s.devInsight = !s.devInsight; startOrStop(); sendResponse({ devInsight: s.devInsight }); }
  else if (msg.action === 'revertAll') { Object.keys(s).forEach(k => s[k] = false); startOrStop(); sendResponse({ reverted: true }); }
  else if (msg.action === 'runAISuggestions') {
    try {
      const suggestions = runAISuggestionsOnPage();
      suggestions.slice(0,3).forEach(sg => {
        if (sg.selector) {
          try {
            const el = document.querySelector(sg.selector);
            if (el) {
              const r = el.getBoundingClientRect();
              const mark = makeBox();
              mark.style.left = `${r.left}px`;
              mark.style.top = `${r.top}px`;
              mark.style.width = `${r.width}px`;
              mark.style.height = `${r.height}px`;
              mark.style.border = sg.severity === 'high' ? '3px solid rgba(255,60,60,0.95)' : '2px dashed rgba(255,200,0,0.9)';
              mark.style.background = 'rgba(255,60,60,0.03)';
              document.documentElement.appendChild(mark);
              window.BreakLab.overlays.push(mark);
            }
          } catch (e) {}
        }
      });
      sendResponse({ suggestions });
    } catch (e) {
      sendResponse({ suggestions: [] });
    }
  } else if (msg.action === 'highlightElement') {
    try { highlightElementOnPage(msg.selector); } catch (e) {}
    sendResponse({ ok: true });
  }
  return true;
});

function startOrStop() {
  const any = Object.values(window.BreakLab.state).some(Boolean);
  if (any && !window.BreakLab.rafId) {
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('resize', renderFrame);
    window.addEventListener('scroll', renderFrame, { passive: true });
    window.BreakLab.rafId = requestAnimationFrame(renderFrame);
  } else if (!any) {
    window.removeEventListener('pointermove', handlePointer);
    window.removeEventListener('resize', renderFrame);
    window.removeEventListener('scroll', renderFrame);
    if (window.BreakLab.rafId) cancelAnimationFrame(window.BreakLab.rafId);
    window.BreakLab.rafId = null;
    clearOverlays();
  }
}

