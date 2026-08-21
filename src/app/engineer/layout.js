import { requireEngineer } from '@/lib/auth';
import EngineerNav from '@/components/engineer/EngineerNav';

export default async function EngineerLayout({ children }) {
  await requireEngineer();

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-[80px]">
      <div className="sm:max-w-[480px] sm:mx-auto sm:bg-white sm:min-h-screen sm:shadow-2xl sm:shadow-slate-200/50 relative">
        {children}
        <EngineerNav />
      </div>
    </div>
  );
}
