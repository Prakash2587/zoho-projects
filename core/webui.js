/**
 * core/webui.js
 * The shared chat controller for BOTH shells (Catalyst web app + Sigma widget).
 * Owns all rendering + interaction; the shell supplies only DOM elements, an
 * `apply(plan, portalId)` function, and the portal id. This is the single place
 * the two surfaces share so they can never drift.
 *
 * Depends on: agent (logic), nlu (chat routing), ui (html strings),
 * planner.describeCalls (client-side dry-run), fixtures (sample fetch).
 */
import { createAgent } from './agent.js';
import { createNLU } from './nlu.js';
import { describeCalls } from './planner.js';
import { fetchSampleCapacity } from './fixtures.js';
import * as ui from './ui.js';

/**
 * @param {object} opts
 * @param {{chat:HTMLElement, controls:HTMLElement, chatInput?:HTMLInputElement,
 *          chatSend?:HTMLElement, mode?:HTMLElement}} opts.els
 * @param {(plan:object, portalId:any)=>Promise<object>} opts.apply
 * @param {any} [opts.portalId]
 */
export function createChatUI({ els, apply, portalId = null }) {
  const agent = createAgent();
  const nlu = createNLU();
  const { chat, controls } = els;

  // ---- primitives ----------------------------------------------------------
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
  function btn(label, onClick, { ready = true, primary = false, ghost = false } = {}) {
    const b = document.createElement('button');
    b.className = 'chip' + (primary ? ' primary' : '') + (ghost ? ' ghost' : '');
    b.textContent = ready ? label : `${label} · soon`;
    b.disabled = !ready;
    if (ready) b.addEventListener('click', onClick);
    return b;
  }

  // ---- flow ----------------------------------------------------------------
  function begin() {
    const t = agent.start();
    say(ui.escapeHtml(t.say));
    setControls(t.chips.map((c) => btn(c.chip, () => pickModule(c.id, c.chip), { ready: c.ready })));
  }

  function pickModule(id, label) {
    if (label) said(label);
    const t = agent.chooseModule(id);
    say(ui.escapeHtml(t.say));
    if (t.intents) setControls(t.intents.map((i) => btn(i.label, () => pickIntent(i.id, i.label))));
  }

  function pickIntent(id, label) {
    if (label) said(label);
    const t = agent.chooseIntent(id);
    say(ui.renderPractices(t.bestPractices));
    setControls([btn(t.next.label, showFormula, { primary: true })]);
  }

  function showFormula(prefill) {
    const t = agent.toFormula();
    say(ui.renderMetrics(t.metrics));
    renderInputForm(t.metrics, prefill);
  }

  function renderInputForm(metrics, prefill = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'form-grid';
    const fields = ui.uniqueInputs(metrics);
    // include a demand/allocated field so "measure" has something to score
    if (!fields.some((f) => f.key === 'allocatedHours')) {
      fields.push({ key: 'allocatedHours', label: 'Committed work (hrs)', hint: 'Hours of work you plan to deliver' });
    }
    fields.forEach((f) => {
      const lab = document.createElement('label');
      lab.className = 'field';
      lab.textContent = f.label;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.step = 'any'; inp.id = `in_${f.key}`;
      const pv = prefill[f.key];
      if (pv != null) inp.value = pv;
      else if (f.default != null) inp.value = f.default;
      inp.placeholder = f.hint || '';
      lab.appendChild(inp);
      wrap.appendChild(lab);
    });

    const calc = btn('Calculate', () => {
      const inputs = {};
      fields.forEach((f) => { const v = document.getElementById(`in_${f.key}`)?.value; if (v !== '' && v != null) inputs[f.key] = v; });
      said('Calculate');
      const r = agent.compute(inputs);
      say(ui.renderResults(r));
      setControls([btn(r.next.label, draftPlan, { primary: true })]);
    }, { primary: true });

    const fetchBtn = btn('Fetch from Zoho (sample)', async () => {
      fetchBtn.disabled = true; fetchBtn.textContent = 'Fetching…';
      const data = await fetchSampleCapacity();
      Object.entries(data.inputs).forEach(([k, v]) => { const el = document.getElementById(`in_${k}`); if (el) el.value = v; });
      fetchBtn.disabled = false; fetchBtn.textContent = 'Fetch from Zoho (sample)';
      say(`<span class="tagline">Loaded ${ui.escapeHtml(data.label)}. These are <b>sample</b> figures — ` +
        `real data fills in here once your Zoho Projects account is connected.</span>`);
    }, { ghost: true });

    setControls([wrap, calc, fetchBtn]);
  }

  function draftPlan() {
    const t = agent.toPlan({ window: 'Next sprint' });
    say(ui.escapeHtml(t.say));
    renderPlanEditor(structuredClone(t.plan));
  }

  // ---- editable plan (edit hours & names, add/remove tasks) -----------------
  function renderPlanEditor(model) {
    const box = document.createElement('div');
    box.className = 'msg bot editor';

    const projRow = document.createElement('div');
    projRow.className = 'ed-proj';
    projRow.innerHTML = `<label class="field">Project<input type="text" class="ed-project-name"></label>` +
      `<label class="field">Milestone<input type="text" class="ed-ms-name"></label>`;
    box.appendChild(projRow);
    projRow.querySelector('.ed-project-name').value = model.project.name;
    projRow.querySelector('.ed-ms-name').value = (model.milestones[0] && model.milestones[0].name) || '';

    const listsWrap = document.createElement('div');
    listsWrap.className = 'ed-lists';
    box.appendChild(listsWrap);

    function taskRow(task) {
      const row = document.createElement('div');
      row.className = 'ed-task';
      row.innerHTML =
        `<input type="text" class="t-name" aria-label="Task name">` +
        `<input type="number" step="any" min="0" class="t-hours" aria-label="Hours"><span class="unit">h</span>` +
        `<button class="rm" title="Remove task" aria-label="Remove task">×</button>`;
      row.querySelector('.t-name').value = task.name;
      row.querySelector('.t-hours').value = task.estimateHours;
      row.dataset.list = task.list;
      row.querySelector('.rm').addEventListener('click', () => row.remove());
      return row;
    }

    model.taskLists.forEach((list) => {
      const sec = document.createElement('div');
      sec.className = 'ed-listsec';
      sec.dataset.list = list.name;
      sec.innerHTML = `<div class="ed-listhead">${ui.escapeHtml(list.name)}</div>`;
      const rows = document.createElement('div');
      rows.className = 'ed-rows';
      model.tasks.filter((t) => t.list === list.name).forEach((t) => rows.appendChild(taskRow(t)));
      sec.appendChild(rows);
      const add = document.createElement('button');
      add.className = 'chip ghost sm';
      add.textContent = '+ Add task';
      add.addEventListener('click', () => rows.appendChild(taskRow({ name: 'New task', estimateHours: 0, list: list.name })));
      sec.appendChild(add);
      listsWrap.appendChild(sec);
    });

    chat.appendChild(box);
    chat.scrollTop = chat.scrollHeight;

    const readModel = () => ({
      module: model.module,
      project: {
        name: projRow.querySelector('.ed-project-name').value.trim() || 'Capacity Plan',
        description: model.project.description,
      },
      milestones: [{ name: projRow.querySelector('.ed-ms-name').value.trim() || 'Delivery window' }],
      taskLists: model.taskLists.map((l) => ({ name: l.name })),
      tasks: [...box.querySelectorAll('.ed-task')].map((row) => ({
        list: row.dataset.list,
        name: row.querySelector('.t-name').value.trim() || 'Task',
        estimateHours: Number(row.querySelector('.t-hours').value) || 0,
      })),
    });

    setControls([btn('Set it up in Zoho Projects', () => applyPlan(readModel()), { primary: true })]);
  }

  async function applyPlan(plan) {
    said('Set it up in Zoho Projects');
    const pending = say('Setting this up in Zoho Projects…');
    let data;
    try {
      data = await apply(plan, portalId);
    } catch {
      data = null;
    }
    if (!data || typeof data !== 'object') {
      data = {
        mode: 'dry-run',
        message: 'Backend not reached — client-side dry-run. Nothing was created.',
        wouldCall: describeCalls(plan, portalId || undefined),
      };
    }
    pending.innerHTML = ui.renderApply(data);
    setControls([btn('Start over', () => { chat.replaceChildren(); begin(); })]);
  }

  // ---- chat box ------------------------------------------------------------
  function handleChat(text) {
    const msg = text.trim();
    if (!msg) return;
    said(msg);
    const r = nlu.interpret(msg);
    say(ui.escapeHtml(r.reply));
    if (r.moduleId && r.moduleReady) {
      agent.chooseModule(r.moduleId);
      agent.chooseIntent(r.intentId || 'measure');
      // Jump straight to the formula, pre-filling any numbers we parsed.
      showFormula(r.numbers);
    } else if (r.moduleId && !r.moduleReady) {
      setControls([btn('Start Capacity Planning', () => pickModule('capacity-planning', 'Capacity Planning'), { primary: true })]);
    } else {
      const t = agent.start();
      setControls(t.chips.map((c) => btn(c.chip, () => pickModule(c.id, c.chip), { ready: c.ready })));
    }
  }

  if (els.chatInput && els.chatSend) {
    const send = () => { const v = els.chatInput.value; els.chatInput.value = ''; handleChat(v); };
    els.chatSend.addEventListener('click', send);
    els.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  return { begin };
}
