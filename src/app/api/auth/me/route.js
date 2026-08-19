import { getCurrentUser, touchPresence } from '@/lib/auth';
import { fail, ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Also acts as the presence heartbeat, which is what powers the admin
// "who is actually online right now" column.
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return fail(401, 'Not signed in');
  await touchPresence(user.id, user.sessionId);
  return ok({ user });
});
