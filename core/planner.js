/**
 * core/planner.js
 * Turns a capacity verdict into a Zoho Projects structure: a project, one
 * milestone (the delivery window), task lists, and tasks carrying an owner
 * hint and an hours estimate.
 *
 * The output is a neutral "plan" object. The Catalyst function maps it to
 * Zoho Projects REST v3 payloads (see catalyst/functions/projects_api). Keeping
 * the plan API-agnostic means the same draft can preview in the UI and later
 * be applied for real without the agent knowing REST field names.
 */

export function buildPlan(mod, verdict, meta = {}) {
  const window = meta.window || 'Next sprint';
  const tmpl = mod.setupTemplate;

  const tasks = [];

  // 1) A task that books the committed work.
  tasks.push({
    list: tmpl.taskLists[0], // "Committed work"
    name: `Deliver committed work (${verdict.demand} h)`,
    estimateHours: verdict.demand,
    note: `Demand for ${window}. Utilization ${verdict.utilization.value}% (${verdict.utilization.label}).`,
  });

  // 2) An explicit buffer task, so the reserve is visible, not implied.
  if (verdict.buffer > 0) {
    tasks.push({
      list: tmpl.taskLists[1], // "Buffer & unplanned"
      name: `Reserve buffer (${verdict.buffer} h)`,
      estimateHours: verdict.buffer,
      note: 'Meetings, reviews, context-switching, and the unplanned.',
    });
  }

  // 3) If over-committed, add a remediation task naming the gap.
  if (verdict.overCommitted) {
    tasks.push({
      list: tmpl.taskLists[0],
      name: `Resolve ${verdict.gap} h over-allocation`,
      estimateHours: 0,
      note:
        'Over-committed for the window. Options: move tasks out, extend the ' +
        'milestone, or add a resource before work starts.',
      priority: 'High',
    });
  }

  return {
    module: mod.id,
    project: {
      name: tmpl.projectName.replace('{window}', window),
      description: `${tmpl.notePrefix} Available ${verdict.available} h · demand ${verdict.demand} h.`,
    },
    milestones: [{ name: tmpl.milestone.replace('{window}', window) }],
    taskLists: tmpl.taskLists.map((name) => ({ name })),
    tasks,
    summary: {
      available: verdict.available,
      demand: verdict.demand,
      gap: verdict.gap,
      overCommitted: verdict.overCommitted,
      utilization: verdict.utilization.value,
    },
  };
}

/**
 * Human-readable list of the Zoho Projects REST v3 calls a plan maps to.
 * Used by the shells for a client-side dry-run when the backend isn't reachable
 * (e.g. a standalone frontend demo). The Catalyst function keeps its own copy
 * of this (CommonJS) — keep the two in step if the REST shape changes.
 */
export function describeCalls(plan, portalId = '{portalId}') {
  const base = `/restapi/portal/${portalId}`;
  return [
    { method: 'POST', path: `${base}/projects/`, body: { name: plan.project.name } },
    ...plan.milestones.map((m) => ({ method: 'POST', path: `${base}/projects/{projectId}/milestones/`, body: { name: m.name } })),
    ...plan.taskLists.map((l) => ({ method: 'POST', path: `${base}/projects/{projectId}/tasklists/`, body: { name: l.name } })),
    ...plan.tasks.map((t) => ({
      method: 'POST',
      path: `${base}/projects/{projectId}/tasklists/{tasklistId}/tasks/`,
      body: { name: t.name, work: `${t.estimateHours}:00`, priority: t.priority || 'None' },
    })),
  ];
}
