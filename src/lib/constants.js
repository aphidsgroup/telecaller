// Shared vocabulary for the whole app. Kept as plain strings so the same
// values work in the DB (SQLite/Postgres), the API and the UI.

export const ROLE = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', TELECALLER: 'TELECALLER' };

export const LEAD_STATUS = {
  UNASSIGNED: 'UNASSIGNED',   // sitting in the central pool
  ASSIGNED: 'ASSIGNED',       // in a telecaller queue, pending call
  ACTIVE: 'ACTIVE',           // currently on the telecaller screen, call not clicked yet
  IN_PROGRESS: 'IN_PROGRESS', // call button clicked, waiting for the disposition
  SCHEDULED: 'SCHEDULED',     // follow-up booked for a future date/time
  CLOSED: 'CLOSED',           // terminal
};

export const LEAD_STATUS_LABEL = {
  UNASSIGNED: 'Unassigned',
  ASSIGNED: 'Pending call',
  ACTIVE: 'On screen',
  IN_PROGRESS: 'In progress',
  SCHEDULED: 'Follow-up scheduled',
  CLOSED: 'Closed',
};

// A lead a telecaller currently holds - never handed to anybody else.
export const HELD_STATUSES = [LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS];

export const CALL_CATEGORY = [
  { value: 'NOT_ANSWERED', label: 'Call Not Answered' },
  { value: 'AFTER_SOME_TIME', label: 'Call Me After Some Time' },
  { value: 'AFTERNOON', label: 'Call Me Afternoon' },
  { value: 'EVENING', label: 'Call Me Evening' },
  { value: 'TOMORROW', label: 'Call Me Tomorrow' },
  { value: 'WEEKEND', label: 'Call Me Weekend' },
  { value: 'MONDAY', label: 'Call Me Monday' },
  { value: 'NEXT_WEEK', label: 'Call Me Next Week' },
  { value: 'NEXT_MONTH', label: 'Call Me Next Month' },
];

// Categories that imply the prospect asked to be called back later.
export const CALLBACK_CATEGORIES = [
  'AFTER_SOME_TIME',
  'AFTERNOON',
  'EVENING',
  'TOMORROW',
  'WEEKEND',
  'MONDAY',
  'NEXT_WEEK',
  'NEXT_MONTH'
];

export const LEAD_STATUS_CATEGORY = [
  { value: 'SEND_BROCHURE_WHATSAPP', label: 'Send Brochure on WhatsApp' },
  { value: 'SEND_SITE_VISIT', label: 'Send Person to Site Visit' },
  { value: 'SITE_VISIT_DONE', label: 'Site Visit Completed' },
  { value: 'QUOTATION_SENT', label: 'Quotation Sent' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'INTERESTED', label: 'Interested / Follow Up' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CONVERTED', label: 'Converted / Booked' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number / Invalid' },
  { value: 'DUPLICATE', label: 'Duplicate Lead' },
];

// Reaching one of these ends the lead - no follow-up is scheduled.
export const TERMINAL_LEAD_STATUSES = ['NOT_INTERESTED', 'CONVERTED', 'WRONG_NUMBER', 'DUPLICATE'];

export const labelOf = (list, value) => (list.find((x) => x.value === value) || {}).label || value || '-';
export const callCategoryLabel = (v) => labelOf(CALL_CATEGORY, v);
export const leadStatusCategoryLabel = (v) => labelOf(LEAD_STATUS_CATEGORY, v);

export const EVENT = {
  LEAD_UPLOADED: 'LEAD_UPLOADED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_REASSIGNED: 'LEAD_REASSIGNED',
  LEAD_UNASSIGNED: 'LEAD_UNASSIGNED',
  LEAD_SERVED: 'LEAD_SERVED',
  CALL_CLICKED: 'CALL_CLICKED',
  WHATSAPP_CLICKED: 'WHATSAPP_CLICKED',
  STATUS_UPDATED: 'STATUS_UPDATED',
  FOLLOWUP_SCHEDULED: 'FOLLOWUP_SCHEDULED',
  LEAD_CLOSED: 'LEAD_CLOSED',
  LEAD_REOPENED: 'LEAD_REOPENED',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
  AUTO_FLAGGED: 'AUTO_FLAGGED',
  FLAG_CLEARED: 'FLAG_CLEARED',
  SLA_BREACH: 'SLA_BREACH',
  DUPLICATE_FLAGGED: 'DUPLICATE_FLAGGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  DND_MARKED: 'DND_MARKED',
};

export const EVENT_LABEL = {
  LEAD_UPLOADED: 'Lead uploaded',
  LEAD_ASSIGNED: 'Assigned to telecaller',
  LEAD_REASSIGNED: 'Reassigned',
  LEAD_UNASSIGNED: 'Returned to pool',
  LEAD_SERVED: 'Shown on telecaller screen',
  CALL_CLICKED: 'Call button clicked',
  WHATSAPP_CLICKED: 'WhatsApp opened',
  STATUS_UPDATED: 'Status updated',
  FOLLOWUP_SCHEDULED: 'Follow-up scheduled',
  LEAD_CLOSED: 'Lead closed',
  LEAD_REOPENED: 'Lead reopened by admin',
  ADMIN_OVERRIDE: 'Admin override',
  AUTO_FLAGGED: 'Auto-flagged for review',
  FLAG_CLEARED: 'Review flag cleared',
  SLA_BREACH: 'SLA breach',
  DUPLICATE_FLAGGED: 'Duplicate flagged on import',
  PRIORITY_CHANGED: 'Priority changed',
  DND_MARKED: 'Marked DND',
};

export const IMPORT_SOURCE = {
  SHEETS_API: 'SHEETS_API',
  APPS_SCRIPT_WEBHOOK: 'APPS_SCRIPT_WEBHOOK',
  MANUAL: 'MANUAL',
};

export const ASSIGNMENT_MODE = { ROUND_ROBIN: 'ROUND_ROBIN', RULES: 'RULES', MANUAL: 'MANUAL' };
