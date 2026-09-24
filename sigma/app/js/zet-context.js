/**
 * sigma/app/js/zet-context.js
 * Wraps the Zoho Extension (ZET) SDK so the widget knows which portal it's in
 * and can (later) create records through the connection declared in the
 * plugin-manifest.json — no separate OAuth screen for the user.
 *
 * Falls back gracefully when run outside Sigma (e.g. local preview): returns a
 * null portal and the widget stays in dry-run.
 */
export async function initZet() {
  const ZOHO = window.ZOHO;
  if (!ZOHO || !ZOHO.embeddedApp) {
    return { inSigma: false, portalId: null };
  }
  return new Promise((resolve) => {
    let ctx = { inSigma: true, portalId: null };
    ZOHO.embeddedApp.on('PageLoad', (data) => {
      // Zoho Projects passes portal / project context here.
      ctx.portalId = (data && (data.portalId || data.portal_id)) || null;
      ctx.projectId = (data && (data.projectId || data.project_id)) || null;
      resolve(ctx);
    });
    ZOHO.embeddedApp.init().catch(() => resolve({ inSigma: false, portalId: null }));
    // Safety timeout so the widget always renders.
    setTimeout(() => resolve(ctx), 2500);
  });
}

/**
 * Create records via the ZET connection (used when the widget applies a plan
 * inside Sigma without the standalone Catalyst function). Returns null if the
 * SDK request bridge isn't available, so the caller can fall back to the API.
 */
export async function zohoRequest(ctx, { method, url, params }) {
  const ZOHO = window.ZOHO;
  if (!ctx.inSigma || !ZOHO || !ZOHO.CONNECTOR) return null;
  return ZOHO.CONNECTOR.invokeAPI('zohoprojects.request', { method, url, parameters: params });
}
