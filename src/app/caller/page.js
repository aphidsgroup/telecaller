import { redirect } from 'next/navigation';
import CallerWorkspace from '@/components/caller/CallerWorkspace';
import PushSetup from '@/components/PushSetup';
import InstallPrompt from '@/components/InstallPrompt';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My lead - Buildogram' };

export default async function CallerPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.TELECALLER) redirect('/admin');

  return (
    <div className="min-h-screen bg-slate-100">
      <CallerWorkspace user={{ id: user.id, name: user.name }} />
      <div className="mx-auto w-full max-w-md px-4 pb-8">
        <PushSetup />
        <InstallPrompt />
      </div>
    </div>
  );
}
