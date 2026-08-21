import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('engineerpassword123', 10);
  const email = 'engineer@buildogram.in';
  
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, role: 'SITE_ENGINEER', isActive: true },
    create: {
      email,
      name: 'Demo Site Engineer',
      passwordHash: hash,
      role: 'SITE_ENGINEER',
      isActive: true,
    }
  });

  console.log('Site Engineer created/updated:');
  console.log('Email:', user.email);
  console.log('Password: engineerpassword123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
