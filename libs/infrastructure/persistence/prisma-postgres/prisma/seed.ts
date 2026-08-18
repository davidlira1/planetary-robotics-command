import { PrismaClient } from '@prisma/client';
import { seedRobots } from '../src/seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedRobots(prisma);
    console.log('Seeded robots: D-04, D-09, H-17, H-22, W-08, W-14, M-12, M-27, S-03, S-11');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
