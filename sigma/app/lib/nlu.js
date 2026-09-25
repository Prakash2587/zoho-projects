/* AUTO-GENERATED from /core by scripts/sync-core.mjs — edit the source, not this copy. */
/**
 * core/nlu.js
 * Natural-language routing for the free-text chat box.
 *
 * MVP: a deterministic keyword + number extractor. No LLM, no network, no cost.
 * It is deliberately wrapped behind `createNLU()` returning an `interpret`
 * function, so the Claude API version is a ONE-FILE SWAP later:
 *
 *   // core/nlu.claude.js  (future)
 *   export function createNLU({ endpoint }) {
 *     return { async interpret(text){ return fetch(endpoint, ...) } };
 *   }
 *
 * Shells depend only on the { interpret } shape, never on the implementation.
 */

const MODULE_KEYWORDS = [
  { id: 'capacity-planning', words: ['capacity', 'utilization', 'utilisation', 'availab', 'over-alloc', 'overallocat', 'overloaded', 'buffer', 'bandwidth', 'workload', 'headroom', 'burnout'] },
  { id: 'resource-allocation', words: ['resource alloc', 'assign', 'who works on', 'staffing', 'reassign'] },
  { id: 'budget-optimization', words: ['budget', 'cost', 'spend', 'billing rate', 'margin'] },
];

const INTENT_KEYWORDS = [
  { id: 'measure', words: ['measure', 'how am i', 'current', 'right now', 'are we', 'am i over', 'check', 'score', 'where do i stand'] },
  { id: 'setup', words: ['plan', 'set up', 'setup', 'from scratch', 'upcoming', 'next sprint', 'next quarter', 'kick off'] },
];

/**
 * Pull capacity inputs out of free text. Conservative: only sets a field when a
 * clear unit/keyword is present, so we never fabricate numbers for the math.
 */
function extractNumbers(text) {
  const t = text.toLowerCase();
  const out = {};
  const grab = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };

  // Only explicit "days" (or "N-day sprint") count as workdays; weeks convert.
  const workdays = grab(/(\d+(?:\.\d+)?)\s*(?:work\s*)?days?\b/) ?? grab(/(\d+)\s*-?\s*day\s*sprint/);
  if (workdays != null) out.workdays = workdays;
  const weeks = grab(/(\d+(?:\.\d+)?)\s*-?\s*weeks?\b/); // "2-week sprint" -> 10 workdays
  if (out.workdays == null && weeks != null) out.workdays = weeks * 5;

  const hrsDay = grab(/(\d+(?:\.\d+)?)\s*(?:h(?:ou)?rs?)\s*(?:\/|per|a)\s*day/);
  if (hrsDay != null) out.hoursPerDay = hrsDay;

  // Allow an optional hyphen so "4-dev team" is picked up like "4 devs".
  const fte = grab(/(\d+(?:\.\d+)?)\s*-?\s*(?:fte|people|persons?|devs?|developers?|engineers?|members?|team members?|folks)\b/);
  if (fte != null) out.fte = fte;

  const leave = grab(/(\d+(?:\.\d+)?)\s*(?:h(?:ou)?rs?)?\s*(?:of\s*)?(?:leave|pto|vacation|time off)/);
  if (leave != null) out.leaveHours = leave;

  const holiday = grab(/(\d+(?:\.\d+)?)\s*(?:h(?:ou)?rs?)?\s*(?:of\s*)?holidays?/);
  if (holiday != null) out.holidayHours = holiday;

  const bufferPct = grab(/(\d+(?:\.\d+)?)\s*%?\s*buffer/) ?? grab(/buffer\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/);
  if (bufferPct != null) out.bufferPct = bufferPct > 1 ? bufferPct / 100 : bufferPct;

  // demand / allocated / committed work, e.g. "190 hours of work", "commit 24h".
  // The hours unit accepts a bare "h" as well as "hr/hrs/hour/hours".
  const demand = grab(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:of\s*)?(?:work|effort|tasks?|committed|planned|demand|backlog)/)
    ?? grab(/(?:commit|committed|allocated|booked|demand|backlog|work)\D{0,12}?(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/);
  if (demand != null) out.allocatedHours = demand;

  return out;
}

function firstMatch(list, text) {
  const t = text.toLowerCase();
  for (const entry of list) if (entry.words.some((w) => t.includes(w))) return entry.id;
  return null;
}

export function createNLU() {
  return {
    /**
     * @param {string} text
     * @returns {{ moduleId:string|null, moduleReady:boolean, intentId:string|null,
     *             numbers:object, reply:string }}
     */
    interpret(text) {
      const moduleId = firstMatch(MODULE_KEYWORDS, text) || null;
      const intentId = firstMatch(INTENT_KEYWORDS, text) || null;
      const numbers = extractNumbers(text);
      const ready = moduleId === 'capacity-planning'; // only module built in the MVP

      let reply;
      if (!moduleId) {
        reply = "I can help with capacity planning today. Tell me about your team's capacity, " +
          "utilization, or whether you're over-allocated — or pick a chip below.";
      } else if (!ready) {
        reply = `That sounds like ${moduleId.replace('-', ' ')}, which is coming soon. ` +
          `Capacity Planning is ready now — want to start there?`;
      } else {
        const got = Object.keys(numbers).length;
        reply = intentId === 'setup'
          ? "Let's plan your capacity. I'll show the best practices, then we'll size it together."
          : got
            ? `Got it — I picked up ${got} value${got > 1 ? 's' : ''} from that. Let's measure your current state.`
            : "Let's measure your current state. I'll pull up the formula and a quick form.";
      }
      return { moduleId, moduleReady: ready, intentId, numbers, reply };
    },
  };
}
