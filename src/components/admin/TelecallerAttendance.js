import Link from 'next/link';
import { formatDuration } from '@/lib/format';

export default function TelecallerAttendance({ users, sessions, currentMonth }) {
  // Aggregate sessions by user and by day
  const stats = users.map(user => {
    const userSessions = sessions.filter(s => s.userId === user.id);
    let totalSeconds = 0;
    const daysWorked = new Set();

    userSessions.forEach(s => {
      const start = new Date(s.loginAt);
      const end = new Date(s.lastSeenAt);
      const duration = Math.max(0, (end - start) / 1000); // seconds
      
      // Ignore tiny sessions (less than 1 minute) if we want, but let's just sum it all
      totalSeconds += duration;
      
      // Date string YYYY-MM-DD
      const dateStr = start.toISOString().split('T')[0];
      daysWorked.add(dateStr);
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return {
      ...user,
      daysWorked: daysWorked.size,
      totalHours: hours,
      totalMinutes: minutes,
      totalSeconds
    };
  });

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance & Work Hours</h2>
          <p className="text-sm text-slate-500">Summary for the current month ({currentMonth})</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="th">Telecaller</th>
              <th className="th">Working Days (This Month)</th>
              <th className="th">Total Hours Logged</th>
              <th className="th">Avg Hours / Day</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.sort((a, b) => b.totalSeconds - a.totalSeconds).map((s) => (
              <tr key={s.id}>
                <td className="td font-medium text-slate-900">
                  <Link href={`/admin/telecallers/${s.id}`} className="hover:underline text-brand-600">
                    {s.name}
                  </Link>
                </td>
                <td className="td">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 text-sm font-bold bg-brand-50 text-brand-700 rounded-lg">
                    {s.daysWorked} days
                  </span>
                </td>
                <td className="td text-slate-600 font-semibold">
                  {s.totalHours}h {s.totalMinutes}m
                </td>
                <td className="td text-slate-500">
                  {s.daysWorked > 0 ? (
                    <span className="text-sm">
                      {Math.floor((s.totalSeconds / s.daysWorked) / 3600)}h {Math.floor(((s.totalSeconds / s.daysWorked) % 3600) / 60)}m
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {stats.length === 0 ? (
              <tr>
                <td className="td text-slate-500" colSpan={4}>No telecallers found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
