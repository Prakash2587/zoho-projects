/**
 * catalyst/client/capacity_app/app.js
 * Web-app shell. Owns rendering + network; the agent (in ./lib) owns logic.
 * HTML builders are shared with the Sigma widget via ./lib/ui.js.
 *
 * Backend URL: window.CAPACITY_API, else a relative /server path (Catalyst
 * serves functions under the same domain).
 */
import { createAgent } from './lib/agent.js';
import { describeCalls } from './lib/planner.js';
import * as ui from './lib/ui.js';

const API = (window.CAPACITY_API || '/server/projects_api').replace(/\/$/, '');
const agent = createAgent();
const chat = document.getElementById('chat');
const controls = document.getElementById('controls');
const modeEl = document.getElementById('mode');

function bubble(role, html) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = html;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
const say = (html) => bubble('bot', html);
const said = (text) => bubble('user', ui.escapeHtml(text));
function setControls(nodes) { controls.replaceChildren(); nodes.forEach((n) => controls.appendChild(n)); }
function chipBtn(label, onClick, { ready = true, primary = false } = {}) {
  const b = document.createElement('button');
  b.className = 'chip' + (primary ? ' primary' : '');
  b.textContent = ready ? label : `${label} · soon`;
  b.disabled = !ready;
  if (ready) b.addEventListener('click', onClick);
  return b;
}

function begin() {
  const t = agent.start();
  say(ui.escapeHtml(t.say));
  setControls(t.chips.map((c) => chipBtn(c.chip, () => pickModule(c), { ready: c.ready })));
}
function pickModule(chip) {
  said(chip.chip);
  const t = agent.chooseModule(chip.id);
  say(ui.escapeHtml(t.say));
  if (t.intents) setControls(t.intents.map((i) => chipBtn(i.label, () => pickIntent(i))));
}
function pickIntent(intent) {
  said(intent.label);
  const t = agent.chooseIntent(intent.id);
  say(ui.renderPractices(t.bestPractices));
  setControls([chipBtn(t.next.label, showFormula, { primary: true })]);
}
function showFormula() {
  const t = agent.toFormula();
  say(ui.renderMetrics(t.metrics));
  renderInputForm(t.metrics);
}
function renderInputForm(metrics) {
  const wrap = document.createElement('div');
  wrap.className = 'form-grid';
  const fields = ui.uniqueInputs(metrics);
  fields.forEach((f) => {
    const lab = document.createElement('label');
    lab.className = 'field';
    lab.textContent = f.label;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.id = `in_${f.key}`;
    if (f.default != null) inp.value = f.default;
    inp.placeholder = f.hint || '';
    lab.appendChild(inp);
    wrap.appendChild(lab);
  });
  const go = chipBtn('Calculate', () => {
    const inputs = {};
    fields.forEach((f) => { const v = document.getElementById(`in_${f.key}`).value; if (v !== '') inputs[f.key] = v; });
    said('Calculate');
    const r = agent.compute(inputs);
    say(ui.renderResults(r));
    setControls([chipBtn(r.next.label, draftPlan, { primary: true })]);
  }, { primary: true });
  setControls([wrap, go]);
}
function draftPlan() {
  const t = agent.toPlan({ window: 'Next sprint' });
  say(`${ui.escapeHtml(t.say)}${ui.renderPlan(t.plan)}`);
  setControls([chipBtn(t.next.label, applyPlan, { primary: true })]);
}
async function applyPlan() {
  const t = agent.toApply();
  said('Set it up in Zoho Projects');
  const pending = say('Setting this up in Zoho Projects…');
  try {
    const res = await fetch(`${API}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: t.apply, portalId: window.ZOHO_PORTAL_ID || null }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) throw new Error('backend unavailable');
    pending.innerHTML = ui.renderApply(await res.json());
  } catch {
    // No backend reachable — degrade to a client-side dry-run so the flow is
    // fully demoable standalone. Nothing is written either way.
    pending.innerHTML = ui.renderApply({
      mode: 'dry-run',
      message: 'Backend not reached — showing a client-side dry-run. Nothing was created. ' +
        'Deploy the Catalyst function (and set window.CAPACITY_API) to create for real.',
      wouldCall: describeCalls(t.apply, window.ZOHO_PORTAL_ID || undefined),
    });
  }
  setControls([chipBtn('Start over', () => { chat.replaceChildren(); begin(); })]);
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

detectMode();
begin();
