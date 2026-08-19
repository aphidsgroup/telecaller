// Seeds an admin, three telecallers and a realistic batch of construction
// leads so the app is usable the moment it starts - no Google Sheet required.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@buildogram.in';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin@123';
const CALLER_PASSWORD = process.env.SEED_TELECALLER_PASSWORD || 'caller@123';

const TELECALLERS = [
  { name: 'Priya Raman', email: 'priya@buildogram.in' },
  { name: 'Arun Kumar', email: 'arun@buildogram.in' },
  { name: 'Divya Nair', email: 'divya@buildogram.in' },
];

const PROJECTS = ['Buildogram Aster - Porur', 'Buildogram Sereno - OMR', 'Buildogram Vista - Guduvancheri'];
const CITIES = ['Porur', 'OMR', 'Guduvancheri', 'Velachery', 'Ambattur', 'Tambaram'];
const SOURCES = ['Website', 'Facebook', 'Google Ads', 'Referral', 'Walk-in', 'Bulk Sheet'];
const BUDGETS = ['45-60 Lakh', '60-75 Lakh', '75-90 Lakh', '1 Cr - 1.5 Cr', '2 Cr+'];
const FIRST = ['Ramesh', 'Sunita', 'Karthik', 'Meena', 'Vignesh', 'Anitha', 'Sathish', 'Deepa', 'Rahul', 'Lakshmi',
  'Prakash', 'Bhavani', 'Naveen', 'Shalini', 'Gopal', 'Revathi', 'Manoj', 'Kavya', 'Sridhar', 'Uma'];
const LAST = ['Kumar', 'Iyer', 'Reddy', 'Menon', 'Pillai', 'Sharma', 'Balan', 'Rao', 'Varma', 'Krishnan'];
const NOTES = [
  'Asked for the brochure over WhatsApp.',
  'Wants a corner unit facing east.',
  'Home loan pre-approved, ready to buy.',
  'Only free after 7pm.',
  'Comparing with two other builders.',
  '',
  'Interested in a site visit this weekend.',
  '',
];

function pick(list, i) {
  return list[i % list.length];
}

function scoreOf(lead) {
  let s = 0;
  if (/cr/i.test(lead.budget)) s += 26;
  else if (/(7[05]|8\d|9\d)\s*Lakh/i.test(lead.budget)) s += 16;
  if (/walk-in|referral/i.test(lead.source)) s += 22;
  else if (/website|google/i.test(lead.source)) s += 12;
  if (lead.project) s += 8;
  if (lead.city) s += 4;
  if (/ready to buy|site visit/i.test(lead.notes || '')) s += 20;
  return Math.min(100, s);
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Buildogram Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    },
  });

  const callers = [];
  for (const t of TELECALLERS) {
    callers.push(
      await prisma.user.upsert({
        where: { email: t.email },
        update: {},
        create: {
          email: t.email,
          name: t.name,
          role: 'TELECALLER',
          dailyTarget: 60,
          passwordHash: await bcrypt.hash(CALLER_PASSWORD, 10),
        },
      })
    );
  }

  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log(`Leads already present (${existing}) - skipping lead seed.`);
  } else {
    const log = await prisma.importLog.create({
      data: {
        source: 'MANUAL',
        sheetTab: 'Seed',
        status: 'SUCCESS',
        startedAt: new Date(),
        finishedAt: new Date(),
        triggeredById: admin.id,
        message: 'Demo data seeded',
      },
    });

    const leads = [];
    for (let i = 0; i < 42; i += 1) {
      const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`;
      const phone = `9${String(800000000 + i * 137731).slice(0, 9)}`;
      const lead = {
        name,
        phone,
        phoneKey: phone.slice(-10),
        source: pick(SOURCES, i * 2),
        project: pick(PROJECTS, i),
        city: pick(CITIES, i * 3),
        budget: pick(BUDGETS, i * 5),
        notes: pick(NOTES, i * 7) || null,
        dateAdded: new Date(Date.now() - (i % 9) * 86400000),
      };
      leads.push({ ...lead, score: scoreOf(lead) });
    }

    for (const lead of leads) {
      const created = await prisma.lead.create({
        data: {
          ...lead,
          priority: lead.score >= 55 ? 1 : 0,
          status: 'UNASSIGNED',
          importLogId: log.id,
          sourceRow: `Seed!${leads.indexOf(lead) + 2}`,
        },
      });
      await prisma.leadEvent.create({
        data: {
          leadId: created.id,
          userId: admin.id,
          type: 'LEAD_UPLOADED',
          meta: JSON.stringify({ source: 'MANUAL', seed: true }),
        },
      });
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: { rowsRead: leads.length, inserted: leads.length },
    });

    // Round-robin the pool so every telecaller starts with a queue.
    const pool = await prisma.lead.findMany({ where: { status: 'UNASSIGNED' }, orderBy: { createdAt: 'asc' } });
    for (let i = 0; i < pool.length; i += 1) {
      const target = callers[i % callers.length];
      await prisma.lead.update({
        where: { id: pool[i].id },
        data: { assignedToId: target.id, assignedAt: new Date(), status: 'ASSIGNED' },
      });
      await prisma.leadEvent.create({
        data: {
          leadId: pool[i].id,
          userId: admin.id,
          type: 'LEAD_ASSIGNED',
          meta: JSON.stringify({ to: target.id, mode: 'ROUND_ROBIN', seed: true }),
        },
      });
    }
    console.log(`Seeded ${leads.length} leads across ${callers.length} telecallers.`);
  }

  console.log('\nSign in with:');
  console.log(`  Admin      ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  TELECALLERS.forEach((t) => console.log(`  Telecaller ${t.email} / ${CALLER_PASSWORD}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
