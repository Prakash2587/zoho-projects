# Zoho Projects — Capacity Planning Agent

A knowledge-base AI agent for Zoho Projects users. It takes a project manager
from a plain question, to the relevant **best practices**, to a **definitive
formula** they can measure themselves against, and finally **sets the plan up
inside Zoho Projects**.

This repo is the **Capacity Planning MVP** — the first of a planned set
(Resource Allocation, Budget Optimization, …), all following the same flow.

## The flow

```
Ask → Best practices → Formula & metric → Draft plan → Set it up in Zoho Projects
```

The MVP ships two metrics: **M1 Resource Utilization %** and **M2 Available
Capacity**. Step 5 runs as a safe **dry-run** (shows the exact REST calls,
writes nothing) until Zoho OAuth credentials are configured — see
[`docs/SETUP.md`](docs/SETUP.md).

## Architecture — one core, two shells, one backend

```
core/        Shared, framework-free engine (KB + formulas + agent + planner + ui)
catalyst/    Catalyst target → Slate static frontend + Advanced I/O function
sigma/       Zoho Sigma target → widget that installs inside Zoho Projects
skills/      Each capability as a Claude skill (SKILL.md + references)
scripts/     sync-core (single source of truth) + smoke tests
.github/     CI (tests) + deploy-catalyst + package-sigma workflows
docs/        Setup & deploy guide
```

`core/` is the single source of truth. `scripts/sync-core.mjs` copies it into
each shell's `lib/` so both are self-contained and deploy-ready with **no
bundler**. CI verifies the copies never drift.

| Layer | Where | Notes |
|---|---|---|
| Knowledge base | `core/kb/capacity-planning.js` | Best practices + metrics, in Zoho vocabulary |
| Formulas | `core/formulas.js` | Pure functions: `utilization`, `availableCapacity` |
| Conversation | `core/agent.js` | The 5-step state machine |
| Plan builder | `core/planner.js` | Verdict → Zoho Projects structure |
| Web app | `catalyst/client/capacity_app` | Slate static chat UI |
| Backend | `catalyst/functions/projects_api` | REST v3 bridge; holds OAuth; `/health` `/preview` `/apply` |
| Widget | `sigma/app` | Same flow, portal from ZET context |

## Deploy

GitHub is the source of truth. In short:
- **Frontend** → Catalyst Slate native Git integration (auto-deploy on push).
- **Function** → GitHub Actions runs the CLI in CI (add `CATALYST_*` secrets).
- **Sigma widget** → CI packs a ZIP artifact you upload to the Sigma console
  (Sigma has no git-native deploy).

Full steps: [`docs/SETUP.md`](docs/SETUP.md).

## Develop

```bash
npm test          # run core smoke tests (no dependencies)
npm run sync      # refresh the lib/ copies after editing /core
```

## Roadmap

- MVP: Capacity Planning (M1, M2), dry-run apply. ✅
- Next: live Zoho Projects writes (OAuth connection).
- Then: M3 Allocation-vs-Availability, M4 Capacity-to-Demand; sibling modules
  (Resource Allocation, Budget Optimization); optional Claude API free-text layer.
