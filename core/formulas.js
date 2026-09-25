/**
 * core/formulas.js
 * Pure, dependency-free capacity-planning calculations.
 * These are the definitive metrics the agent serves in step 3 of the flow.
 *
 * MVP scope: M1 Resource Utilization %, M2 Available Capacity.
 * (M3 Allocation-vs-Availability and M4 Capacity-to-Demand are stubbed for the
 *  comprehensive capability set — see kb/capacity-planning.js -> expansion.)
 *
 * Every function is pure: same inputs -> same output, no I/O, no globals.
 * Safe to run in a browser (Slate / Sigma widget) or in a Catalyst function.
 */

/** Clamp a number into [min, max]. */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Round to a fixed number of decimals and return a Number (not a string). */
function round(n, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * M1 — Resource Utilization %
 *   Utilization % = (Allocated hours / Available hours) * 100
 *
 * @param {number} allocatedHours  hours booked onto project work in the window
 * @param {number} availableHours  hours the person/team can actually work (see M2)
 * @returns {{ value:number, band:string, label:string, healthy:boolean }}
 */
function utilization(allocatedHours, availableHours) {
  if (availableHours <= 0) {
    return { value: 0, band: 'unknown', label: 'No available hours provided', healthy: false };
  }
  const value = round((allocatedHours / availableHours) * 100, 1);
  const band = utilizationBand(value);
  return {
    value,
    band: band.key,
    label: band.label,
    healthy: band.key === 'healthy',
  };
}

/**
 * Healthy-range bands for M1. These thresholds are the KB's recommendation,
 * grounded in standard resource-management practice (a productive team sits
 * around 70-85%, leaving headroom for the unplanned).
 */
function utilizationBand(pct) {
  if (pct < 70) return { key: 'under', label: 'Under-utilized — capacity is going unused' };
  if (pct <= 85) return { key: 'healthy', label: 'Healthy — productive with headroom' };
  if (pct <= 90) return { key: 'tight', label: 'Tight — little room for the unplanned' };
  return { key: 'overloaded', label: 'Overloaded — burnout & slippage risk' };
}

/**
 * M2 — Available Capacity (hours in a window)
 *   Available = Σ(workdays * hours/day * FTE) − leave − holidays − buffer
 *
 * @param {object} p
 * @param {number} p.workdays       working days in the window (e.g. 10 for a 2-wk sprint)
 * @param {number} p.hoursPerDay    contracted productive hours/day (default 8)
 * @param {number} p.fte            full-time-equivalent count of people (default 1)
 * @param {number} p.leaveHours     approved leave in the window (default 0)
 * @param {number} p.holidayHours   public holidays in the window (default 0)
 * @param {number} p.bufferPct      reserve for meetings/context-switching, 0..1 (default 0.15)
 * @returns {{ gross:number, buffer:number, value:number, bufferPct:number }}
 */
function availableCapacity({
  workdays,
  hoursPerDay = 8,
  fte = 1,
  leaveHours = 0,
  holidayHours = 0,
  bufferPct = 0.15,
}) {
  const safeBuffer = clamp(bufferPct, 0, 0.5);
  const gross = workdays * hoursPerDay * fte;
  const afterLeave = Math.max(0, gross - leaveHours - holidayHours);
  const buffer = afterLeave * safeBuffer;
  const value = round(Math.max(0, afterLeave - buffer), 1);
  return {
    gross: round(gross, 1),
    buffer: round(buffer, 1),
    value,
    bufferPct: safeBuffer,
  };
}

/**
 * Convenience: given a demand (hours of committed work) and the inputs for M2,
 * report whether the team can absorb it, and by how much. Used to seed the
 * plan the agent drafts in step 4.
 */
function capacityVerdict(demandHours, capacityInputs) {
  const cap = availableCapacity(capacityInputs);
  // Three honest reference points, one denominator each — so the headline never
  // contradicts itself:
  //   raw      = real working hours a team can physically put in
  //   bookable = what you plan to fill (raw − reserved buffer)   [M2]
  //   load     = demand as a % of raw working hours              [M1, guideline 70–85%]
  const raw = round(cap.value + cap.buffer, 1); // gross − leave − holidays
  const util = utilization(demandHours, raw);
  const gap = round(demandHours - cap.value, 1); // >0 means past the bookable line
  const intoBuffer = round(Math.max(0, Math.min(demandHours, raw) - cap.value), 1);

  // Single status the whole UI keys off. `over_plan` means it eats the reserved
  // buffer but people are still within real hours; `overloaded` means demand
  // exceeds even raw working hours.
  let status;
  if (demandHours > raw) status = 'overloaded';
  else if (gap > 0) status = 'over_plan';
  else status = 'fits';

  return {
    available: cap.value,   // bookable (buffer reserved)
    availableBeforeBuffer: raw,
    demand: round(demandHours, 1),
    gap,
    intoBuffer,
    overCommitted: gap > 0,
    status,
    utilization: util,      // load vs raw hours; .value is the % people are worked
    buffer: cap.buffer,
  };
}

export { clamp, round, utilization, utilizationBand, availableCapacity, capacityVerdict };
