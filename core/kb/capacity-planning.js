/**
 * core/kb/capacity-planning.js
 * The Capacity Planning knowledge base — the content the agent serves in
 * steps 2 (best practices) and 3 (formula & metric) of the conversation flow.
 *
 * Grounded in Zoho Projects' own vocabulary and features so guidance maps to
 * real screens: Resource Utilization chart, Workload report, user work hours,
 * Timesheets, Milestones, Task lists, and Tasks.
 *
 * MVP metrics: M1 (Resource Utilization %) and M2 (Available Capacity).
 * The `expansion` block names the metrics reserved for the comprehensive set.
 */

export const module = {
  id: 'capacity-planning',
  title: 'Capacity Planning',
  chip: 'Capacity Planning',
  oneLiner:
    'Match the work you commit to against the hours your people can actually deliver.',

  // ---- Step 1: sub-intents the agent can branch on -------------------------
  intents: [
    {
      id: 'measure',
      label: 'Measure my current state',
      prompt: 'How well am I using my team right now?',
    },
    {
      id: 'setup',
      label: 'Set capacity up from scratch',
      prompt: 'Help me plan capacity for an upcoming period.',
    },
  ],

  // ---- Step 2: best practices ----------------------------------------------
  bestPractices: {
    definition:
      'Capacity planning is deciding, before work starts, whether your team has ' +
      'enough available hours to deliver what you have committed — and rebalancing ' +
      'before people are over-booked rather than after deadlines slip.',
    practices: [
      {
        title: 'Plan against availability, not headcount',
        body:
          'A "5-person team" is never 5 × 40 hours. Subtract leave, holidays, ' +
          'part-time splits, and a buffer for meetings and context-switching. ' +
          'In Zoho Projects, set each user\'s work hours and use the Resource ' +
          'Utilization view rather than assuming everyone is fully available.',
      },
      {
        title: 'Keep utilization in the productive band (70–85%)',
        body:
          'Below ~70% you are leaving capacity on the table; above ~90% you are ' +
          'buying slippage and burnout. Track the Resource Utilization chart per ' +
          'user and per period, not just the team average — averages hide the ' +
          'one person who is at 130%.',
      },
      {
        title: 'Reserve a 15–20% buffer',
        body:
          'Unplanned work, reviews, support and meetings are real. Book teams to ' +
          '80–85% of raw available hours so the plan survives contact with reality.',
      },
      {
        title: 'Rebalance before the sprint, using real signals',
        body:
          'Compare planned allocation against logged effort in Timesheets. Where ' +
          'someone is consistently over their available hours, move tasks, extend ' +
          'the milestone, or add a resource — before the period starts.',
      },
      {
        title: 'Make capacity visible as structure',
        body:
          'Encode the plan in Zoho Projects itself: a Milestone per delivery ' +
          'window, Task lists per workstream, and tasks carrying an owner and an ' +
          'hours estimate, so allocation is inspectable, not living in a spreadsheet.',
      },
    ],
    zohoFeatures: [
      'Resource Utilization chart',
      'Workload report',
      'User work hours',
      'Timesheets (planned vs. logged)',
      'Milestones, Task lists & Tasks with hour estimates',
    ],
  },

  // ---- Step 3: the metrics (definitive formulas) ---------------------------
  metrics: [
    {
      id: 'M1',
      name: 'Resource Utilization %',
      question: 'Are my people in the productive zone — not idle, not on fire?',
      formulaText: 'Utilization % = (Allocated hours ÷ Available hours) × 100',
      fn: 'utilization', // maps to core/formulas.js
      inputs: [
        { key: 'allocatedHours', label: 'Allocated hours', hint: 'Hours booked onto project work in the window' },
        { key: 'availableHours', label: 'Available hours', hint: 'Hours the person/team can actually work (see M2)' },
      ],
      bands: [
        { key: 'under', range: '< 70%', label: 'Under-utilized', tone: 'warn' },
        { key: 'healthy', range: '70–85%', label: 'Healthy', tone: 'good' },
        { key: 'tight', range: '86–90%', label: 'Tight', tone: 'warn' },
        { key: 'overloaded', range: '> 90%', label: 'Overloaded', tone: 'bad' },
      ],
      zohoSource: 'Resource Utilization chart + user work hours',
    },
    {
      id: 'M2',
      name: 'Available Capacity',
      question: 'How many hours can this team really absorb in the window?',
      formulaText:
        'Available = Σ(workdays × hrs/day × FTE) − leave − holidays − buffer',
      fn: 'availableCapacity',
      inputs: [
        { key: 'workdays', label: 'Working days', hint: 'e.g. 10 for a 2-week sprint' },
        { key: 'hoursPerDay', label: 'Hours / day', hint: 'Contracted productive hours', default: 8 },
        { key: 'fte', label: 'FTE', hint: 'Full-time-equivalent people', default: 1 },
        { key: 'leaveHours', label: 'Leave (hrs)', hint: 'Approved leave in the window', default: 0 },
        { key: 'holidayHours', label: 'Holidays (hrs)', hint: 'Public holidays in the window', default: 0 },
        { key: 'bufferPct', label: 'Buffer', hint: 'Reserve for meetings/unplanned (0–0.5)', default: 0.15 },
      ],
      guidance: 'Reserve a 15–20% buffer. Book to the result, not the raw total.',
      zohoSource: 'User work hours + leave/holiday calendar',
    },
  ],

  // ---- Step 4/5: how a recommendation becomes Zoho Projects structure ------
  // Consumed by core/planner.js to draft the preview the user approves.
  setupTemplate: {
    projectName: 'Capacity Plan — {window}',
    milestone: '{window} delivery window',
    taskLists: ['Committed work', 'Buffer & unplanned'],
    // The planner fills tasks from the verdict (demand vs. available).
    notePrefix: 'Auto-drafted by the Capacity Planning agent — review before use.',
  },

  // ---- Reserved for the comprehensive capability set (post-MVP) -------------
  expansion: [
    { id: 'M3', name: 'Allocation vs. Availability', status: 'planned' },
    { id: 'M4', name: 'Capacity-to-Demand Ratio', status: 'planned' },
  ],
};

export default module;
