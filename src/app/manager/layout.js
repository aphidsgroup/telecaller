import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';
import ManagerNav from '@/components/manager/ManagerNav';

export default async function ManagerLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.MANAGER) {
    redirect(user.role === ROLE.ADMIN ? '/admin' : '/caller');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <ManagerNav />
    </div>
  );
}