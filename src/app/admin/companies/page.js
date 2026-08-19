import prisma from '@/lib/prisma';
import CompanyAdmin from '@/components/admin/CompanyAdmin';
import { SectionTitle } from '@/components/admin/Ui';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Companies - Buildogram Admin' };

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { leads: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <SectionTitle>Companies</SectionTitle>
      <CompanyAdmin initialCompanies={companies} />
    </div>
  );
}
