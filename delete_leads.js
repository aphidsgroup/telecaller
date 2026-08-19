const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all leads...');
  
  // Note: dispositions are cascade-deleted when a lead is deleted in schema
  // But let's delete them directly just in case or just delete leads.
  const delDispositions = await prisma.disposition.deleteMany({});
  console.log(`Deleted ${delDispositions.count} dispositions.`);

  const delLeads = await prisma.lead.deleteMany({});
  console.log(`Deleted ${delLeads.count} leads.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
