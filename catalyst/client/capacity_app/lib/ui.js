/* AUTO-GENERATED from /core by scripts/sync-core.mjs — edit the source, not this copy. */
/**
 * core/ui.js
 * Framework-free HTML string builders shared by both shells (Catalyst web app
 * and Sigma widget). No DOM access here — each shell inserts these strings.
 * Keeping them in core means the chat looks identical in both surfaces.
 */

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderPractices(bp) {
  const items = bp.practices
    .map((p) => `<div class="prac"><b>${escapeHtml(p.title)}</b><span>${escapeHtml(p.body)}</span></div>`)
    .join('');
  const feats = bp.zohoFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
  return `<h4>Best practices</h4><span>${escapeHtml(bp.definition)}</span>${items}` +
    `<div class="prac"><b>Where this lives in Zoho Projects</b><ul>${feats}</ul></div>`;
}

export function renderMetrics(metrics) {
  return `<h4>The formulas</h4>` + metrics.map((m) => {
    const bands = (m.bands || [])
      .map((b) => `<span class="${b.tone}">${escapeHtml(b.range)} ${escapeHtml(b.label)}</span>`)
      .join('');
    return `<div class="prac"><b>${escapeHtml(m.id)} · ${escapeHtml(m.name)}</b>` +
      `<span>${escapeHtml(m.question)}</span>` +
      `<div class="formula">${escapeHtml(m.formulaText)}</div>` +
      (bands ? `<div class="bands">${bands}</div>` : '') + `</div>`;
  }).join('') + `<span>Enter your numbers below and I'll score you.</span>`;
}

export function renderResults(r) {
  const v = r.results.verdict, c = r.results.available;
  return `<h4>Your current state</h4>` +
    `<div class="formula">Available capacity = ${c.value} h (gross ${c.gross} h − ${c.buffer} h buffer)\n` +
    `Utilization = ${v.utilization.value}% — ${v.utilization.label}</div>` +
    `<div class="result ${v.overCommitted ? 'over' : 'ok'}">${escapeHtml(r.say)}</div>`;
}

export function renderPlan(plan) {
  const rows = [
    `<div class="row head"><span>${escapeHtml(plan.project.name)}</span><span class="est">project</span></div>`,
    ...plan.milestones.map((m) => `<div class="row"><span>◇ ${escapeHtml(m.name)}</span><span class="est">milestone</span></div>`),
    ...plan.tasks.map((t) => `<div class="row"><span>• ${escapeHtml(t.name)} <em>(${escapeHtml(t.list)})</em></span><span class="est">${t.estimateHours} h</span></div>`),
  ].join('');
  return `<div class="plan">${rows}</div>`;
}

export function renderApply(data) {
  if (data.mode === 'dry-run') {
    const calls = (data.wouldCall || [])
      .map((c) => `<div class="row"><span>${escapeHtml(c.method)} ${escapeHtml(c.path)}</span></div>`).join('');
    return `<h4>Dry-run — nothing was created</h4><span>${escapeHtml(data.message)}</span>` +
      `<div class="plan">${calls}</div>`;
  }
  if (data.mode === 'live' && data.created) {
    const p = data.created.project || {};
    const url = p.link && p.link.web && p.link.web.url;
    const link = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open in Zoho Projects ↗</a>` : '';
    return `<h4>Created in Zoho Projects ✓</h4><span>Project “${escapeHtml(p.name || '')}”, ` +
      `${data.created.milestones.length} milestone(s), ${data.created.tasks.length} task(s).</span> ${link}`;
  }
  return `<span>${escapeHtml(JSON.stringify(data))}</span>`;
}

/** Collect the union of metric inputs (deduped by key), preserving order. */
export function uniqueInputs(metrics) {
  const seen = new Map();
  metrics.forEach((m) => (m.inputs || []).forEach((i) => { if (!seen.has(i.key)) seen.set(i.key, i); }));
  return [...seen.values()];
}
