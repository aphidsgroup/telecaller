import LoginForm from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in - Buildogram Telecalling' };

export default async function LoginPage({ searchParams }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === ROLE.ADMIN ? '/admin' : '/caller');
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold">
            B
          </div>
          <h1 className="text-2xl font-bold">Buildogram Telecalling</h1>
          <p className="mt-1 text-sm text-brand-100">One lead at a time. Every action timestamped.</p>
        </div>
        <LoginForm next={params?.next || ''} />
        <p className="mt-6 text-center text-xs text-brand-200">
          Add this app to your home screen for push notifications and offline safety.
        </p>
      </div>
    </main>
  );
}
