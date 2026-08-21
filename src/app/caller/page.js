import { redirect } from 'next/navigation';
import CallerWorkspace from '@/components/caller/CallerWorkspace';
import FollowupNotifier from '@/components/shared/FollowupNotifier';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My lead - Buildogram' };

export default async function CallerPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.TELECALLER) redirect('/admin');

  return (
    <div className="min-h-screen bg-slate-100 pb-6">
      <FollowupNotifier />
      <CallerWorkspace user={{ id: user.id, name: user.name }} />
    </div>
  );
}
