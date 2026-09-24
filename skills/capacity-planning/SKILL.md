---
name: capacity-planning
description: "Coach a Zoho Projects user through capacity planning — best practices, the definitive formulas (Resource Utilization %, Available Capacity), and turning the result into a project/milestone/task structure inside Zoho Projects. Use for questions about team capacity, utilization, over-allocation, availability, buffers, or 'can my team deliver this sprint?'."
metadata:
  version: "0.1.0"
  module: capacity-planning
  status: mvp
---

# Capacity Planning — Skill

The first capability of the Zoho Projects knowledge-base agent. It follows the
same five beats every module uses:

**Ask → Best practices → Formula & metric → Draft plan → Set it up in Zoho Projects.**

This SKILL is the reasoning layer; the runnable engine lives in `/core`
(`kb/capacity-planning.js`, `formulas.js`, `agent.js`, `planner.js`) and is
shared by the Catalyst web app and the Sigma widget.

## When to use

Load this when the user asks about: team capacity, resource/utilization %,
over-allocation, availability vs. allocation, sprint/period headroom, buffers,
"are my people over-booked", or "help me plan capacity for the next sprint".

## The flow, step by step

1. **Ask** — Confirm the sub-intent: *measure my current state* or *set up from
   scratch*. Predefined chips exist for both.
2. **Best practices** — Serve the five practices in `references/best-practices.md`.
   Ground every point in a real Zoho Projects feature (Resource Utilization
   chart, Workload report, user work hours, Timesheets, Milestones/Task lists).
3. **Formula & metric** — Present the MVP metrics and score the user:
   - **M1 Resource Utilization %** = (Allocated ÷ Available) × 100. Healthy band **70–85%**.
   - **M2 Available Capacity** = Σ(workdays × hrs/day × FTE) − leave − holidays − buffer. Reserve **15–20%**.
   Full definitions and worked examples: `references/formulas.md`.
4. **Draft plan** — Turn the verdict into a Zoho Projects structure (a project,
   a milestone for the window, "Committed work" + "Buffer & unplanned" task
   lists, and tasks with hour estimates). Always **preview and get approval**
   before writing.
5. **Set it up** — Apply the plan via the Catalyst function (`/apply`), which
   calls Zoho Projects REST v3 over an OAuth connection. Until credentials are
   configured it returns a **dry-run** describing the exact calls — never a
   silent no-op.

## Guardrails

- Never claim work was created in Zoho Projects unless the backend returned
  `mode: "live"` with created ids. In `dry-run`, say plainly that nothing was
  written.
- Utilization above 90% is a burnout/slippage flag, not a target — recommend
  rebalancing, extending the window, or adding a resource.
- The buffer is real work; keep it visible as its own task, don't hide it.

## Reserved for the comprehensive set (post-MVP)

- **M3 Allocation vs. Availability** — per-person over-allocation gap.
- **M4 Capacity-to-Demand Ratio** — portfolio-level headroom.
- Sibling modules: Resource Allocation, Budget Optimization (same five-beat
  flow, new `core/kb/*` files).

## References

- `references/best-practices.md` — the practice cards, in Zoho vocabulary.
- `references/formulas.md` — formulas, bands, worked examples, and the Zoho
  Projects REST v3 calls the plan maps to.
