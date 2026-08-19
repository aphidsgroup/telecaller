import Link from 'next/link';
import { LEAD_STATUS_LABEL } from '@/lib/constants';

export function StatCard({ label, value, hint, tone = 'default', href }) {
  const tones = {
    default: 'text-slate-900',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-rose-600',
  };
  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

const STATUS_TONE = {
  UNASSIGNED: 'bg-slate-100 text-slate-600',
  ASSIGNED: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  SCHEDULED: 'bg-violet-100 text-violet-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

export function StatusChip({ status }) {
  return <span className={`chip ${STATUS_TONE[status] || 'bg-slate-100 text-slate-600'}`}>{LEAD_STATUS_LABEL[status] || status}</span>;
}

export function Empty({ children }) {
  return <div className="card p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

export function Bar({ value, max, tone = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
