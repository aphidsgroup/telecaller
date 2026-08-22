import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { EVENT_LABEL, ROLE } from '@/lib/constants';
import { callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import {
  Activity, Phone, LogIn, LogOut, CheckCircle, Clock, UserCheck,
  Star, AlertTriangle, RefreshCw, BarChart3, Wrench, Search
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity Feed - Buildogram Admin' };

const ROLE_BADGE = {
  TELECALLER: { label: 'Telecaller', cls: 'bg-blue-100 text-blue-700' },
  SITE_ENGINEER: { label: 'Site Engineer', cls: 'bg-emerald-100 text-emerald-700' },
  MANAGER: { label: 'Manager', cls: 'bg-violet-100 text-violet-700' },
  ADMIN: { label: 'Admin', cls: 'bg-slate-200 text-slate-700' },
};

const EVENT_ICON = {
  CALL_CLICKED: Phone,
  STATUS_UPDATED: CheckCircle,
  FOLLOWUP_SCHEDULED: Clock,
  LEAD_ASSIGNED: UserCheck,
  LEAD_REASSIGNED: RefreshCw,
  LEAD_CLOSED: Star,
  AUTO_FLAGGED: AlertTriangle,
  SITE_VISIT_UPDATED: Wrench,
};

function EventIcon({ type }) {
  const Icon = EVENT_ICON[type] || Activity;
  return <Icon className="h-3.5 w-3.5" />;
}

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] || { label: role, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function TimeAgo({ date }) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  let label;
  if (diff < 60) label = `${diff}s ago`;
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m ago`;
  else if (diff < 86400) label = `${Math.floor(diff / 3600)}h ago`;
  else label = formatDateTime(date);
  return <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>;
}

export default async function ActivityPage({ searchParams }) {
  await requireAdmin();
  const params = (await searchParams) || {};
  const roleFilter = params.role || 'ALL';
  const typeFilter = params.type || 'ALL';
  const q = params.q?.trim() || '';

  const userWhere = {
    role: roleFilter === 'ALL'
      ? { in: [ROLE.TELECALLER, ROLE.SITE_ENGINEER, ROLE.MANAGER, ROLE.ADMIN] }
      : roleFilter,
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };

  const [leadEvents, dispositions, loginSessions, auditLogs, userList] = await Promise.all([
    prisma.leadEvent.findMany({
      orderBy: { at: 'desc' },
      take: 200,
      where: {
        ...(typeFilter !== 'ALL' && typeFilter !== 'DISPOSITION' && typeFilter !== 'LOGIN' && typeFilter !== 'AUDIT' ? { type: typeFilter } : {}),
        ...(typeFilter !== 'DISPOSITION' && typeFilter !== 'LOGIN' && typeFilter !== 'AUDIT' ? {
          user: q ? { name: { contains: q, mode: 'insensitive' }, role: roleFilter !== 'ALL' ? roleFilter : undefined } : (roleFilter !== 'ALL' ? { role: roleFilter } : undefined),
        } : { user: { id: 'NEVER' } }), // skip when wrong type filter
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        lead: { select: { id: true, name: true, phone: true } },
      },
    }).catch(() => []),
    typeFilter === 'ALL' || typeFilter === 'DISPOSITION' ? prisma.disposition.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 200,
      where: {
        user: q ? { name: { contains: q, mode: 'insensitive' }, role: roleFilter !== 'ALL' ? roleFilter : undefined } : (roleFilter !== 'ALL' ? { role: roleFilter } : undefined),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        lead: { select: { id: true, name: true, phone: true } },
      },
    }) : [],
    typeFilter === 'ALL' || typeFilter === 'LOGIN' ? prisma.loginSession.findMany({
      orderBy: { loginAt: 'desc' },
      take: 100,
      where: {
        user: q ? { name: { contains: q, mode: 'insensitive' }, role: roleFilter !== 'ALL' ? roleFilter : undefined } : (roleFilter !== 'ALL' ? { role: roleFilter } : undefined),
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    }) : [],
    typeFilter === 'ALL' || typeFilter === 'AUDIT' ? prisma.auditLog.findMany({
      orderBy: { at: 'desc' },
      take: 100,
      where: {
        user: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    }) : [],
    prisma.user.findMany({
      where: { role: { in: [ROLE.TELECALLER, ROLE.SITE_ENGINEER, ROLE.MANAGER] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Merge all activity into one feed
  const feed = [
    ...leadEvents.map(e => ({
      id: `evt-${e.id}`,
      at: e.at,
      user: e.user,
      kind: 'event',
      type: e.type,
      label: EVENT_LABEL[e.type] || e.type,
      lead: e.lead,
      meta: e.meta ? (() => { try { return JSON.parse(e.meta); } catch { return {}; } })() : {},
    })),
    ...dispositions.map(d => ({
      id: `disp-${d.id}`,
      at: d.submittedAt,
      user: d.user,
      kind: 'disposition',
      type: 'DISPOSITION',
      label: 'Status updated',
      lead: d.lead,
      leadStatus: d.leadStatus,
      callCategory: d.callCategory,
      notes: d.notes,
      responseSeconds: d.responseSeconds,
    })),
    ...loginSessions.map(s => ({
      id: `login-${s.id}`,
      at: s.loginAt,
      user: s.user,
      kind: 'login',
      type: 'LOGIN',
      label: 'Logged in',
      logoutAt: s.logoutAt,
      ip: s.ip,
    })),
    ...auditLogs.map(a => ({
      id: `audit-${a.id}`,
      at: a.at,
      user: a.user,
      kind: 'audit',
      type: 'AUDIT',
      label: a.action.replace(/_/g, ' '),
      detail: a.detail,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 300);

  // Group by date
  const grouped = {};
  for (const item of feed) {
    const day = new Date(item.at).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  }

  const kindColors = {
    disposition: 'bg-emerald-500',
    event: 'bg-blue-400',
    login: 'bg-violet-400',
    audit: 'bg-amber-400',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
          <Activity className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Activity Feed</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">All user activity across the platform</p>
        </div>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Search user</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input type="text" name="q" defaultValue={q} placeholder="Name..." className="input pl-8 text-sm w-full" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Role</label>
          <select name="role" defaultValue={roleFilter} className="input text-sm">
            <option value="ALL">All roles</option>
            <option value="TELECALLER">Telecaller</option>
            <option value="SITE_ENGINEER">Site Engineer</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Activity type</label>
          <select name="type" defaultValue={typeFilter} className="input text-sm">
            <option value="ALL">All types</option>
            <option value="DISPOSITION">Call updates</option>
            <option value="CALL_CLICKED">Calls clicked</option>
            <option value="LEAD_ASSIGNED">Lead assignments</option>
            <option value="FOLLOWUP_SCHEDULED">Follow-ups</option>
            <option value="SITE_VISIT_UPDATED">Site visits</option>
            <option value="LOGIN">Logins</option>
            <option value="AUDIT">Admin actions</option>
          </select>
        </div>
        <button type="submit" className="btn-primary text-sm px-5 rounded-xl">Filter</button>
        <a href="/admin/activity" className="text-sm font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 self-center">Clear</a>
      </form>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {dispositions.length} call updates
        </span>
        <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          {leadEvents.length} lead events
        </span>
        <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 font-semibold px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          {loginSessions.length} logins
        </span>
        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 font-semibold px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          {auditLogs.length} admin actions
        </span>
      </div>

      {/* Timeline */}
      {Object.entries(grouped).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No activity found for selected filters</p>
        </div>
      ) : (
        Object.entries(grouped).map(([day, items]) => (
          <div key={day}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{day}</h2>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400">{items.length} activities</span>
            </div>

            <div className="relative pl-5">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="relative bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 ml-3">
                    {/* Timeline dot */}
                    <div className={`absolute -left-5 top-4 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${kindColors[item.kind]}`} />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {/* Kind icon */}
                        <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-white ${kindColors[item.kind]}`}>
                          {item.kind === 'login' ? <LogIn className="h-3 w-3" /> :
                           item.kind === 'audit' ? <BarChart3 className="h-3 w-3" /> :
                           item.kind === 'disposition' ? <CheckCircle className="h-3 w-3" /> :
                           <EventIcon type={item.type} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            {item.user ? (
                              <>
                                <span className="text-sm font-bold text-slate-900">{item.user.name}</span>
                                <RoleBadge role={item.user.role} />
                              </>
                            ) : (
                              <span className="text-sm font-bold text-slate-400">System</span>
                            )}
                            <span className="text-sm text-slate-600">&mdash; {item.label}</span>
                          </div>

                          {/* Disposition details */}
                          {item.kind === 'disposition' && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.lead && (
                                <a href={`/admin/leads`} className="text-xs text-brand-600 font-semibold hover:underline">
                                  {item.lead.name || item.lead.phone}
                                </a>
                              )}
                              {item.leadStatus && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                                  {leadStatusCategoryLabel(item.leadStatus)}
                                </span>
                              )}
                              {item.callCategory && (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                                  {callCategoryLabel(item.callCategory)}
                                </span>
                              )}
                              {item.responseSeconds && (
                                <span className="text-xs text-slate-500">
                                  {Math.floor(item.responseSeconds / 60)}m {item.responseSeconds % 60}s spoken
                                </span>
                              )}
                              {item.notes && (
                                <span className="text-xs text-slate-500 italic truncate max-w-xs" title={item.notes}>
                                  &quot;{item.notes.slice(0, 80)}{item.notes.length > 80 ? '...' : ''}&quot;
                                </span>
                              )}
                            </div>
                          )}

                          {/* Lead event details */}
                          {item.kind === 'event' && item.lead && (
                            <div className="mt-1 text-xs text-slate-500">
                              Lead: <span className="font-semibold text-slate-700">{item.lead.name || item.lead.phone}</span>
                            </div>
                          )}

                          {/* Login details */}
                          {item.kind === 'login' && (
                            <div className="mt-1 text-xs text-slate-500">
                              {item.ip && <span>IP: <span className="font-mono">{item.ip}</span></span>}
                              {item.logoutAt && <span className="ml-2">— logged out {formatDateTime(item.logoutAt)}</span>}
                            </div>
                          )}

                          {/* Audit details */}
                          {item.kind === 'audit' && item.detail && (
                            <div className="mt-1 text-xs text-slate-500 font-mono truncate max-w-sm" title={item.detail}>
                              {item.detail}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="shrink-0 text-right">
                        <TimeAgo date={item.at} />
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          {new Date(item.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
