import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === ROLE.ADMIN) redirect('/admin');
  if (user.role === ROLE.MANAGER) redirect('/manager');
  if (user.role === ROLE.SITE_ENGINEER) redirect('/engineer');
  redirect('/caller');
}
