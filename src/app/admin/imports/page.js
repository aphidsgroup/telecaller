import Link from 'next/link';
import prisma from '@/lib/prisma';
import { SectionTitle } from '@/components/admin/Ui';
import SheetSourcesAdmin from '@/components/admin/SheetSourcesAdmin';
import DuplicateList from '@/components/admin/DuplicateList';
import { formatDateTime, formatDuration } from '@/lib/format';
import { getSettings, str } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sheet sync - Buildogram Admin' };

const STATUS_TONE = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-rose-100 text-rose-700',
  RUNNING: 'bg-sky-100 text-sky-700',
};

export default async function ImportsPage() {
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');

  const [logs, duplicates, pendingCount, companies, sources] = await Promise.all([
    prisma.importLog.findMany({ orderBy: { startedAt: 'desc' }, take: 40, include: { triggeredBy: { select: { name: true } }, company: { select: { name: true } } } }),
    prisma.duplicateHit.findMany({
      where: { resolution: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { existingLead: { select: { id: true, name: true, status: true, assignedToId: true } } },
    }),
    prisma.duplicateHit.count({ where: { resolution: 'PENDING' } }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.sheetSource.findMany({ include: { company: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
  ]);

  for (const s of sources) {
    const lastLog = await prisma.importLog.findFirst({
      where: { source: 'SHEETS_API', spreadsheetId: s.spreadsheetId, sheetTab: s.sheetTab, companyId: s.companyId },
      orderBy: { startedAt: 'desc' }
    });
    s.lastSyncAt = lastLog ? lastLog.startedAt.toISOString() : null;
    
    s.leadCount = await prisma.lead.count({
      where: {
        externalKey: {
          startsWith: `${s.spreadsheetId}:${s.sheetTab || 'default'}:`
        }
      }
    });
  }

  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Google Sheets sync</h1>
        <p className="text-sm text-slate-500">
          Every sync run is logged with its timestamp, row count and source tab. Duplicates are flagged here rather
          than silently creating a second lead.
        </p>
      </div>

      <SheetSourcesAdmin companies={companies} sources={sources} serviceEmail={serviceEmail} tz={tz} />

      <section>
        <SectionTitle>
          Duplicates awaiting a decision{pendingCount ? ` (${pendingCount})` : ''}
        </SectionTitle>
        <DuplicateList duplicates={JSON.parse(JSON.stringify(duplicates))} tz={tz} />
      </section>

      <section>
        <SectionTitle>Sync history</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Ran at</th>
                <th className="th">Source</th>
                <th className="th">Sheet / tab</th>
                <th className="th">Rows</th>
                <th className="th">New</th>
                <th className="th">Duplicates</th>
                <th className="th">Invalid</th>
                <th className="th">Took</th>
                <th className="th">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="td text-xs">{formatDateTime(log.startedAt, tz)}</td>
                  <td className="td text-xs">
                    {log.source.replace(/_/g, ' ').toLowerCase()}
                    {log.triggeredBy ? <div className="text-slate-400">by {log.triggeredBy.name}</div> : null}
                    {log.company ? <div className="text-brand-600 font-semibold mt-0.5">{log.company.name}</div> : null}
                  </td>
                  <td className="td text-xs">{log.sheetTab || '-'}</td>
                  <td className="td">{log.rowsRead}</td>
                  <td className="td font-semibold text-emerald-700">{log.inserted}</td>
                  <td className="td text-amber-700">{log.duplicates}</td>
                  <td className="td text-rose-700">{log.invalid}</td>
                  <td className="td text-xs text-slate-500">
                    {log.finishedAt
                      ? formatDuration((new Date(log.finishedAt) - new Date(log.startedAt)) / 1000)
                      : 'running'}
                  </td>
                  <td className="td">
                    <span className={`chip ${STATUS_TONE[log.status] || 'bg-slate-100 text-slate-600'}`}>{log.status}</span>
                    {log.message ? <div className="mt-1 text-xs text-slate-500">{log.message}</div> : null}
                    {log.errorDetail ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-rose-600">Details</summary>
                        <pre className="mt-1 max-w-md whitespace-pre-wrap text-[11px] text-slate-600">{log.errorDetail}</pre>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td className="td text-slate-500" colSpan={9}>
                    No sync has run yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
