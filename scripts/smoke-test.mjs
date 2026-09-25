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
import { createNLU } from '../core/nlu.js';
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
ok('capacityVerdict: fits when demand <= bookable', () => {
  const v = capacityVerdict(190, { workdays: 10, hoursPerDay: 8, fte: 3 });
  assert.equal(v.status, 'fits');
  assert.equal(v.overCommitted, false);
});
ok('capacityVerdict: over_plan eats buffer but stays within raw hours', () => {
  // raw 36, buffer 50% -> bookable 18; demand 24 is >18 but <36
  const v = capacityVerdict(24, { workdays: 3, hoursPerDay: 12, fte: 1, bufferPct: 0.5 });
  assert.equal(v.status, 'over_plan');
  assert.equal(v.available, 18);
  assert.equal(v.intoBuffer, 6);
});
ok('capacityVerdict: overloaded when demand exceeds raw working hours', () => {
  const v = capacityVerdict(200, { workdays: 10, hoursPerDay: 8, fte: 1 });
  assert.equal(v.status, 'overloaded');
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

console.log('nlu chat router');
ok('extracts module + numbers from free text', () => {
  const nlu = createNLU();
  const r = nlu.interpret('Is my 4-dev team over-allocated for a 2-week sprint with 240h of work?');
  assert.equal(r.moduleId, 'capacity-planning');
  assert.equal(r.moduleReady, true);
  assert.equal(r.numbers.fte, 4);
  assert.equal(r.numbers.workdays, 10);   // 2 weeks -> 10 workdays
  assert.equal(r.numbers.allocatedHours, 240);
});
ok('routes an unbuilt module to "soon"', () => {
  const r = createNLU().interpret('help me optimize my project budget and cost');
  assert.equal(r.moduleId, 'budget-optimization');
  assert.equal(r.moduleReady, false);
});

console.log(`\n${passed} checks passed.`);
