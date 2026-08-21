import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';
import ManagerNav from '@/components/manager/ManagerNav';
import ManagerHeader from '@/components/manager/ManagerHeader';

export default async function ManagerLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.MANAGER) {
    redirect(user.role === ROLE.ADMIN ? '/admin' : '/caller');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ManagerHeader user={{ name: user.name }} />
      <main className="flex-1 pb-20 relative">
        {children}
      </main>
      <ManagerNav />
    </div>
  );
}