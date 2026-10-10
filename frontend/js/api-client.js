const API_BASE = window.BRANDSHIELD_API_BASE || '';
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = body && typeof body === 'object' ? body.detail : body;
    const message = Array.isArray(detail) ? detail.map(x => x.msg || 'Invalid input').join('; ') : (detail || `Request failed (${response.status})`);
    throw new Error(message);
  }
  return body;
}
export function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function toast(message, kind='') {
  const old = document.querySelector('.toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = message; document.body.appendChild(el); setTimeout(() => el.remove(), 3400);
}
export function riskPill(category='Low') { return `<span class="pill risk-${String(category).toLowerCase()}">${escapeHtml(category)} risk</span>`; }
