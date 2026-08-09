import { classifyBatchWithAI } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get a few Anthropic jobs that should be positive
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: true, company: 'anthropic' },
    select: { id: true, title: true, company: true, description: true },
    take: 3,
  });

  console.log('Testing AI on known-positive Anthropic jobs:');
  const result = await classifyBatchWithAI(jobs);
  console.log('Result:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });