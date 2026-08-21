import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ROLE } from '@/lib/constants';

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== ROLE.MANAGER && user.role !== ROLE.ADMIN)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { leadId, userId, message } = await req.json();
    if (!leadId || !userId || !message) {
      return NextResponse.json({ error: 'Missing leadId, userId, or message' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (user.companyId && lead.companyId !== user.companyId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: userId,
        followupMessage: message,
        followupRequestedBy: user.id,
        followupRequestedAt: new Date(),
        followupAcceptedAt: null,
        followupDeclinedAt: null,
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
