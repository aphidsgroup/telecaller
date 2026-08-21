import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { LEAD_STATUS } from '@/lib/constants';
import { normalisePhone } from '@/lib/format';

export const POST = route(async (req) => {
  await requireAdmin();
  const { numbers, companyId } = await readJson(req);
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return fail(400, 'No numbers provided');
  }

  let count = 0;
  for (const raw of numbers) {
    const key = normalisePhone(raw);
    if (!key) continue;

    // Check if it already exists
    const exists = await prisma.lead.findFirst({ where: { phoneKey: key } });
    if (exists) continue;

    await prisma.lead.create({
      data: {
        name: 'Unknown',
        phone: raw,
        phoneKey: key,
        status: LEAD_STATUS.NEW,
        source: 'Bulk Add',
        companyId: companyId || null,
        history: {
          create: {
            type: 'IMPORTED',
            note: 'Added via bulk paste',
          },
        },
      },
    });
    count++;
  }

  return ok({ count });
});
