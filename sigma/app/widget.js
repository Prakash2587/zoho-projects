/**
 * sigma/app/widget.js
 * Sigma widget shell: resolves the portal from ZET context, then hands off to
 * the shared controller. Same experience as the Catalyst web app.
 */
import { createChatUI } from './lib/webui.js';
import { initZet } from './js/zet-context.js';

const API = (window.CAPACITY_API || '').replace(/\/$/, ''); // deployed function URL
const modeEl = document.getElementById('mode');
const portalEl = document.getElementById('portal');

function makeApply(portalId) {
  return async (plan) => {
    if (!API) throw new Error('no backend url');
    const res = await fetch(`${API}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, portalId }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) throw new Error('backend unavailable');
    return res.json();
  };
}

(async () => {
  const ctx = await initZet();
  if (ctx.portalId && portalEl) portalEl.textContent = `portal ${ctx.portalId}`;
  if (modeEl) {
    modeEl.textContent = API ? 'ready' : 'dry-run';
    modeEl.className = 'mode-pill ' + (API ? 'live' : 'dry');
  }
  const chatUI = createChatUI({
    els: {
      chat: document.getElementById('chat'),
      controls: document.getElementById('controls'),
      chatInput: document.getElementById('chatInput'),
      chatSend: document.getElementById('chatSend'),
      mode: modeEl,
    },
    apply: makeApply(ctx.portalId),
    portalId: ctx.portalId,
  });
  chatUI.begin();
})();
