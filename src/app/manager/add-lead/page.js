
import ManagerAddLeadForm from '@/components/manager/ManagerAddLeadForm';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add Lead - Manager' };

export default async function AddLeadPage() {
  const user = await getCurrentUser();
  const companies = await prisma.company.findMany({
    where: user.companyId ? { id: user.companyId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return <ManagerAddLeadForm companies={companies} userCompanyId={user.companyId} />;
}

