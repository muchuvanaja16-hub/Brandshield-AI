import { api, escapeHtml } from './api-client.js';
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
function showError(message, success=false) { const box = document.querySelector('#form-message'); if (box) box.innerHTML = `<div class="notice ${success?'success':'error'}" style="margin:12px 0">${escapeHtml(message)}</div>`; }
if (loginForm) loginForm.addEventListener('submit', async e => {
  e.preventDefault(); const btn = loginForm.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Signing in…';
  try { const data = Object.fromEntries(new FormData(loginForm)); await api('/api/auth/login',{method:'POST',body:JSON.stringify(data)}); location.href='dashboard.html'; }
  catch(err) { showError(err.message); } finally { btn.disabled = false; btn.textContent = 'Sign in →'; }
});
if (registerForm) registerForm.addEventListener('submit', async e => {
  e.preventDefault(); const btn = registerForm.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Creating workspace…';
  try { const data = Object.fromEntries(new FormData(registerForm)); if (data.website && !/^https?:\/\//i.test(data.website)) throw new Error('Website must start with http:// or https://'); await api('/api/auth/register',{method:'POST',body:JSON.stringify(data)}); location.href='dashboard.html'; }
  catch(err) { showError(err.message); } finally { btn.disabled = false; btn.textContent = 'Create secure workspace →'; }
});
