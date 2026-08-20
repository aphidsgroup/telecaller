import LoginForm from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in - Buildogram Telecalling' };

export default async function LoginPage({ searchParams }) {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === ROLE.ADMIN) redirect('/admin');
    if (user.role === ROLE.MANAGER) redirect('/manager');
    redirect('/caller');
  }
  const params = await searchParams;

  return (
    <div className="min-h-screen flex font-sans">
      <div className="w-[460px] flex-shrink-0 hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden shadow-[0_12px_28px_-6px_rgba(252,110,32,0.45)] bg-white p-1.5 shrink-0">
              <img src="/icon.png" alt="Buildogram Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-[26px] text-white tracking-tighter uppercase leading-none">Telecalling</span>
              <div className="flex justify-end w-full">
                <span className="font-bold text-[11px] text-brand-500 uppercase tracking-widest leading-none mt-1">by Buildogram</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg flex-shrink-0">📞</div>
              <div>
                <div className="text-[13.5px] font-bold text-white mb-0.5">One Lead at a Time</div>
                <div className="text-[12px] font-medium text-white/50 leading-[1.45]">Automated distribution ensures no cherry-picking.</div>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg flex-shrink-0">⏱️</div>
              <div>
                <div className="text-[13.5px] font-bold text-white mb-0.5">Timestamped Actions</div>
                <div className="text-[12px] font-medium text-white/50 leading-[1.45]">Every call click and status update is logged.</div>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg flex-shrink-0">📶</div>
              <div>
                <div className="text-[13.5px] font-bold text-white mb-0.5">Offline Resilience</div>
                <div className="text-[12px] font-medium text-white/50 leading-[1.45]">Keep working even when the internet drops.</div>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg flex-shrink-0">📈</div>
              <div>
                <div className="text-[13.5px] font-bold text-white mb-0.5">Admin Analytics</div>
                <div className="text-[12px] font-medium text-white/50 leading-[1.45]">Live view into telecaller performance and queue size.</div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[11.5px] font-semibold text-white/30 pt-8 border-t border-white/[0.08]">
          © {new Date().getFullYear()} Buildogram Telecalling
        </div>
      </div>

      <div className="flex-1 flex items-start lg:items-center justify-center p-6 pt-12 lg:p-12 bg-gradient-to-br from-slate-900 to-slate-800 lg:bg-[#f8fafc]">
        <div className="w-full max-w-[420px] bg-white rounded-[20px] p-8 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-12 h-12 rounded-full overflow-hidden shadow-[0_12px_28px_-6px_rgba(252,110,32,0.45)] shrink-0 bg-white p-1">
              <img src="/icon.png" alt="Buildogram Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-[22px] text-[#0f172a] tracking-tighter uppercase leading-none">Telecalling</span>
              <div className="flex justify-end w-full">
                <span className="font-bold text-[9px] text-brand-500 uppercase tracking-widest leading-none mt-1">by Buildogram</span>
              </div>
            </div>
          </div>
          <div className="text-[28px] font-black text-[#16273a] tracking-[-0.03em] mb-1 text-center">Welcome back</div>
          <div className="text-[14px] font-medium text-[#647387] mb-8 text-center">Sign in to your workspace</div>
          
          <LoginForm next={params?.next || ''} />
          
          <p className="mt-8 text-center text-xs text-slate-400 font-medium">
            Add this app to your home screen for push notifications and offline safety.
          </p>
        </div>
      </div>
    </div>
  );
}
