// End-to-end exercise of the telecaller mechanic against a running server.
const BASE = process.env.BASE || 'http://localhost:3000';
// Unique per run so re-running against the same database is not blocked by the
// idempotency guard on clientEventId.
const RUN = Date.now().toString(36);
const WEBHOOK_PHONE = `98${String(Date.now()).slice(-8)}`;
// A fresh spreadsheetId per run: re-importing the same sheet row is (correctly)
// treated as an already-seen row by the app.

function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb: (res) => {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      raw.forEach((c) => {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      });
    },
  };
}

async function call(jar, path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jar.header() ? { cookie: jar.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  jar.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 120) };
  }
  return { status: res.status, json };
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const caller = makeJar();
const admin = makeJar();

// --- auth ---
let r = await call(caller, '/api/auth/login', { method: 'POST', body: { email: 'priya@buildogram.in', password: 'wrong' } });
check('bad password rejected', r.status === 401, `status ${r.status}`);

r = await call(caller, '/api/auth/login', { method: 'POST', body: { email: 'priya@buildogram.in', password: 'caller@123' } });
check('telecaller login', r.status === 200 && r.json.ok, `redirect ${r.json.redirect}`);

r = await call(admin, '/api/auth/login', { method: 'POST', body: { email: 'admin@buildogram.in', password: 'admin@123' } });
check('admin login', r.status === 200 && r.json.redirect === '/admin');

// --- role separation ---
r = await call(caller, '/api/admin/telecallers');
check('telecaller blocked from admin API', r.status === 403, `status ${r.status}`);
r = await call(admin, '/api/telecaller/current-lead');
check('admin blocked from telecaller API', r.status === 403, `status ${r.status}`);

// --- one lead at a time ---
r = await call(caller, '/api/telecaller/current-lead');
const lead1 = r.json.lead;
check('one lead served', r.status === 200 && !!lead1, lead1 ? `${lead1.name} (${lead1.status})` : 'none');
check('served lead is ACTIVE', lead1?.status === 'ACTIVE');
check('queue counters present', typeof r.json.queue?.remaining === 'number', JSON.stringify(r.json.queue));

// re-fetching must return the SAME lead, never a second one
r = await call(caller, '/api/telecaller/current-lead');
check('re-fetch returns same lead (no skipping)', r.json.lead?.id === lead1.id && r.json.resumed === true);

// --- form is locked until the call button is pressed ---
r = await call(caller, '/api/telecaller/disposition', {
  method: 'POST',
  body: { leadId: lead1.id, clientEventId: `test-early-1-${RUN}`, callCategory: 'TOMORROW', leadStatus: 'INTERESTED' },
});
check('disposition rejected before call click', r.status === 409, r.json.error);

// --- call click ---
r = await call(caller, '/api/telecaller/call-click', { method: 'POST', body: { leadId: lead1.id } });
check('call click logged', r.status === 200 && !!r.json.callClickedAt, r.json.callClickedAt);

r = await call(caller, '/api/telecaller/current-lead');
check('lead now IN_PROGRESS and still the same', r.json.lead?.id === lead1.id && r.json.lead.status === 'IN_PROGRESS');

// --- disposition with a callback -> follow-up scheduled, next lead loads ---
r = await call(caller, '/api/telecaller/disposition', {
  method: 'POST',
  body: {
    leadId: lead1.id,
    clientEventId: `test-evt-1-${RUN}`,
    callCategory: 'AFTER_SOME_TIME',
    leadStatus: 'INTERESTED',
    notes: 'Asked to call back this evening',
  },
});
const followUp = r.json.result?.followUpAt;
check('disposition accepted', r.status === 200 && r.json.ok, r.json.result?.reason);
check('follow-up scheduled', !!followUp, followUp);
const lead2 = r.json.lead;
check('next lead loaded immediately', !!lead2 && lead2.id !== lead1.id, lead2?.name);

// --- idempotency: replaying the same clientEventId must not double-write ---
r = await call(caller, '/api/telecaller/disposition', {
  method: 'POST',
  body: {
    leadId: lead1.id,
    clientEventId: `test-evt-1-${RUN}`,
    callCategory: 'AFTER_SOME_TIME',
    leadStatus: 'INTERESTED',
  },
});
check('replayed disposition is idempotent', r.status === 200 && r.json.result?.duplicate === true);

// --- offline replay path: submit with a client call-click timestamp, no prior click ---
const clickAt = new Date().toISOString();
r = await call(caller, '/api/telecaller/disposition', {
  method: 'POST',
  body: {
    leadId: lead2.id,
    clientEventId: `test-offline-1-${RUN}`,
    callCategory: 'NOT_ANSWERED',
    leadStatus: 'INTERESTED',
    callClickedAt: clickAt,
    queuedOffline: true,
  },
});
check('offline-queued disposition accepted with client timestamp', r.status === 200 && r.json.ok, r.json.result?.reason);
const lead3 = r.json.lead;
check('third lead served', !!lead3 && lead3.id !== lead2.id);

// --- terminal status closes the lead ---
await call(caller, '/api/telecaller/call-click', { method: 'POST', body: { leadId: lead3.id } });
r = await call(caller, '/api/telecaller/disposition', {
  method: 'POST',
  body: { leadId: lead3.id, clientEventId: `test-evt-3-${RUN}`, callCategory: 'NOT_ANSWERED', leadStatus: 'WRONG_NUMBER' },
});
check('terminal status closes lead', r.json.result?.closed === true && r.json.result?.followUpAt === null);

// --- another telecaller gets a different lead ---
const caller2 = makeJar();
await call(caller2, '/api/auth/login', { method: 'POST', body: { email: 'arun@buildogram.in', password: 'caller@123' } });
r = await call(caller2, '/api/telecaller/current-lead');
check('second telecaller gets a different lead', !!r.json.lead && r.json.lead.id !== lead3.id, r.json.lead?.name);

// --- admin visibility ---
r = await call(admin, `/api/admin/leads/${lead1.id}`);
const timeline = r.json.lead?.events?.map((e) => e.type) || [];
check('admin sees full timeline', r.status === 200 && timeline.length >= 4, timeline.join(' > '));
check('timeline has upload/assign/serve/click/status', ['LEAD_UPLOADED', 'LEAD_ASSIGNED', 'LEAD_SERVED', 'CALL_CLICKED', 'STATUS_UPDATED'].every((t) => timeline.includes(t)));
check('disposition history recorded', (r.json.lead?.dispositions?.length || 0) === 1);

// --- admin reassignment takes the lead off a screen ---
r = await call(admin, '/api/admin/telecallers');
const arun = r.json.users.find((u) => u.email === 'arun@buildogram.in');
r = await call(admin, `/api/admin/leads/${lead1.id}`, { method: 'PATCH', body: { action: 'assign', userId: arun.id } });
check('admin reassigns lead', r.status === 200 && r.json.lead.assignedToId === arun.id);

// --- admin override appends history ---
r = await call(admin, `/api/admin/leads/${lead1.id}`, {
  method: 'PATCH',
  body: { leadStatus: 'CONVERTED', notes: 'Booked at site office' },
});
check('admin override applied', r.status === 200 && r.json.lead.lastLeadStatus === 'CONVERTED');
r = await call(admin, `/api/admin/leads/${lead1.id}`);
check('override appended (2 history rows, none overwritten)', r.json.lead.dispositions.length === 2 && r.json.lead.dispositions[1].isOverride === true);

// --- webhook ingestion + dedupe ---
const hook = await fetch(`${BASE}/api/webhooks/sheets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': 'dev-webhook-secret' },
  body: JSON.stringify({
    spreadsheetId: `test-sheet-${RUN}`,
    sheetTab: 'Leads',
    rows: [
      { rowNumber: 2, Name: 'Webhook Tester', 'Phone Number': WEBHOOK_PHONE, Source: 'Website', 'Project/Site of Interest': 'Buildogram Aster - Porur', 'City/Area': 'Porur', 'Budget Range': '1 Cr - 1.5 Cr', Notes: 'Ready to buy', 'Date Added': '18/08/2026' },
      { rowNumber: 3, Name: 'Duplicate Tester', 'Phone Number': WEBHOOK_PHONE, Source: 'Facebook' },
      { rowNumber: 4, Name: 'Bad Phone', 'Phone Number': '123', Source: 'Facebook' },
    ],
  }),
});
const hookJson = await hook.json();
check('webhook ingests rows', hook.status === 200 && hookJson.inserted === 1, JSON.stringify(hookJson));
check('webhook flags duplicate instead of inserting', hookJson.duplicates === 1);
check('webhook rejects invalid phone', hookJson.invalid === 1);

const badHook = await fetch(`${BASE}/api/webhooks/sheets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': 'nope' },
  body: JSON.stringify({ rows: [] }),
});
check('webhook rejects bad secret', badHook.status === 401);

// --- cron tick ---
const cron = await fetch(`${BASE}/api/cron/tick?secret=dev-cron-secret`);
const cronJson = await cron.json();
check('cron tick runs', cron.status === 200 && cronJson.ok, JSON.stringify(cronJson.distribution));
const cronBad = await fetch(`${BASE}/api/cron/tick?secret=wrong`);
check('cron rejects bad secret', cronBad.status === 401);

// --- export ---
const exportRes = await fetch(`${BASE}/api/admin/export?type=activity`, { headers: { cookie: admin.header() } });
const csv = await exportRes.text();
check('activity CSV export', exportRes.status === 200 && csv.split('\n').length > 1, `${csv.split('\n').length - 2} data rows`);

// --- pages render ---
for (const path of ['/admin', '/admin/leads', '/admin/telecallers', '/admin/imports', '/admin/reports', '/admin/settings', `/admin/leads/${lead1.id}`]) {
  const res = await fetch(BASE + path, { headers: { cookie: admin.header() } });
  check(`page ${path}`, res.status === 200, `status ${res.status}`);
}
const callerPage = await fetch(`${BASE}/caller`, { headers: { cookie: caller.header() } });
check('page /caller', callerPage.status === 200);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
