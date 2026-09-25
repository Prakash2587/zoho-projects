/* AUTO-GENERATED from /core by scripts/sync-core.mjs — edit the source, not this copy. */
/**
 * core/agent.js
 * The 5-step conversation state machine, framework-free.
 *
 *   ask -> practices -> formula -> plan -> setup
 *
 * The shell (Catalyst web app or Sigma widget) owns rendering; this owns the
 * logic. Each transition returns a plain object the shell turns into a chat
 * turn. No DOM, no network — the shell wires those in.
 */
import { getModule, listChips } from './kb/index.js';
import * as formulas from './formulas.js';
import { buildPlan } from './planner.js';

export const STEPS = ['ask', 'practices', 'formula', 'plan', 'setup'];

export function createAgent() {
  const state = {
    step: 'ask',
    moduleId: null,
    intentId: null,
    inputs: {},
    verdict: null,
    plan: null,
  };

  /** Step 1 — greet and offer the module chips. */
  function start() {
    return {
      step: 'ask',
      say:
        'Hi — I\'m your project-management coach. Pick a capability and I\'ll walk ' +
        'you from best practice, to a formula you can measure yourself against, to ' +
        'a plan set up inside Zoho Projects.',
      chips: listChips(),
    };
  }

  /** Step 1 -> choose a module. */
  function chooseModule(moduleId) {
    const mod = getModule(moduleId);
    if (!mod) {
      return { step: 'ask', say: 'That module isn\'t ready yet — Capacity Planning is available now.', chips: listChips() };
    }
    state.moduleId = moduleId;
    state.step = 'ask';
    return {
      step: 'ask',
      say: `${mod.title}: ${mod.oneLiner} What would you like to do?`,
      intents: mod.intents,
    };
  }

  /** Step 2 — serve best practices for the chosen intent. */
  function chooseIntent(intentId) {
    const mod = requireModule();
    state.intentId = intentId;
    state.step = 'practices';
    return {
      step: 'practices',
      say: 'Here are the best practices that matter most:',
      bestPractices: mod.bestPractices,
      next: { label: 'Show me the formula', action: 'toFormula' },
    };
  }

  /** Step 3 — present the metric(s) and the inputs needed to compute them. */
  function toFormula() {
    const mod = requireModule();
    state.step = 'formula';
    return {
      step: 'formula',
      say: 'Measure your current state (or set a target) with these:',
      metrics: mod.metrics,
    };
  }

  /**
   * Step 3 (compute) — the shell collects inputs and calls this.
   * Returns the computed metrics plus a capacity verdict that seeds the plan.
   */
  function compute(inputs) {
    requireModule();
    state.inputs = { ...state.inputs, ...inputs };
    const i = state.inputs;

    const cap = formulas.availableCapacity({
      workdays: num(i.workdays),
      hoursPerDay: num(i.hoursPerDay, 8),
      fte: num(i.fte, 1),
      leaveHours: num(i.leaveHours, 0),
      holidayHours: num(i.holidayHours, 0),
      bufferPct: num(i.bufferPct, 0.15),
    });

    // If the user gave allocated/demand hours, score utilization against M2.
    const demand = num(i.allocatedHours, num(i.demandHours, cap.value));
    const verdict = formulas.capacityVerdict(demand, {
      workdays: num(i.workdays),
      hoursPerDay: num(i.hoursPerDay, 8),
      fte: num(i.fte, 1),
      leaveHours: num(i.leaveHours, 0),
      holidayHours: num(i.holidayHours, 0),
      bufferPct: num(i.bufferPct, 0.15),
    });
    state.verdict = verdict;

    return {
      step: 'formula',
      results: {
        available: cap,
        utilization: verdict.utilization,
        verdict,
      },
      say: verdictSentence(verdict),
      next: { label: 'Draft a plan in Zoho Projects', action: 'toPlan' },
    };
  }

  /** Step 4 — turn the verdict into a Zoho Projects structure preview. */
  function toPlan(meta = {}) {
    const mod = requireModule();
    if (!state.verdict) {
      return { step: 'formula', say: 'Enter your numbers first so I can size the plan.' };
    }
    state.plan = buildPlan(mod, state.verdict, meta);
    state.step = 'plan';
    return {
      step: 'plan',
      say: 'Here\'s the structure I\'d create. Review it, then approve to set it up.',
      plan: state.plan,
      next: { label: 'Set it up in Zoho Projects', action: 'apply' },
    };
  }

  /**
   * Step 5 — hand the plan to the shell to POST at the Catalyst function.
   * The agent does not call the network itself; it returns the payload and the
   * shell performs the request (and, until credentials exist, gets a dry-run).
   */
  function toApply() {
    if (!state.plan) return { step: 'plan', say: 'Draft a plan first.' };
    state.step = 'setup';
    return { step: 'setup', apply: state.plan, say: 'Setting this up in Zoho Projects…' };
  }

  // ---- helpers -------------------------------------------------------------
  function requireModule() {
    const mod = getModule(state.moduleId);
    if (!mod) throw new Error('No module selected');
    return mod;
  }

  return {
    get state() { return { ...state }; },
    start, chooseModule, chooseIntent, toFormula, compute, toPlan, toApply,
  };
}

function num(v, fallback = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

function verdictSentence(v) {
  const load = v.utilization.value; // % of real working hours
  if (v.status === 'overloaded') {
    return `Overloaded: ${v.demand} h of work exceeds even the ${v.availableBeforeBuffer} h your team ` +
      `can physically work (${load}% of working hours). Cut scope, extend the window, or add people.`;
  }
  if (v.status === 'over_plan') {
    return `Over your plan by ${v.gap} h: ${v.demand} h needs more than your ${v.available} h planned ` +
      `capacity, eating ${v.intoBuffer} h of the ${v.buffer} h buffer you reserved. People would sit at ` +
      `${load}% of working hours. Trim scope, spend buffer deliberately, or add capacity.`;
  }
  const headroom = Math.round((v.available - v.demand) * 10) / 10;
  return `Fits: ${v.demand} h against ${v.available} h planned capacity — ${load}% of working hours` +
    `${headroom > 0 ? `, ${headroom} h of headroom left` : ''}.`;
}
