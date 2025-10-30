//
// utils.js — Final Corrected Version (Stable & Compatible)
// Shared utilities for Orli Exam Creator (ES module)
//

const TOAST_CONTAINER_ID = 'toastWrap';
const STATUS_AREA_ID = 'statusArea';

// ---------- DOM helpers ----------
function $id(id) { return document.getElementById(id); }
function qs(selector, scope = document) { return scope.querySelector(selector); }
function qsa(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }
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
    .replace(/'/g, '&#39;');
}

export function htmlToPlainText(html) {
  if (!html) return '';
  let t = String(html)
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n'); // ✅ fixed regex
  t = t.replace(/<[^>]+>/g, '');
  return t.replace(/\n\s*\n/g, '\n').replace(/\u00A0/g, ' ').trim();
}

// ---------- Math / KaTeX helpers ----------
export function convertPlainToLatexFragment(plain) {
  if (!plain && plain !== 0) return '';
  let s = String(plain);

  // Handle simple fraction patterns like (a/b) or a/b
  s = s.replace(/\(([^\)]+)\/([^\)]+)\)/g, (_, a, b) => `\\\\frac{${a}}{${b}}`);
  s = s.replace(/\b(\d+)\/(\d+)\b/g, (_, a, b) => `\\\\frac{${a}}{${b}}`);

  // Handle sqrt(...) → \sqrt{...}
  s = s.replace(/sqrt\(([^\)]+)\)/gi, (_, a) => `\\\\sqrt{${a}}`);

  // Handle powers like x^2 or (a+b)^3 → x^{2}, (a+b)^{3}
  s = s.replace(/([A-Za-z0-9\)\}])\^([A-Za-z0-9\{\(]+)/g, (_, a, b) => `${a}^{${b}}`);

  // Greek and constants
  s = s.replace(/\bpi\b/g, '\\\\pi');
  s = s.replace(/\be\b/g, '\\\\mathrm{e}');
  return s;
}

export function renderMixedText(plain) {
  try {
    const converted = convertPlainToLatexFragment(plain || '');
    const tokenPattern = /(\frac{[^}]+}{[^}]+}|\sqrt{[^}]+}|[a-zA-Z]+|[0-9]+(?:\.[0-9]+)?\/[0-9]+|[=+\-×÷≤≥<>^])/g;
    const parts = converted.split(tokenPattern).filter(Boolean);
    return parts.map(part => {
      if (/\\frac|\\sqrt|[a-zA-Z]+|[0-9]+\/[0-9]+|[=+\-×÷≤≥<>^]/.test(part)) {
        if (typeof katex !== 'undefined' && katex.renderToString) {
          try {
            return katex.renderToString(part, { throwOnError: false, displayMode: false });
          } catch {
            return escapeHtml(part);
          }
        } else {
          return `<code>${escapeHtml(part)}</code>`;
        }
      } else {
        return escapeHtml(part);
      }
    }).join('');
  } catch {
    return escapeHtml(String(plain || ''));
  }
}

// ---------- ID / misc helpers ----------
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000).toString(36)}`;
}

export function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); }
  catch { return Object.assign(Array.isArray(obj) ? [] : {}, obj); }
}

// ---------- Date formatting ----------
export function formatDateTime(isoOrTs) {
  let d;
  if (!isoOrTs) d = new Date();
  else if (typeof isoOrTs === 'number') d = new Date(isoOrTs);
  else if (isoOrTs instanceof Date) d = isoOrTs;
  else d = new Date(String(isoOrTs));
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---------- Toast ----------
function ensureToastWrap() {
  let wrap = $id(TOAST_CONTAINER_ID);
  if (!wrap) {
    wrap = createEl('div', { id: TOAST_CONTAINER_ID, style: 'position:fixed;right:18px;top:18px;z-index:99999;display:flex;flex-direction:column;gap:8px;' });
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function toast(message, type = 'info', ms = 3500) {
  const wrap = ensureToastWrap();
  const el = createEl('div', { style: 'min-width:260px;padding:10px;border-radius:8px;box-shadow:0 6px 18px rgba(2,6,23,.06);' });
  el.style.background = type === 'success' ? '#ecfdf5' : type === 'error' ? '#fff1f2' : '#f8fbff';
  el.innerHTML = `<div style="font-weight:700">${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info'}</div><div style="margin-top:6px">${escapeHtml(String(message))}</div>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .28s ease, transform .28s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(8px)';
    setTimeout(() => el.remove(), 300);
  }, ms);
  return el;
}

// ---------- Confirm Dialog ----------
let _confirmOverlay = null;
export function confirmDialog(message, opts = {}) {
  return new Promise(resolve => {
    const title = opts.title || 'Confirm';
    if (!_confirmOverlay) {
      _confirmOverlay = createEl('div', { style: 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.5);z-index:100000' });
      const box = createEl('div', { style: 'background:#fff;padding:16px;border-radius:8px;min-width:300px;max-width:92%;box-shadow:0 12px 40px rgba(2,6,23,.3)' });
      const hdr = createEl('div', {}, `<strong>${escapeHtml(title)}</strong>`);
      const body = createEl('div', { style: 'margin-top:8px' });
      const foot = createEl('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px' });
      const okBtn = createEl('button', { class: 'btn' }, 'OK');
      const cancelBtn = createEl('button', { class: 'btn ghost' }, 'Cancel');
      foot.append(cancelBtn, okBtn);
      box.append(hdr, body, foot);
      _confirmOverlay.appendChild(box);
      document.body.appendChild(_confirmOverlay);
      _confirmOverlay._body = body;
      _confirmOverlay._ok = okBtn;
      _confirmOverlay._cancel = cancelBtn;
    }
    _confirmOverlay._body.innerHTML = `<div class="small">${escapeHtml(String(message))}</div>`;
    _confirmOverlay.style.display = 'flex';
    const cleanup = res => {
      _confirmOverlay.style.display = 'none';
      _confirmOverlay._ok.onclick = null;
      _confirmOverlay._cancel.onclick = null;
      resolve(res);
    };
    _confirmOverlay._ok.onclick = () => cleanup(true);
    _confirmOverlay._cancel.onclick = () => cleanup(false);
  });
}

// ---------- confirmAction ----------
export async function confirmAction(message = "Are you sure?") {
  return new Promise(resolve => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
}

// ---------- Loader ----------
const loaders = new Map();
export function showLoader(key = 'global', message = 'Loading...') {
  const container = key === 'global' ? document.body : $id(key) || document.body;
  if (loaders.has(key)) return;
  const overlay = createEl('div', { style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.6);z-index:9998' });
  const box = createEl('div', { style: 'background:rgba(255,255,255,0.92);padding:12px;border-radius:8px;box-shadow:0 8px 20px rgba(2,6,23,.08);display:flex;gap:10px;align-items:center' });
  const spinner = createEl('div', { style: 'width:28px;height:28px;border-radius:50%;border:3px solid #e6eefc;border-top-color:#004AAD;animation:spin 1s linear infinite' });
  const txt = createEl('div', { style: 'font-weight:700;color:#004AAD' }, escapeHtml(message));
  box.append(spinner, txt);
  overlay.appendChild(box);
  if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
  if (container === document.body) overlay.style.position = 'fixed';
  container.appendChild(overlay);
  loaders.set(key, { overlay, container });
  if (!document.getElementById('utils-spinner-style')) {
    const style = createEl('style', { id: 'utils-spinner-style' }, `@keyframes spin{to{transform:rotate(360deg)}}`);
    document.head.appendChild(style);
  }
}

export function hideLoader(key = 'global') {
  const entry = loaders.get(key);
  if (!entry) return;
  entry.overlay.remove();
  loaders.delete(key);
}

// ---------- Status ----------
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
  el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

export function toggleVisibility(elOrSelector, show = true) {
  const el = typeof elOrSelector === 'string' ? qs(elOrSelector) : elOrSelector;
  if (!el) return;
  el.style.display = show ? '' : 'none';
}

// ---------- Safe JSON parse ----------
export function safeParse(json, fallback = null) {
  try { return JSON.parse(json); } catch { return fallback; }
}

// ---------- Export default ----------
export default {
  $id, qs, qsa, createEl,
  escapeHtml, htmlToPlainText,
  convertPlainToLatexFragment, renderMixedText,
  uid, deepClone,
  formatDateTime,
  toast, confirmDialog, confirmAction,
  showLoader, hideLoader,
  setStatus,
  debounce, throttle,
  enable, toggleVisibility,
  safeParse
};
