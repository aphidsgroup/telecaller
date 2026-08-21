import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    
    const { leadId, accept } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.assignedToId !== user.id) return NextResponse.json({ error: 'Not assigned to you' }, { status: 403 });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(accept ? { followupAcceptedAt: new Date() } : { followupDeclinedAt: new Date() })
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
