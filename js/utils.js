// utils.js
// Common utilities for Orli Exam Creator (ES module).
// Usage: import { toast, escapeHtml, renderMixedText, uid, debounce, confirmDialog, showLoader, hideLoader, formatDateTime } from './utils.js';

const TOAST_CONTAINER_ID = 'toastWrap';
const STATUS_AREA_ID = 'statusArea';
const PREVIEW_MODAL_ID = 'previewModal';

// ---------- DOM helpers ----------
function $id(id) {
  return document.getElementById(id);
}
function qs(selector, scope = document) {
  return scope.querySelector(selector);
}
function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}
function createEl(tag = 'div', attrs = {}, html = '') {
  const el = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') el.className = attrs[k];
    else if (k === 'style') el.style.cssText = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (html) el.innerHTML = html;
  return el;
}

// ---------- Safety & string helpers ----------
export function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Convert simple editor HTML into plain text (preserve line breaks)
export function htmlToPlainText(html) {
  if (!html) return '';
  // replace <div>/<p>/<br> with newlines, then strip tags
  let t = String(html)
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  // collapse multiple newlines and trim
  return t.replace(/\n\s*\n/g, '\n').replace(/\u00A0/g, ' ').trim();
}

// ---------- math / KaTeX helpers ----------
// Convert common plain math-like patterns into LaTeX fragment
export function convertPlainToLatexFragment(plain) {
  if (!plain && plain !== 0) return '';
  let s = String(plain);
  // fractions: (a)/(b) or a/b
  s = s.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, (_, a, b) => `\\frac{${a}}{${b}}`);
  s = s.replace(/\b([0-9]+)\/([0-9]+)\b/g, (_, a, b) => `\\frac{${a}}{${b}}`);
  // sqrt(...)
  s = s.replace(/sqrt\(\s*([^)]+)\s*\)/gi, (_, a) => `\\sqrt{${a}}`);
  // exponent with ^ (naive)
  s = s.replace(/([A-Za-z0-9\)\}])\^([A-Za-z0-9\{]+)/g, (m, a, b) => `${a}^{${b}}`);
  // small greek shortcuts
  s = s.replace(/\bpi\b/g, '\\pi');
  s = s.replace(/\be\b/g, '\\mathrm{e}');
  return s;
}

// Render mixed text: plain text with math tokens -> HTML
// It will use KaTeX if available, otherwise returns escaped text with LaTeX visible.
// This function keeps the same rendering style as other modules expect.
export function renderMixedText(plain) {
  try {
    const converted = convertPlainToLatexFragment(plain || '');
    // token pattern to capture latex fragments and simple math tokens
    const tokenPattern = /(\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\}|\\[a-zA-Z]+|[0-9]+(?:\.[0-9]+)?[\/][0-9]+|[=+\-×÷≤≥<>^])/g;
    const parts = converted.split(tokenPattern).filter(Boolean);
    return parts
      .map(part => {
        // heuristics to decide if this part is math-like
        if (/\\frac|\\sqrt|\\[a-zA-Z]+|[0-9]+\/[0-9]+|[=+\-×÷≤≥<>^]/.test(part)) {
          if (typeof katex !== 'undefined' && katex && katex.renderToString) {
            try {
              return katex.renderToString(part, { throwOnError: false, displayMode: false });
            } catch (err) {
              return escapeHtml(part);
            }
          } else {
            // KaTeX not available — show as escaped LaTeX in monospace for debugging
            return `<code>${escapeHtml(part)}</code>`;
          }
        } else {
          return escapeHtml(part);
        }
      })
      .join('');
  } catch (err) {
    // fallback: escape everything
    return escapeHtml(String(plain || ''));
  }
}

// ---------- ID / misc helpers ----------
export function uid(prefix = 'id') {
  // short unique id
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000).toString(36)}`;
}

export function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    // fallback shallow clone
    return Object.assign(Array.isArray(obj) ? [] : {}, obj);
  }
}

// ---------- Date formatting ----------
export function formatDateTime(isoOrTs) {
  // Accept ISO string or timestamp or Date
  let d;
  if (!isoOrTs) d = new Date();
  else if (typeof isoOrTs === 'number') d = new Date(isoOrTs);
  else if (isoOrTs instanceof Date) d = isoOrTs;
  else d = new Date(String(isoOrTs));
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}

// ---------- Toast system ----------
function ensureToastWrap() {
  let wrap = $id(TOAST_CONTAINER_ID);
  if (!wrap) {
    wrap = createEl('div', { id: TOAST_CONTAINER_ID, style: 'position:fixed;right:18px;top:18px;z-index:99999;display:flex;flex-direction:column;gap:8px;' });
    document.body.appendChild(wrap);
  }
  return wrap;
}

/**
 * toast(message, type='info'|'success'|'error', ms=3500)
 */
export function toast(message, type = 'info', ms = 3500) {
  const wrap = ensureToastWrap();
  const el = createEl('div', { style: 'min-width:260px;padding:10px;border-radius:8px;box-shadow:0 6px 18px rgba(2,6,23,.06);' });
  if (type === 'success') el.style.background = '#ecfdf5'; // light green
  else if (type === 'error') el.style.background = '#fff1f2'; // light red
  else el.style.background = '#f8fbff';
  el.innerHTML = `<div style="font-weight:700">${type === 'error' ? 'Error' : (type === 'success' ? 'Success' : 'Info')}</div><div style="margin-top:6px">${escapeHtml(String(message))}</div>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .28s ease, transform .28s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(8px)';
    setTimeout(() => el.remove(), 300);
  }, ms);
  return el;
}

// ---------- Simple confirm dialog (promise) ----------
let _confirmOverlay = null;
export function confirmDialog(message, opts = {}) {
  return new Promise(resolve => {
    const title = opts.title || 'Confirm';
    // create overlay if not present
    if (!_confirmOverlay) {
      _confirmOverlay = createEl('div', { style: 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.5);z-index:100000' });
      const box = createEl('div', { style: 'background:#fff;padding:16px;border-radius:8px;min-width:300px;max-width:92%;box-shadow:0 12px 40px rgba(2,6,23,.3)' });
      _confirmOverlay.appendChild(box);
      const hdr = createEl('div', {}, `<strong>${escapeHtml(title)}</strong>`);
      const body = createEl('div', { style: 'margin-top:8px' });
      const foot = createEl('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px' });
      const okBtn = createEl('button', { class: 'btn' }, 'OK');
      const cancelBtn = createEl('button', { class: 'btn ghost' }, 'Cancel');
      foot.appendChild(cancelBtn);
      foot.appendChild(okBtn);
      box.appendChild(hdr);
      box.appendChild(body);
      box.appendChild(foot);
      document.body.appendChild(_confirmOverlay);

      // attach once; body/btns will be updated per call
      _confirmOverlay._body = body;
      _confirmOverlay._ok = okBtn;
      _confirmOverlay._cancel = cancelBtn;
    }
    _confirmOverlay._body.innerHTML = `<div class="small">${escapeHtml(String(message))}</div>`;
    _confirmOverlay.style.display = 'flex';
    const cleanup = result => {
      _confirmOverlay.style.display = 'none';
      _confirmOverlay._ok.onclick = null;
      _confirmOverlay._cancel.onclick = null;
      resolve(result);
    };
    _confirmOverlay._ok.onclick = () => cleanup(true);
    _confirmOverlay._cancel.onclick = () => cleanup(false);
  });
}

// ---------- Loading overlay for specific containers (or global) ----------
const loaders = new Map();
export function showLoader(key = 'global', message = 'Loading...') {
  // key can be 'global' or an element id
  let container;
  if (key === 'global') container = document.body;
  else container = $id(key) || document.body;
  // avoid duplicates
  if (loaders.has(key)) return;
  const overlay = createEl('div', { style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.6);z-index:9998' });
  const box = createEl('div', { style: 'background:rgba(255,255,255,0.92);padding:12px;border-radius:8px;box-shadow:0 8px 20px rgba(2,6,23,.08);display:flex;gap:10px;align-items:center' });
  const spinner = createEl('div', { style: 'width:28px;height:28px;border-radius:50%;border:3px solid #e6eefc;border-top-color:#004AAD;animation:spin 1s linear infinite' });
  const txt = createEl('div', { style: 'font-weight:700;color:#004AAD' }, escapeHtml(message));
  box.appendChild(spinner);
  box.appendChild(txt);
  overlay.appendChild(box);

  // position relative container if needed
  const prevPos = window.getComputedStyle(container).position;
  if (prevPos === 'static' || !prevPos) container._prevPos = prevPos || '';
  if (container !== document.body) {
    container.style.position = container.style.position || 'relative';
  } else {
    overlay.style.position = 'fixed';
  }
  container.appendChild(overlay);
  loaders.set(key, { overlay, container });
  // spinner keyframes
  if (!document.getElementById('utils-spinner-style')) {
    const style = createEl('style', { id: 'utils-spinner-style' }, `@keyframes spin{to{transform:rotate(360deg)}}`);
    document.head.appendChild(style);
  }
}
export function hideLoader(key = 'global') {
  const entry = loaders.get(key);
  if (!entry) return;
  try {
    entry.overlay.remove();
    if (entry.container._prevPos !== undefined && entry.container !== document.body) {
      entry.container.style.position = entry.container._prevPos || '';
      delete entry.container._prevPos;
    }
  } catch (e) { /* ignore */ }
  loaders.delete(key);
}

// ---------- Status area helper ----------
export function setStatus(text = '', timeoutMs = 4000) {
  const s = $id(STATUS_AREA_ID);
  if (!s) return;
  s.textContent = String(text || '');
  if (timeoutMs) {
    clearTimeout(s._t);
    s._t = setTimeout(() => { if (s) s.textContent = 'Ready'; }, timeoutMs);
  }
}

// ---------- Debounce / Throttle ----------
export function debounce(fn, wait = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
export function throttle(fn, limit = 250) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ---------- Small UI helpers ----------
export function enable(elOrSelector, enabled = true) {
  const el = typeof elOrSelector === 'string' ? qs(elOrSelector) : elOrSelector;
  if (!el) return;
  el.disabled = !enabled;
  if (!enabled) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
}
export function toggleVisibility(elOrSelector, show = true) {
  const el = typeof elOrSelector === 'string' ? qs(elOrSelector) : elOrSelector;
  if (!el) return;
  el.style.display = show ? '' : 'none';
}

// ---------- Safe JSON parse ----------
export function safeParse(json, fallback = null) {
  try { return JSON.parse(json); } catch (e) { return fallback; }
}

// ---------- Export default group (for convenience) ----------
export default {
  $id, qs, qsa, createEl,
  escapeHtml, htmlToPlainText,
  convertPlainToLatexFragment, renderMixedText,
  uid, deepClone,
  formatDateTime,
  toast, confirmDialog,
  showLoader, hideLoader,
  setStatus,
  debounce, throttle,
  enable, toggleVisibility,
  safeParse
};
