/**
 * core/kb/index.js
 * Module registry. Capacity Planning is fully built for the MVP; the others
 * are declared as coming so the UI can show the full menu with "soon" chips.
 */
import capacityPlanning from './capacity-planning.js';

export const modules = {
  'capacity-planning': capacityPlanning,
};

// Declared but not yet built — the comprehensive set the MVP grows into.
export const upcoming = [
  { id: 'resource-allocation', chip: 'Resource Allocation' },
  { id: 'budget-optimization', chip: 'Budget Optimization' },
];

export function getModule(id) {
  return modules[id] || null;
}

export function listChips() {
  return [
    ...Object.values(modules).map((m) => ({ id: m.id, chip: m.chip, ready: true })),
    ...upcoming.map((u) => ({ id: u.id, chip: u.chip, ready: false })),
  ];
}
