/**
 * catalyst/client/capacity_app/app.js
 * Web-app shell: wires DOM + backend, then hands off to the shared controller.
 */
import { createChatUI } from './lib/webui.js';

const API = (window.CAPACITY_API || '/server/projects_api').replace(/\/$/, '');
const modeEl = document.getElementById('mode');

async function apply(plan, portalId) {
  const res = await fetch(`${API}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, portalId }),
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) throw new Error('backend unavailable');
  return res.json();
}

async function detectMode() {
  try {
    const d = await (await fetch(`${API}/health`)).json();
    modeEl.textContent = d.mode === 'live' ? 'live' : 'dry-run';
    modeEl.className = 'mode-pill ' + (d.mode === 'live' ? 'live' : 'dry');
  } catch {
    modeEl.textContent = 'dry-run (offline)';
    modeEl.className = 'mode-pill dry';
  }
}

const chatUI = createChatUI({
  els: {
    chat: document.getElementById('chat'),
    controls: document.getElementById('controls'),
    chatInput: document.getElementById('chatInput'),
    chatSend: document.getElementById('chatSend'),
    mode: modeEl,
  },
  apply,
  portalId: window.ZOHO_PORTAL_ID || null,
});

detectMode();
chatUI.begin();
