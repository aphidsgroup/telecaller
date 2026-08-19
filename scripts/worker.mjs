// Self-hosted alternative to Vercel Cron: calls the tick endpoint on an
// interval. Use this when hosting on Railway/Render/a VPS.
//   node scripts/worker.mjs
const BASE = process.env.APP_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS || 5 * 60 * 1000);

if (!SECRET) {
  console.error('CRON_SECRET is required.');
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${BASE}/api/cron/tick`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const data = await res.json();
    console.log(new Date().toISOString(), res.status, JSON.stringify(data));
  } catch (err) {
    console.error(new Date().toISOString(), 'tick failed', err.message);
  }
}

await tick();
setInterval(tick, INTERVAL_MS);
console.log(`Worker running every ${INTERVAL_MS / 1000}s against ${BASE}`);
