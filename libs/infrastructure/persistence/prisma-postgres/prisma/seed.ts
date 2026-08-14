import { PrismaClient } from '@prisma/client';
import { seedRobots } from '../src/seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedRobots(prisma);
    console.log('Seeded robots: D-04, H-17, W-08, M-12, S-03');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
