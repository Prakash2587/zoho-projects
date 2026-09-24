'use strict';
/**
 * catalyst/functions/projects_api/zoho-client.js
 * Thin Zoho Projects REST API v3 client.
 *
 * Auth: uses a Catalyst Connection (OAuth) so the refresh/access token is
 * managed by Catalyst, not stored here. Until the connection is set up, the
 * function runs in dry-run mode and this client is never instantiated.
 *
 * Wire-up after the MVP (docs/SETUP.md has the full steps):
 *   1. Create a "Zoho Projects" connection in the Catalyst console with scopes
 *      ZohoProjects.projects.ALL, ZohoProjects.tasks.ALL, ZohoProjects.milestones.ALL,
 *      ZohoProjects.tasklists.ALL.
 *   2. Expose these to the function via catalyst-config.json env:
 *      ZOHO_PROJECTS_CONNECTOR (connection name) and ZOHO_ACCOUNTS_DOMAIN.
 *
 * The REST base differs by data center, e.g.:
 *   US  https://projectsapi.zoho.com/restapi
 *   EU  https://projectsapi.zoho.eu/restapi
 *   IN  https://projectsapi.zoho.in/restapi
 */

function credentialsConfigured() {
  return Boolean(process.env.ZOHO_PROJECTS_CONNECTOR && process.env.ZOHO_PROJECTS_API_BASE);
}

class ZohoProjectsClient {
  constructor({ portalId } = {}) {
    this.portalId = portalId || process.env.ZOHO_DEFAULT_PORTAL_ID;
    this.base = process.env.ZOHO_PROJECTS_API_BASE; // e.g. https://projectsapi.zoho.com/restapi
    if (!this.portalId) throw httpError(400, 'portalId is required (from Sigma context or the web app)');
    if (!credentialsConfigured()) throw httpError(503, 'Zoho Projects connection is not configured');
  }

  /**
   * Resolve an OAuth access token from the Catalyst Connection.
   * Uses the Catalyst Node SDK when available inside the function runtime.
   */
  async accessToken() {
    // Lazy-require so the module loads fine in dry-run / test contexts.
    const catalyst = require('zcatalyst-sdk-node');
    const app = catalyst.initialize(); // picks up the request context in AIO
    const connection = app.connection([process.env.ZOHO_PROJECTS_CONNECTOR]);
    const conn = connection.getConnector(process.env.ZOHO_PROJECTS_CONNECTOR);
    return conn.getAccessToken();
  }

  async request(method, path, body) {
    const token = await this.accessToken();
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body ? new URLSearchParams(body).toString() : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw httpError(res.status, `Zoho ${method} ${path} failed: ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  /** Create the whole plan and return the created ids + links. */
  async applyPlan(plan) {
    const p = `/portal/${this.portalId}`;
    const created = { project: null, milestones: [], taskLists: [], tasks: [] };

    const projRes = await this.request('POST', `${p}/projects/`, { name: plan.project.name });
    const project = (projRes.projects && projRes.projects[0]) || {};
    const projectId = project.id_string || project.id;
    created.project = { id: projectId, name: plan.project.name, link: project.link };

    for (const m of plan.milestones) {
      const r = await this.request('POST', `${p}/projects/${projectId}/milestones/`, { name: m.name, flag: 'internal' });
      created.milestones.push(pick(r.milestones));
    }

    const listIdByName = {};
    for (const l of plan.taskLists) {
      const r = await this.request('POST', `${p}/projects/${projectId}/tasklists/`, { name: l.name, flag: 'internal' });
      const tl = pick(r.tasklists);
      listIdByName[l.name] = tl && (tl.id_string || tl.id);
      created.taskLists.push(tl);
    }

    for (const t of plan.tasks) {
      const tasklistId = listIdByName[t.list];
      const r = await this.request('POST', `${p}/projects/${projectId}/tasklists/${tasklistId}/tasks/`, {
        name: t.name,
        work: `${Math.round(t.estimateHours)}:00`,
        priority: t.priority || 'None',
      });
      created.tasks.push(pick(r.tasks));
    }

    return created;
  }
}

function pick(arr) { return Array.isArray(arr) && arr.length ? arr[0] : null; }
function httpError(status, msg) { const e = new Error(msg); e.statusCode = status; return e; }

module.exports = { ZohoProjectsClient, credentialsConfigured };
