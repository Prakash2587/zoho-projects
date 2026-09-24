# Capacity Planning — Formulas & Metrics

MVP metrics. Implemented in `core/formulas.js` (pure functions, browser- and
function-safe).

## M1 — Resource Utilization %

```
Utilization % = (Allocated hours ÷ Available hours) × 100
```

**Healthy bands**

| Range | Meaning | Tone |
|---|---|---|
| < 70% | Under-utilized — capacity going unused | warn |
| 70–85% | Healthy — productive with headroom | good |
| 86–90% | Tight — little room for the unplanned | warn |
| > 90% | Overloaded — burnout & slippage risk | bad |

**Worked example** — 190 h booked against 224 h available → **84.8% (Healthy)**.

*Zoho source:* Resource Utilization chart + user work hours.

## M2 — Available Capacity (hours in a window)

```
Available = Σ(workdays × hrs/day × FTE) − leave − holidays − buffer
buffer     = (gross − leave − holidays) × bufferPct   (default 15%)
```

**Worked example** — 10 workdays × 8 h × 3 FTE = 240 h gross; −16 h leave = 224 h;
−15% buffer (33.6 h) → **190.4 h available**. Reserve the buffer; book to the
result, not the raw 240.

*Zoho source:* user work hours + leave/holiday calendar.

## From metric to plan → Zoho Projects REST v3

`core/planner.js` turns the verdict into a structure; the Catalyst function maps
it to REST v3 (`portalId` from Sigma context or the web app):

| Step | Call |
|---|---|
| Project | `POST /restapi/portal/{portalId}/projects/` |
| Milestone | `POST /restapi/portal/{portalId}/projects/{projectId}/milestones/` |
| Task list | `POST /restapi/portal/{portalId}/projects/{projectId}/tasklists/` |
| Task | `POST /restapi/portal/{portalId}/projects/{projectId}/tasklists/{tasklistId}/tasks/` |

Task hours are sent as Zoho's `work` field in `HH:MM` (e.g. `24:00` for 24 h).

## Reserved (post-MVP)

- **M3 Allocation vs. Availability** — `Gap = Allocated − Available` per person/week.
- **M4 Capacity-to-Demand Ratio** — `Total available ÷ Total demand`.
