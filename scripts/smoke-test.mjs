#!/usr/bin/env node
/**
 * scripts/smoke-test.mjs
 * Fast, dependency-free checks over the core engine — the logic both shells and
 * the backend rely on. Run with:  npm test
 */
import assert from 'node:assert/strict';
import { utilization, availableCapacity, capacityVerdict } from '../core/formulas.js';
import { createAgent } from '../core/agent.js';
import { buildPlan } from '../core/planner.js';
import capacityPlanning from '../core/kb/capacity-planning.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('formulas');
ok('M1 utilization is a percentage', () => {
  const r = utilization(64, 80);
  assert.equal(r.value, 80);
  assert.equal(r.band, 'healthy');
});
ok('M1 bands: tight 86-90, overloaded above 90', () => {
  assert.equal(utilization(88, 100).band, 'tight');
  assert.equal(utilization(95, 100).band, 'overloaded');
});
ok('M2 subtracts leave, holidays and buffer', () => {
  // 10 days * 8h * 2 FTE = 160 gross; -16 leave = 144; -15% buffer = 122.4
  const r = availableCapacity({ workdays: 10, hoursPerDay: 8, fte: 2, leaveHours: 16, bufferPct: 0.15 });
  assert.equal(r.gross, 160);
  assert.equal(r.value, 122.4);
});
ok('capacityVerdict detects over-commitment', () => {
  const v = capacityVerdict(200, { workdays: 10, fte: 1 });
  assert.equal(v.overCommitted, true);
  assert.ok(v.gap > 0);
});

console.log('agent flow');
ok('agent walks ask -> practices -> formula -> compute -> plan', () => {
  const a = createAgent();
  a.start();
  a.chooseModule('capacity-planning');
  a.chooseIntent('measure');
  a.toFormula();
  const r = a.compute({ workdays: 10, hoursPerDay: 8, fte: 3, allocatedHours: 190 });
  assert.ok(r.results.available.value > 0);
  const p = a.toPlan({ window: 'Sprint 12' });
  assert.ok(p.plan.tasks.length >= 2);
  assert.match(p.plan.project.name, /Sprint 12/);
});

console.log('planner');
ok('over-committed plan includes a remediation task', () => {
  const v = capacityVerdict(300, { workdays: 10, fte: 1 });
  const plan = buildPlan(capacityPlanning, v, { window: 'X' });
  assert.ok(plan.tasks.some((t) => /over-allocation/i.test(t.name)));
});

console.log(`\n${passed} checks passed.`);
