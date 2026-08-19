import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () =>
  ok({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null })
);
