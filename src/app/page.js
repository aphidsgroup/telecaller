import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.role === ROLE.ADMIN ? '/admin' : '/caller');
}
