import prisma from "@/lib/prisma";
import { requireManager } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const user = await requireManager();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  if (!q || q.length < 3) return ok({ leads: [] });

  const where = {
    phone: { contains: q },
    ...(user.companyId ? { companyId: user.companyId } : {})
  };

  const leads = await prisma.lead.findMany({
    where,
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      lastLeadStatus: true,
      status: true,
      createdAt: true
    }
  });

  return ok({ leads });
});
