import { normalisePhone } from './format';

// Cheap, explainable lead scoring. Higher score = served earlier inside the
// same priority band, so genuinely hot leads jump a strict FIFO queue.
const BUDGET_POINTS = [
  [/(\b|\s)(2|3|4|5)\s*(cr|crore)/i, 30],
  [/(\b|\s)(1)\s*(cr|crore)/i, 22],
  [/(7[05]|8\d|9\d)\s*(l|lac|lakh)/i, 16],
  [/(5\d|6\d)\s*(l|lac|lakh)/i, 10],
];

const HOT_SOURCES = { 'walk-in': 25, referral: 20, 'site visit': 22, website: 12, google: 12, facebook: 8, instagram: 8, 'bulk sheet': 4 };

export function scoreLead(lead) {
  let score = 0;
  const budget = String(lead.budget || '');
  for (const [re, pts] of BUDGET_POINTS) {
    if (re.test(budget)) {
      score += pts;
      break;
    }
  }
  const src = String(lead.source || '').toLowerCase().trim();
  for (const [key, pts] of Object.entries(HOT_SOURCES)) {
    if (src.includes(key)) {
      score += pts;
      break;
    }
  }
  if (lead.project) score += 8;
  if (lead.city) score += 4;
  if (lead.altPhone && normalisePhone(lead.altPhone).length === 10) score += 4;
  if (String(lead.notes || '').length > 25) score += 6;
  if (/urgent|immediate|ready to buy|loan approved|site visit/i.test(String(lead.notes || ''))) score += 20;
  return Math.min(100, score);
}

export const scoreBand = (score) => (score >= 55 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold');
