import { NextResponse } from 'next/server';
import { requireTelecaller } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { num } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireTelecaller();
    const settings = await getSettings();
    const tz = settings.find(s => s.key === 'company.timezone')?.value || 'Asia/Kolkata';

    // Get yesterday's date boundaries in the company timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    const y = parts.find(p => p.type === 'year').value;
    
    // Today at 00:00:00 local time
    const todayLocal = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000${getTimezoneOffsetString(tz)}`);
    
    // Yesterday at 00:00:00 local time
    const yesterdayLocal = new Date(todayLocal.getTime() - 24 * 3600000);

    // Check if the user was active yesterday (did they submit any dispositions?)
    const anyDispositionsYesterday = await prisma.disposition.count({
      where: {
        userId: user.id,
        submittedAt: {
          gte: yesterdayLocal,
          lt: todayLocal
        }
      }
    });

    if (anyDispositionsYesterday === 0) {
      // User was probably on leave or didn't work. No warning.
      return NextResponse.json({ missed: false });
    }

    // Count effective connected calls yesterday
    const achievedYesterday = await prisma.disposition.count({
      where: {
        userId: user.id,
        submittedAt: {
          gte: yesterdayLocal,
          lt: todayLocal
        },
        leadStatus: { not: 'NOT_ANSWERED' }
      }
    });

    const target = user.dailyTarget || 60;
    
    if (achievedYesterday < target) {
      return NextResponse.json({ 
        missed: true, 
        achieved: achievedYesterday, 
        target 
      });
    }

    return NextResponse.json({ missed: false });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function getTimezoneOffsetString(timeZone) {
  const date = new Date();
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  const offset = (tzDate.getTime() - utcDate.getTime()) / 60000;
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
