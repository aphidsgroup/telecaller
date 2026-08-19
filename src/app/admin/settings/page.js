import prisma from '@/lib/prisma';
import { SectionTitle } from '@/components/admin/Ui';
import SettingsForm from '@/components/admin/SettingsForm';
import HolidayManager from '@/components/admin/HolidayManager';
import RuleManager from '@/components/admin/RuleManager';
import { ROLE } from '@/lib/constants';
import { getSettings, SETTING_DEFS } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Settings - Buildogram Admin' };

export default async function SettingsPage() {
  const [settings, holidays, rules, telecallers] = await Promise.all([
    getSettings({ fresh: true }),
    prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
    prisma.assignmentRule.findMany({ include: { user: { select: { name: true } } }, orderBy: { priority: 'desc' } }),
    prisma.user.findMany({ where: { role: ROLE.TELECALLER }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Follow-up delays, working hours, SLA thresholds and assignment behaviour. Changes take effect on the next
          disposition, no deploy needed.
        </p>
      </div>

      <SettingsForm settings={settings} defs={SETTING_DEFS} />

      <section>
        <SectionTitle>Company holidays</SectionTitle>
        <p className="mb-2 text-xs text-slate-500">
          Callbacks that land on a holiday or a weekly off roll forward to the next working day.
        </p>
        <HolidayManager holidays={JSON.parse(JSON.stringify(holidays))} />
      </section>

      <section>
        <SectionTitle>Rule-based assignment</SectionTitle>
        <p className="mb-2 text-xs text-slate-500">
          Used when assignment mode is RULES: a lead matching a rule goes to that telecaller, everything else falls
          back to round robin.
        </p>
        <RuleManager rules={JSON.parse(JSON.stringify(rules))} telecallers={telecallers} />
      </section>
    </div>
  );
}
