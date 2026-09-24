'use strict';
/**
 * catalyst/functions/projects_api/index.js
 * Advanced I/O function. The only component that talks to Zoho Projects, so
 * OAuth credentials never reach the browser.
 *
 * Routes (POST, JSON body):
 *   /preview  -> validate & normalize a plan; no writes. Safe always.
 *   /apply    -> create the plan in Zoho Projects. If credentials are not yet
 *                configured, returns a DRY-RUN describing exactly what it would
 *                call, so the MVP is fully demoable before creds exist.
 *   /health   -> readiness + whether Zoho credentials are wired.
 *
 * node20 Advanced I/O: `req` is a raw http.IncomingMessage. Use sendJson().
 */
const { ZohoProjectsClient, credentialsConfigured } = require('./zoho-client');

module.exports = async (req, res) => {
  const url = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const route = url.substring(url.lastIndexOf('/'));

  // CORS for the Slate app / Sigma widget calling cross-origin.
  setCors(res);
  if ((req.method || '').toUpperCase() === 'OPTIONS') return end(res, 204, '');

  try {
    if (route === '/health') {
      return sendJson(res, 200, {
        ok: true,
        credentialsConfigured: credentialsConfigured(),
        mode: credentialsConfigured() ? 'live' : 'dry-run',
      });
    }

    const body = await readJson(req);

    if (route === '/preview') {
      const plan = validatePlan(body && body.plan);
      return sendJson(res, 200, { ok: true, mode: 'preview', plan, wouldCall: describeCalls(plan) });
    }

    if (route === '/apply') {
      const plan = validatePlan(body && body.plan);
      const portalId = body && body.portalId; // supplied by shell (Sigma auto, web app manual)

      if (!credentialsConfigured()) {
        // MVP path: no writes, but return the precise REST calls we'd make.
        return sendJson(res, 200, {
          ok: true,
          mode: 'dry-run',
          message:
            'Dry-run: Zoho credentials not configured. No changes were made. ' +
            'Add the OAuth connection to enable live creation.',
          wouldCall: describeCalls(plan, portalId),
          plan,
        });
      }

      const client = new ZohoProjectsClient({ portalId });
      const created = await client.applyPlan(plan);
      return sendJson(res, 200, { ok: true, mode: 'live', created });
    }

    return sendJson(res, 404, { ok: false, error: `Unknown route: ${route}` });
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { ok: false, error: err.message });
  }
};

// ---- plan validation -------------------------------------------------------
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw badRequest('Missing "plan" in request body');
  if (!plan.project || !plan.project.name) throw badRequest('plan.project.name is required');
  if (!Array.isArray(plan.tasks)) throw badRequest('plan.tasks must be an array');
  return {
    module: String(plan.module || 'capacity-planning'),
    project: { name: String(plan.project.name), description: String(plan.project.description || '') },
    milestones: (plan.milestones || []).map((m) => ({ name: String(m.name) })),
    taskLists: (plan.taskLists || []).map((t) => ({ name: String(t.name) })),
    tasks: plan.tasks.map((t) => ({
      list: String(t.list || 'General'),
      name: String(t.name),
      estimateHours: Number(t.estimateHours) || 0,
      note: String(t.note || ''),
      priority: t.priority ? String(t.priority) : undefined,
    })),
  };
}

/** Human-readable description of the REST v3 calls apply() would make. */
function describeCalls(plan, portalId = '{portalId}') {
  const base = `/restapi/portal/${portalId}`;
  const calls = [
    { method: 'POST', path: `${base}/projects/`, body: { name: plan.project.name } },
    ...plan.milestones.map((m) => ({ method: 'POST', path: `${base}/projects/{projectId}/milestones/`, body: { name: m.name } })),
    ...plan.taskLists.map((l) => ({ method: 'POST', path: `${base}/projects/{projectId}/tasklists/`, body: { name: l.name } })),
    ...plan.tasks.map((t) => ({
      method: 'POST',
      path: `${base}/projects/{projectId}/tasklists/{tasklistId}/tasks/`,
      body: { name: t.name, work: `${t.estimateHours}:00`, priority: t.priority || 'None' },
    })),
  ];
  return calls;
}

// ---- tiny http helpers -----------------------------------------------------
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function sendJson(res, status, obj) { return end(res, status, JSON.stringify(obj), 'application/json'); }
function end(res, status, payload, type) {
  res.statusCode = status;
  if (type) res.setHeader('Content-Type', type);
  res.end(payload);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) reject(badRequest('Body too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(badRequest('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
function badRequest(msg) { const e = new Error(msg); e.statusCode = 400; return e; }
