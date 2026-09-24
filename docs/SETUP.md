# Setup & Deploy

GitHub is the source of truth. You never maintain folders on your desktop and
you never run the CLI locally for day-to-day work — deploys happen from this
repo. This guide has three parts: **run it now (dry-run)**, **deploy to
Catalyst**, and **package for Sigma**. Part 4 wires real Zoho Projects writes
*after* the MVP is signed off.

---

## 0. What works with zero setup

The whole flow (steps 1–4) runs with no credentials. Step 5 ("Set it up in
Zoho Projects") returns a **dry-run** that shows the exact REST calls it would
make — nothing is written. That's the demoable MVP.

To try the engine locally: `npm test` (runs the core smoke tests, no deps).

---

## 1. Create the Catalyst project (one time, in the console)

The CLI/agent must never invent a project. Create it once:

1. Go to the Catalyst console, create a project (e.g. `capacity-agent`).
2. Note your **Org ID**, **Project ID**, and **data center** (the console URL:
   `catalyst.zoho.com` → `us`, `.eu` → `eu`, `.in` → `in`, …).

---

## 2. Deploy the frontend (Slate) — native Git, no CI

Slate deploys straight from GitHub:

1. Console → your project → **Slate** → **Create app** → connect this GitHub
   repo, branch `main`.
2. Set the app source directory to `catalyst/client/capacity_app`.
3. Framework: **static**. Build command: `npm run build` (runs `sync-core`).
4. Save. Every push to `main` now auto-builds and deploys, with per-branch
   preview URLs.

Point the frontend at your function by setting, in the deployed page, either a
`window.CAPACITY_API` value or leaving the default `/server/projects_api`
(works when the function is in the same Catalyst project/domain).

---

## 3. Deploy the function — GitHub Actions (CLI runs in CI)

1. Locally, once, generate a CI token:
   ```bash
   npm install -g zcatalyst-cli
   catalyst login --dc <dc>
   catalyst token:generate
   ```
2. In GitHub → repo **Settings → Secrets and variables → Actions**, add:
   - Secret `CATALYST_TOKEN` — the token from step 1
   - Secret `CATALYST_ORG_ID` — your Org ID
   - Secret `CATALYST_PROJECT_ID` — your Project ID
   - Variable `CATALYST_DC` — `us` | `eu` | `in` | `au` | `ca` | `sa` | `jp` | `uae`
3. Push to `main` (or run the **Deploy to Catalyst** workflow manually). It
   syncs core, installs deps, and runs `catalyst deploy --only functions`.

---

## 4. Package & publish the Sigma widget

Sigma has **no git-native deploy** — Zoho requires a ZIP upload. CI does the
packing for you:

1. Run the **Package Sigma widget** workflow (auto on push to `main`, or manual).
2. Download the `capacity-planning-sigma-widget` artifact (a `.zip`) from the run.
3. In the Zoho Sigma / Marketplace developer console, **upload** that ZIP,
   then install the extension into your Zoho Projects portal.
4. Set the widget's backend URL (`window.CAPACITY_API`) to your deployed
   Catalyst function URL.

Locally you can also `cd sigma && npm i -g zoho-extension-toolkit && zet validate && zet pack`.

---

## 5. Go live with Zoho Projects writes (AFTER the MVP)

Until this is done, `/apply` stays a dry-run — by design.

1. **OAuth connection (Catalyst Connections):** console → your project →
   **Authentication → Connections** → new connection to Zoho Projects with
   scopes: `ZohoProjects.projects.ALL`, `ZohoProjects.milestones.ALL`,
   `ZohoProjects.tasklists.ALL`, `ZohoProjects.tasks.ALL`.
2. **Function env** (`catalyst/functions/projects_api/catalyst-config.json`):
   - `ZOHO_PROJECTS_API_BASE` — e.g. `https://projectsapi.zoho.com/restapi`
   - `ZOHO_PROJECTS_CONNECTOR` — the connection's link name
   - `ZOHO_DEFAULT_PORTAL_ID` — your Zoho Projects portal ID (the web app can
     override per request; the Sigma widget supplies it from context)
   > Env vars must live in `catalyst-config.json` — `catalyst deploy` wipes
   > Console-set vars on every deploy.
3. Redeploy the function. `/health` now reports `mode: "live"`, and `/apply`
   creates the project, milestone, task lists and tasks, returning live links.

---

## Working on the code

- Edit shared logic in **`/core`** only. Then `npm run sync` to refresh the
  `lib/` copies inside each shell (CI enforces they're in sync).
- `npm test` runs the core checks.
