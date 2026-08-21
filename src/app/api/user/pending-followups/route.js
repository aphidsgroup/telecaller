import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const followups = await prisma.lead.findMany({
      where: {
        assignedToId: user.id,
        followupRequestedAt: { not: null },
        followupAcceptedAt: null,
        followupDeclinedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        followupMessage: true,
        followupRequestedAt: true,
      }
    });

    return NextResponse.json({ followups });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
