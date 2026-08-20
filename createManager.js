
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  const email = 'manager@buildogram.in';
  const password = 'managerpassword123';
  const hash = await bcrypt.hash(password, 10);
  
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'MANAGER', passwordHash: hash }
    });
    console.log('Updated existing manager');
  } else {
    await prisma.user.create({
      data: {
        name: 'Demo Manager',
        email,
        passwordHash: hash,
        role: 'MANAGER',
        dailyTarget: 0
      }
    });
    console.log('Created new manager');
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
