import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { ROLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `${user.name} — Session History` : "Session History" };
}

function formatDur(ms) {
  if (ms == null || ms < 0) return "—";
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

  const [telecaller, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id, role: ROLE.TELECALLER },
      select: { id: true, name: true, email: true },
    }),
    prisma.loginSession.findMany({
      where: { userId: id },
      orderBy: { loginAt: "desc" },
      take: 200,
    }),
  ]);

  if (!telecaller) notFound();

  const now = Date.now();

  const grouped = sessions.reduce((acc, s) => {
    const day = new Date(s.loginAt).toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "short", day: "numeric",
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reports" className="text-xs font-semibold text-brand-600">
          &larr; Back to Reports
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{telecaller.name}</h1>
        <p className="text-sm text-slate-500">{telecaller.email} &mdash; Login session history</p>
      </div>

      {Object.entries(grouped).length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No sessions recorded yet.</div>
      ) : (
        Object.entries(grouped).map(([day, daySessions]) => (
          <section key={day}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{day}</h2>
              <span className="text-xs font-semibold bg-brand-50 text-brand-600 rounded-full px-2 py-0.5">
                {daySessions.length} {daySessions.length === 1 ? "login" : "logins"}
              </span>
            </div>
            <div className="card overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Login time</th>
                    <th className="th">Logout time</th>
                    <th className="th">Duration</th>
                    <th className="th">Last active</th>
                    <th className="th">IP address</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                      <tr key={s.id} className={isActive ? "bg-emerald-50/50" : undefined}>
                        <td className="td text-sm">{formatDateTime(s.loginAt)}</td>
                        <td className="td text-sm">
                          {s.logoutAt ? formatDateTime(s.logoutAt) : (
                            <span className={`text-xs font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}>
                              {isActive ? "Still active" : "No logout recorded"}
                            </span>
                          )}
                        </td>
                        <td className="td font-semibold text-slate-700">{formatDur(duration)}</td>
                        <td className="td text-xs text-slate-500">{formatDateTime(s.lastSeenAt)}</td>
                        <td className="td text-xs font-mono text-slate-500">{s.ip || "—"}</td>
                        <td className="td">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              Online now
                            </span>
                          ) : s.logoutAt ? (
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Logged out
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Auto-expired
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
