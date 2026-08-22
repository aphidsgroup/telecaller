import ManagerAddLeadForm from '@/components/manager/ManagerAddLeadForm';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add Lead - Admin' };

export default async function AdminAddLeadPage() {
  await requireAdmin();
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-slate-900">Add Single Lead</h1>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Create a new lead manually</p>
      </div>
      <ManagerAddLeadForm companies={companies} userCompanyId={null} isAdmin={true} />
    </div>
  );
}
