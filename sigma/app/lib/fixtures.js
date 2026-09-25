/* AUTO-GENERATED from /core by scripts/sync-core.mjs — edit the source, not this copy. */
/**
 * core/fixtures.js
 * Clearly-labelled SAMPLE data for the "Fetch from Zoho Projects" button, used
 * before the OAuth connection exists. Shaped like what the Projects API would
 * return so the real fetch is a drop-in later.
 *
 * Numbers describe a 2-week sprint for a small team, with some leave booked.
 */
export const sampleCapacity = {
  source: 'sample',
  label: 'Sample — “Website Revamp” team, next 2-week sprint',
  inputs: {
    workdays: 10,      // 2-week sprint
    hoursPerDay: 8,
    fte: 4,            // 4 people
    leaveHours: 24,    // ~3 days of leave across the team
    holidayHours: 0,
    bufferPct: 0.15,
    allocatedHours: 240, // committed backlog for the sprint
  },
};

export function fetchSampleCapacity() {
  // Mimic an async API call so the UI flow matches the real one later.
  return new Promise((resolve) => setTimeout(() => resolve(sampleCapacity), 350));
}
