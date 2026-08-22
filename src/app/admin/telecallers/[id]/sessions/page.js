import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { ROLE, callCategoryLabel, leadStatusCategoryLabel } from "@/lib/constants";
import { Phone, Clock, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `${user.name} - Session & Call History` : "Session & Call History" };
}

function formatDur(ms) {
  if (ms == null || ms < 0) return "-";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default async function TelecallerSessionsPage({ params }) {
  const { id } = await params;

  const [telecaller, sessions, dispositions] = await Promise.all([
    prisma.user.findUnique({
      where: { id, role: ROLE.TELECALLER },
      select: { id: true, name: true, email: true },
    }),
    prisma.loginSession.findMany({
      where: { userId: id },
      orderBy: { loginAt: "desc" },
      take: 200,
    }),
    prisma.disposition.findMany({
      where: { userId: id },
      orderBy: { submittedAt: "desc" },
      take: 500,
      include: {
        lead: { select: { name: true, phone: true } }
      }
    })
  ]);

  if (!telecaller) notFound();

  const now = Date.now();

  // Get all unique days from both sessions and dispositions
  const daysMap = {};
  
  const getDayString = (date) => new Date(date).toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "short", day: "numeric",
  });

  sessions.forEach(s => {
    const day = getDayString(s.loginAt);
    if (!daysMap[day]) daysMap[day] = { sessions: [], dispositions: [] };
    daysMap[day].sessions.push(s);
  });

  dispositions.forEach(d => {
    const day = getDayString(d.submittedAt);
    if (!daysMap[day]) daysMap[day] = { sessions: [], dispositions: [] };
    daysMap[day].dispositions.push(d);
  });

  // Sort days descending
  const sortedDays = Object.keys(daysMap).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reports" className="text-xs font-semibold text-brand-600">
          &larr; Back to Reports
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{telecaller.name}</h1>
        <p className="text-sm text-slate-500">{telecaller.email} &mdash; Session & Call history</p>
      </div>

      {sortedDays.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No history recorded yet.</div>
      ) : (
        sortedDays.map((day) => {
          const dayData = daysMap[day];
          const daySessions = dayData.sessions;
          const dayDisps = dayData.dispositions;
          const connectedCalls = dayDisps.filter(d => d.leadStatus !== 'NOT_ANSWERED').length;

          return (
            <section key={day} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{day}</h2>
                <div className="flex gap-2">
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-md px-2 py-1">
                    {dayDisps.length} calls ({connectedCalls} connected)
                  </span>
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-md px-2 py-1">
                    {daySessions.length} logins
                  </span>
                </div>
              </div>

              {/* Logins Table */}
              {daySessions.length > 0 && (
                <div className="overflow-x-auto border-b border-slate-100">
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Login Sessions
                  </div>
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-white">
                      <tr>
                        <th className="th text-[10px]">Login time</th>
                        <th className="th text-[10px]">Logout time</th>
                        <th className="th text-[10px]">Duration</th>
                        <th className="th text-[10px]">Last active</th>
                        <th className="th text-[10px]">IP address</th>
                        <th className="th text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {daySessions.map((s) => {
                        const logoutTime = s.logoutAt ? new Date(s.logoutAt).getTime() : null;
                        const loginTime = new Date(s.loginAt).getTime();
                        const lastSeen = new Date(s.lastSeenAt).getTime();
                        const isActive = !s.logoutAt && (now - lastSeen) < 5 * 60 * 1000;
                        const duration = logoutTime
                          ? logoutTime - loginTime
                          : isActive
                            ? now - loginTime
                            : lastSeen - loginTime;

                        return (
                          <tr key={s.id} className={isActive ? "bg-emerald-50/30" : "bg-white"}>
                            <td className="td py-2 text-xs">{formatDateTime(s.loginAt)}</td>
                            <td className="td py-2 text-xs">
                              {s.logoutAt ? formatDateTime(s.logoutAt) : (
                                <span className={`text-[10px] font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}>
                                  {isActive ? "Still active" : "No logout recorded"}
                                </span>
                              )}
                            </td>
                            <td className="td py-2 font-semibold text-slate-700 text-xs">{formatDur(duration)}</td>
                            <td className="td py-2 text-[10px] text-slate-500">{formatDateTime(s.lastSeenAt)}</td>
                            <td className="td py-2 text-[10px] font-mono text-slate-500">{s.ip || "-"}</td>
                            <td className="td py-2">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                  Online now
                                </span>
                              ) : s.logoutAt ? (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  Logged out
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                  Timeout / Closed
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Calls Table */}
              {dayDisps.length > 0 && (
                <div className="overflow-x-auto bg-white">
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> Call Logs (Spoken time)
                  </div>
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-white">
                      <tr>
                        <th className="th text-[10px]">Time</th>
                        <th className="th text-[10px]">Client</th>
                        <th className="th text-[10px]">Status Updated</th>
                        <th className="th text-[10px]">Time taken / Spoken</th>
                        <th className="th text-[10px]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dayDisps.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="td py-2 text-xs whitespace-nowrap">{new Date(d.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="td py-2 text-xs">
                            <div className="font-semibold text-slate-800">{d.lead.name || "Unknown"}</div>
                            <div className="text-slate-500 text-[10px] font-mono">{d.lead.phone}</div>
                          </td>
                          <td className="td py-2">
                            <div className="text-xs font-bold text-slate-700">{leadStatusCategoryLabel(d.leadStatus)}</div>
                            <div className="text-[10px] text-slate-500">{callCategoryLabel(d.callCategory)}</div>
                          </td>
                          <td className="td py-2">
                            {d.responseSeconds != null ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-brand-500" />
                                <span className="text-xs font-bold text-brand-700">{formatDur(d.responseSeconds * 1000)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="td py-2 text-[10px] text-slate-600 max-w-xs truncate" title={d.notes || ''}>
                            {d.notes ? (
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{d.notes}</span>
                              </div>
                            ) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
